#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

import requests
from dotenv import load_dotenv

from golden_bridge import get_balance_usd, call_gemini_flash_score
import static_scan


def fetch_verified_source(address, api_key):
    url = (
        "https://api.etherscan.io/v2/api"
        f"?chainid=1&module=contract&action=getsourcecode&address={address}&apikey={api_key}"
    )
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "1" or not data.get("result"):
        raise RuntimeError(f"Etherscan error: {data}")
    src = data["result"][0].get("SourceCode", "")
    if not src:
        raise RuntimeError("No verified source returned.")
    return src


class RiskHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._send_json(200, {"ok": True})

        if parsed.path != "/score":
            return self._send_json(404, {"error": "not_found"})

        qs = parse_qs(parsed.query)
        address = (qs.get("address") or [""])[0].strip()
        chain = (qs.get("chain") or ["ETHEREUM"])[0].upper()

        if not address.startswith("0x") or len(address) != 42:
            return self._send_json(400, {"error": "invalid_address"})

        if chain != "ETHEREUM":
            return self._send_json(400, {"error": "unsupported_chain"})

        api_key = os.getenv("ETHERSCAN_API_KEY")
        if not api_key:
            return self._send_json(500, {"error": "missing_etherscan_key"})

        try:
            source = fetch_verified_source(address, api_key)
            filename = f"ETHEREUM_{address}.sol"
            value_usd = get_balance_usd(filename, "EVM")
            scan = static_scan.analyze(source)
            score, vuln = call_gemini_flash_score(source, "ETHEREUM", value_usd, static_context=scan['prompt_context'])
        except Exception as e:
            return self._send_json(500, {"error": str(e)})

        return self._send_json(
            200,
            {
                "address": address,
                "chain": chain,
                "value_usd": value_usd,
                "score": score,
                "vulnerability": vuln,
            },
        )


def main():
    load_dotenv()
    host = os.getenv("ANTIGRAVITY_API_HOST", "127.0.0.1")
    port = int(os.getenv("ANTIGRAVITY_API_PORT", "8000"))
    server = HTTPServer((host, port), RiskHandler)
    print(f"[API] Antigravity Risk API listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
