#!/usr/bin/env python3
"""
ChainGuard Dashboard API — Flask bridge between React dashboard and backend.
Port 8001. Reads database.toon directly. Proxies /api/analyze to risk_api.py:8000.
"""
import json
import os
import subprocess
import sys
import datetime
import tempfile

import requests
from flask import Flask, Response, jsonify, send_from_directory, stream_with_context, send_file
from flask import request as flask_request
from flask_cors import CORS
from dotenv import load_dotenv

import utils

load_dotenv()

app = Flask(__name__, static_folder="dashboard/dist", static_url_path="")
CORS(app)

RISK_API_BASE = os.getenv("RISK_API_URL", "http://127.0.0.1:8000")
SAFE_VULNS = {"no significant vulnerability detected", "safe", "none", "n/a", ""}
POC_REQUESTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "poc_requests")

# Store last scan result for PDF generation
_LAST_SCAN_RESULT = None
_LAST_SCAN_LINES = []


def _write_poc_request(address: str, score: int, vulnerability: str, alchemy_key: str):
    """Write a PoC request file so the Antigravity daemon picks it up."""
    os.makedirs(POC_REQUESTS_DIR, exist_ok=True)
    fork_url = f"https://eth-mainnet.g.alchemy.com/v2/{alchemy_key}"
    content = f"""# PoC Request: {address}

**Chain:** ETHEREUM
**Score:** {score}/100
**Vulnerability:** {vulnerability}
**Fork URL:** {fork_url}

Fetch the verified source code from Etherscan mainnet (chainid=1) and generate
a Foundry PoC test that mathematically proves this vulnerability.
"""
    path = os.path.join(POC_REQUESTS_DIR, f"{address.lower()}.md")
    with open(path, "w") as f:
        f.write(content)
    print(f"[poc-queue] Written {path}", flush=True)

import time as _time


# ── Serve React build (production) ─────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    dist = os.path.join(os.path.dirname(__file__), "dashboard/dist")
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


# ── API endpoints ───────────────────────────────────────────────────────────

@app.route("/api/report/pdf")
def download_pdf():
    """Generate and download a PDF security report from the latest scan."""
    global _LAST_SCAN_RESULT, _LAST_SCAN_LINES
    
    if not _LAST_SCAN_RESULT:
        # Fallback to static file if no scan has been run yet
        pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Walkthrough_TheDAO.pdf")
        if os.path.exists(pdf_path):
            return send_file(pdf_path, as_attachment=True, download_name="ChainGuard_Report.pdf")
        return jsonify({"error": "No scan results available. Run a scan first."}), 404
    
    r = _LAST_SCAN_RESULT
    addr = r.get("address", "Unknown")
    score = r.get("score", 0)
    vuln = r.get("vulnerability", "N/A")
    chain = r.get("chain", "ETHEREUM")
    exploit_confirmed = r.get("exploit_confirmed", False)
    exploit_output = r.get("exploit_output", "")
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Check if the IDE agent completed an exploit for this address
    agent_output_path = os.path.join(POC_REQUESTS_DIR, "done", f"{addr.lower()}_output.txt")
    if os.path.exists(agent_output_path):
        try:
            with open(agent_output_path, "r") as f:
                agent_output = f.read()
            if "[PASS]" in agent_output:
                exploit_confirmed = True
                exploit_output = agent_output
        except:
            pass
    
    severity = "CRITICAL" if score >= 90 else "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
    
    terminal_log = "\n".join(_LAST_SCAN_LINES[-50:]) if _LAST_SCAN_LINES else "No terminal output captured."
    
    md = f"""# ChainGuard Security Report

**Generated:** {now}  
**Engine:** Antigravity v2.2

---

## Target

| Field | Value |
|-------|-------|
| **Contract** | `{addr}` |
| **Chain** | {chain} |
| **Risk Score** | **{score}/100** |
| **Severity** | **{severity}** |
| **Vulnerability** | {vuln} |
| **Exploit Confirmed** | {'✅ YES' if exploit_confirmed else '❌ NO'} |

---

## Analysis Summary

ChainGuard performed a multi-layered security analysis on the target contract:

1. **Static Analysis (Regex):** Pattern-matching for known vulnerability signatures (reentrancy, uncapped mint, delegatecall, etc.)
2. **AI Analysis (Antigravity):** Deep semantic analysis of the contract source code to identify logical vulnerabilities
3. **Exploit Confirmation:** Automated Foundry fork test generation and execution against a mainnet fork

### Vulnerability Details

**{vuln}**

Risk Score: **{score}/100** — classified as **{severity} RISK**

{'### Exploit Test Output' + chr(10) + chr(10) + '```' + chr(10) + exploit_output[:3000] + chr(10) + '```' if exploit_output else ''}

---

## Terminal Log

```
{terminal_log}
```

---

## Methodology

- **Static scan:** Regex-based pattern detection for 15+ vulnerability classes
- **AI scoring:** Gemini 2.5 Flash semantic analysis with structured JSON output
- **Exploit generation:** AI-generated Foundry PoC tests executed on Alchemy mainnet forks
- **On-chain reporting:** Risk scores published to Chainlink CRE RiskRegistry on Sepolia

---

*Report generated by ChainGuard — Chainlink Hackathon 2026*
"""
    
    # Write markdown to temp file and convert to PDF
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, dir='/tmp') as f:
            f.write(md)
            md_path = f.name
        
        pdf_path = md_path.replace('.md', '.pdf')
        result = subprocess.run(
            ['npx', '-y', 'md-to-pdf', md_path],
            capture_output=True, text=True, timeout=30,
            cwd='/tmp'
        )
        
        if os.path.exists(pdf_path):
            return send_file(pdf_path, as_attachment=True, download_name=f"ChainGuard_Report_{addr[:10]}.pdf")
        else:
            # Fallback: return markdown as text
            return md, 200, {'Content-Type': 'text/markdown'}
    except Exception as e:
        return jsonify({"error": f"PDF generation failed: {e}"}), 500


@app.route("/api/alerts")
def get_alerts():
    try:
        rows = utils.read_db()
        if rows:
            # Deduplicate by contract to avoid PENDING/retry spam
            dedup = {}
            for r in rows:
                c = r.get("contract")
                if c:
                    dedup[c] = r
            rows = list(dedup.values())
            
        if not rows:
            return jsonify([])
        rows.sort(key=lambda r: r.get("time", 0), reverse=True)
        return jsonify(rows)
    except Exception:
        return jsonify([])


@app.route("/api/stats")
def get_stats():
    try:
        rows = utils.read_db()
        
        # Deduplicate
        dedup = {}
        for r in rows:
            c = r.get("contract")
            if c: dedup[c] = r
        uniq_rows = list(dedup.values())
        
        threats = sum(
            1 for r in uniq_rows
            if r.get("vulnerability", "").lower().strip() not in SAFE_VULNS
        )
        value_protected = sum(r.get("value_usd", 0.0) for r in uniq_rows)
        return jsonify({
            "analyzed": len(uniq_rows),
            "threats": threats,
            "value_protected": round(value_protected, 2),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/status")
def get_status():
    def is_running(script: str) -> bool:
        try:
            r = subprocess.run(["pgrep", "-f", script],
                               capture_output=True, timeout=2)
            return r.returncode == 0
        except Exception:
            return False

    def risk_api_online() -> bool:
        try:
            r = requests.get(f"{RISK_API_BASE}/health", timeout=2)
            return r.status_code == 200 and r.json().get("ok") is True
        except Exception:
            return False

    return jsonify({
        "risk_api":     {"name": "Risk API",        "description": "Python scoring server", "online": risk_api_online()},
        "sentry":       {"name": "Sentry EVM",      "description": "Uniswap V3/V4 monitor", "online": is_running("sentry_evm.py")},
        "golden_bridge":{"name": "Golden Bridge",   "description": "Gemini AI analyzer",    "online": is_running("golden_bridge.py")},
        "cre":          {"name": "Chainlink CRE",   "description": "On-chain risk workflow", "online": True},  # Deployed workflow, always available
    })


@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = flask_request.get_json(silent=True) or {}
    address = body.get("address", "").strip()
    chain = body.get("chain", "ETHEREUM").upper()

    if not address.startswith("0x") or len(address) != 42:
        return jsonify({"error": "invalid_address"}), 400

    try:
        r = requests.get(
            f"{RISK_API_BASE}/score",
            params={"address": address, "chain": chain},
            timeout=90,
        )
        return jsonify(r.json()), r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "risk_api_offline — run: python risk_api.py"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/submit", methods=["POST"])
def submit_onchain():
    """Write risk score to RiskRegistry on Sepolia via web3."""
    body = flask_request.get_json(silent=True) or {}
    address     = body.get("address", "").strip()
    score       = int(body.get("score", 0))
    vulnerability = body.get("vulnerability", "")

    if not address.startswith("0x") or len(address) != 42:
        return jsonify({"error": "invalid_address"}), 400

    registry = os.getenv("RISK_REGISTRY_ADDRESS", "").strip()
    private_key = os.getenv("PRIVATE_KEY", "").strip()
    alchemy_key = os.getenv("ALCHEMY_API_KEY", "").strip()
    rpc_url     = os.getenv("CRE_RPC_URL", f"https://eth-sepolia.g.alchemy.com/v2/{alchemy_key}").strip()

    if not registry or registry == "0x" + "0" * 40:
        return jsonify({"error": "RISK_REGISTRY_ADDRESS not configured in .env"}), 503
    if not private_key:
        return jsonify({"error": "PRIVATE_KEY not configured in .env"}), 503
    if not alchemy_key:
        return jsonify({"error": "ALCHEMY_API_KEY not configured in .env"}), 503

    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            return jsonify({"error": "Cannot connect to Sepolia RPC"}), 503

        abi = [{
            "inputs": [
                {"name": "target",        "type": "address"},
                {"name": "score",         "type": "uint256"},
                {"name": "vulnerability", "type": "string"},
            ],
            "name": "reportRisk",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function",
        }]

        account  = w3.eth.account.from_key(private_key)
        contract = w3.eth.contract(address=Web3.to_checksum_address(registry), abi=abi)

        raw_tx = contract.functions.reportRisk(
            Web3.to_checksum_address(address),
            score,
            vulnerability,
        ).build_transaction({
            "from":  account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
        })
        
        # Estimate gas properly to avoid Out of Gas with long vulnerability strings
        try:
            est_gas = w3.eth.estimate_gas(raw_tx)
            raw_tx["gas"] = int(est_gas * 1.2)  # add 20% buffer
        except Exception:
            raw_tx["gas"] = 500_000  # Fallback
            
        signed   = w3.eth.account.sign_transaction(raw_tx, private_key)
        tx_hash  = w3.eth.send_raw_transaction(signed.raw_transaction)
        hex_hash = tx_hash.hex()

        # Queue PoC generation for high-risk contracts is now handled in /api/run
        return jsonify({
            "tx_hash":      hex_hash,
            "etherscan_url": f"https://sepolia.etherscan.io/tx/{hex_hash}",
            "registry":     registry,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/run")
def run_scan():
    """SSE endpoint — streams live Antigravity output then emits the JSON result."""
    address = flask_request.args.get("address", "").strip()
    if not address.startswith("0x") or len(address) != 42:
        return jsonify({"error": "invalid_address"}), 400

    def generate():
        global _LAST_SCAN_RESULT, _LAST_SCAN_LINES
        _LAST_SCAN_LINES = []
        
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "risk_score.py")
        cmd = [sys.executable, script, "--address", address, "--json"]
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=env,
            )
            for raw_line in proc.stdout:
                line = raw_line.rstrip("\n")
                stripped = line.strip()
                if not stripped:
                    continue
                _LAST_SCAN_LINES.append(stripped)
                # Detect final JSON result line
                if stripped.startswith("{") and stripped.endswith("}"):
                    try:
                        parsed = json.loads(stripped)
                        _LAST_SCAN_RESULT = parsed
                        yield f"event: result\ndata: {stripped}\n\n"
                        # Create PoC Request so Antigravity Agent can pick it up
                        if parsed.get("score", 0) >= 70:
                            alchemy_key = os.getenv("ALCHEMY_API_KEY", "")
                            _write_poc_request(address, parsed.get("score", 0), parsed.get("vulnerability", ""), alchemy_key)
                        continue
                    except Exception:
                        pass
                yield f"event: line\ndata: {json.dumps(stripped)}\n\n"
            proc.wait()
        except Exception as e:
            yield f"event: scan_error\ndata: {json.dumps(str(e))}\n\n"
        yield "event: done\ndata: \n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.route("/api/poc_status")
def poc_status():
    address = flask_request.args.get("address", "").strip().lower()
    if not address:
        return jsonify({"status": "pending"})
    
    done_path = os.path.join(POC_REQUESTS_DIR, "done", f"{address}_output.txt")
    if os.path.exists(done_path):
        try:
            with open(done_path, "r") as f:
                output = f.read()
            return jsonify({
                "status": "completed",
                "output": output
            })
        except:
            pass
    return jsonify({"status": "pending"})


if __name__ == "__main__":
    port = int(os.getenv("DASHBOARD_API_PORT", "8001"))
    print(f"[ChainGuard] Dashboard API → http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
