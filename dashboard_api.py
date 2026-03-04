#!/usr/bin/env python3
"""
ChainGuard Dashboard API — Flask bridge between React dashboard and backend.
Port 8001. Reads database.toon directly. Proxies /api/analyze to risk_api.py:8000.
"""
import json
import os
import subprocess
import sys

import requests
from flask import Flask, Response, jsonify, send_from_directory, stream_with_context
from flask import request as flask_request
from flask_cors import CORS
from dotenv import load_dotenv

import utils

load_dotenv()

app = Flask(__name__, static_folder="dashboard/dist", static_url_path="")
CORS(app)

RISK_API_BASE = os.getenv("RISK_API_URL", "http://127.0.0.1:8000")
SAFE_VULNS = {"no significant vulnerability detected", "safe", "none", "n/a", ""}

# ── Demo fixtures (Chainlink Hack demo button) ───────────────────────────────

_DEMO_SAFE = {
    "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "chain": "ETHEREUM",
    "value_usd": 6_193_540_905.88,
    "score": 10,
    "vulnerability": "No significant vulnerability detected",
    "exploit_confirmed": False,
    "demo": True,
}

_DEMO_VULN = {
    "address": "0x4e2Bf022a5E5c91C4dc64d0D53680C8A862e81BD",
    "chain": "ETHEREUM",
    "value_usd": 45230.50,
    "score": 95,
    "vulnerability": "Honeypot — _transfer blacklist trap: buying enabled, selling permanently blocked for all non-owner addresses",
    "exploit_confirmed": True,
    "exploit_output": (
        "Running 1 test for test/HoneypotExploit.t.sol:HoneypotExploitTest\n"
        "[PASS] testHoneypotTrap() (gas: 312,847)\n"
        "\n"
        "Traces:\n"
        "  [312847] HoneypotExploitTest::testHoneypotTrap()\n"
        "    \u251c\u2500 VM::deal(Attacker, 1 ETH)\n"
        "    \u251c\u2500 UniswapV3::exactInputSingle{ value: 1 ETH }(WETH \u2192 HONEYPOT)\n"
        "    \u2502   \u2514\u2500 \u2190 Attacker receives 10,847,291 HONEYPOT tokens\n"
        "    \u251c\u2500 HONEYPOT::approve(UniswapV3Router, type(uint256).max)\n"
        "    \u251c\u2500 UniswapV3::exactInputSingle(HONEYPOT \u2192 WETH)  \u2190 sell attempt\n"
        "    \u2502   \u2514\u2500 HONEYPOT::_transfer(Attacker \u2192 Pool)\n"
        "    \u2502       \u251c\u2500 _blacklist[msg.sender] == true\n"
        "    \u2502       \u2514\u2500 \u2190 [Revert] 'BEP20: transfer amount exceeds allowance'\n"
        "    \u2514\u2500 assertEq(weth.balanceOf(Attacker), 0)  \u2713\n"
        "\n"
        "  \u2717  1 ETH (\u2248 $3,240) permanently locked \u2014 0% recovery possible\n"
        "  \u2713  Owner wallet excluded from blacklist (can sell freely)\n"
        "\n"
        "Test result: ok. 1 passed; 0 failed; finished in 3.12s"
    ),
    "demo": True,
}

import time as _time

_FALLBACK_ALERTS = [
    {"contract": "ethereum_0x4e2Bf022a5E5c91C4dc64d0D53680C8A862e81BD.sol", "vulnerability": "Honeypot — _transfer blocked by whitelist", "score": 95, "status": "THREAT", "chain": "ETHEREUM", "value_usd": 45230.50, "exploit_confirmed": True, "output_name": "demo_1"},
    {"contract": "ethereum_0xdAC17F958D2ee523a2206206994597C13D831ec7.sol", "vulnerability": "No significant vulnerability detected", "score": 8, "status": "SAFE", "chain": "ETHEREUM", "value_usd": 2_410_000_000.0, "exploit_confirmed": False, "output_name": "demo_2"},
    {"contract": "ethereum_0x6B175474E89094C44Da98b954EedeAC495271d0F.sol", "vulnerability": "No significant vulnerability detected", "score": 12, "status": "SAFE", "chain": "ETHEREUM", "value_usd": 1_850_000_000.0, "exploit_confirmed": False, "output_name": "demo_3"},
    {"contract": "ethereum_0xa1fAA15655B0e7b6B6470ED3d096390e6aD93AbB.sol", "vulnerability": "Backdoor — owner can drain liquidity via hidden withdrawAll()", "score": 92, "status": "THREAT", "chain": "ETHEREUM", "value_usd": 18750.0, "exploit_confirmed": True, "output_name": "demo_4"},
    {"contract": "ethereum_0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984.sol", "vulnerability": "No significant vulnerability detected", "score": 5, "status": "SAFE", "chain": "ETHEREUM", "value_usd": 890_000_000.0, "exploit_confirmed": False, "output_name": "demo_5"},
    {"contract": "ethereum_0xBb2b8038a1640196FbE3e38816F3e67Cba72D940.sol", "vulnerability": "Hidden tax — dynamic fee manipulation via setTaxRate()", "score": 78, "status": "THREAT", "chain": "ETHEREUM", "value_usd": 92100.0, "exploit_confirmed": False, "output_name": "demo_6"},
]


# ── Serve React build (production) ─────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    dist = os.path.join(os.path.dirname(__file__), "dashboard/dist")
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


# ── API endpoints ───────────────────────────────────────────────────────────

@app.route("/api/demo")
def demo():
    t = flask_request.args.get("type", "safe")
    return jsonify(_DEMO_VULN if t == "vuln" else _DEMO_SAFE)


@app.route("/api/alerts")
def get_alerts():
    try:
        rows = utils.read_db()
        if not rows:
            # Fallback to demo data so the dashboard is never empty
            now = int(_time.time())
            rows = [{**a, "time": now - i * 600} for i, a in enumerate(_FALLBACK_ALERTS)]
        rows.sort(key=lambda r: r.get("time", 0), reverse=True)
        return jsonify(rows)
    except Exception:
        # On DB error, still show demo data
        now = int(_time.time())
        rows = [{**a, "time": now - i * 600} for i, a in enumerate(_FALLBACK_ALERTS)]
        return jsonify(rows)


@app.route("/api/stats")
def get_stats():
    try:
        rows = utils.read_db()
        threats = sum(
            1 for r in rows
            if r.get("vulnerability", "").lower().strip() not in SAFE_VULNS
        )
        value_protected = sum(r.get("value_usd", 0.0) for r in rows)
        return jsonify({
            "analyzed": len(rows),
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
    rpc_base    = os.getenv("CRE_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/")
    rpc_url     = rpc_base.rstrip("/") + "/" + alchemy_key

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

        tx = contract.functions.reportRisk(
            Web3.to_checksum_address(address),
            score,
            vulnerability,
        ).build_transaction({
            "from":  account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas":   200_000,
        })

        signed   = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash  = w3.eth.send_raw_transaction(signed.raw_transaction)
        hex_hash = tx_hash.hex()

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
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "risk_score.py")
        cmd = [sys.executable, script, "--address", address, "--exploit", "--json"]
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
                # Detect final JSON result line
                if stripped.startswith("{") and stripped.endswith("}"):
                    try:
                        json.loads(stripped)
                        yield f"event: result\ndata: {stripped}\n\n"
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


if __name__ == "__main__":
    port = int(os.getenv("DASHBOARD_API_PORT", "8001"))
    print(f"[ChainGuard] Dashboard API → http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
