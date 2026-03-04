#!/usr/bin/env python3
import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

from golden_bridge import get_balance_usd, call_antigravity_score
import static_scan
import exploit_runner
import utils

EXPLOIT_SCORE_THRESHOLD = 70


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


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Antigravity CLI risk scorer")
    parser.add_argument("--address", required=True)
    parser.add_argument("--chain", default="ETHEREUM")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--exploit", action="store_true",
                        help="If score >= 70, generate and run a Foundry PoC exploit on a mainnet fork")
    args = parser.parse_args()

    address = args.address.strip()
    chain = args.chain.upper()
    if not address.startswith("0x") or len(address) != 42:
        print("Invalid address format.", file=sys.stderr)
        return 1
    if chain != "ETHEREUM":
        print("Unsupported chain.", file=sys.stderr)
        return 1

    api_key = os.getenv("ETHERSCAN_API_KEY")
    if not api_key:
        print("Missing ETHERSCAN_API_KEY in environment.", file=sys.stderr)
        return 1

    try:
        source = fetch_verified_source(address, api_key)
        filename = f"ETHEREUM_{address}.sol"
        value_usd = get_balance_usd(filename, "EVM")
        scan = static_scan.analyze(source)
        score, vuln = call_antigravity_score(source, "ETHEREUM", value_usd, scan_result=scan)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    # --- Exploit confirmation ---
    exploit_result = None
    if args.exploit and score >= EXPLOIT_SCORE_THRESHOLD:
        rpc_url = utils.get_fork_rpc_url(chain)
        if not rpc_url:
            print("⚠️  No RPC URL available for fork testing (set ALCHEMY_API_KEY or ETH_RPC_URL).", file=sys.stderr)
        else:
            print(f"\n🔥 Score {score} >= {EXPLOIT_SCORE_THRESHOLD} — launching exploit confirmation...\n")
            exploit_result = exploit_runner.confirm_exploit(
                source_code=source,
                vulnerability=vuln,
                contract_address=address,
                rpc_url=rpc_url,
            )
    elif args.exploit and score < EXPLOIT_SCORE_THRESHOLD:
        print(f"\nℹ️  Score {score} < {EXPLOIT_SCORE_THRESHOLD} — skipping exploit (not risky enough).\n",
              file=sys.stderr)

    # --- Output ---
    result = {
        "address": address,
        "chain": chain,
        "value_usd": value_usd,
        "score": score,
        "vulnerability": vuln,
    }
    if exploit_result is not None:
        result["exploit_confirmed"] = exploit_result["confirmed"]
        result["exploit_output"] = exploit_result.get("output", "")
        result["exploit_error"] = exploit_result.get("error", "")

    if args.json:
        print(json.dumps(result))
    else:
        print(f"Address:       {address}")
        print(f"Chain:         {chain}")
        print(f"Value USD:     {value_usd:.2f}")
        print(f"Score:         {score}")
        print(f"Vulnerability: {vuln}")
        if exploit_result is not None:
            print()
            if exploit_result["confirmed"]:
                print("✅ EXPLOIT CONFIRMED — vulnerability is real and exploitable!")
            else:
                print("❌ Exploit not confirmed — false positive or incomplete PoC.")
            if exploit_result.get("error"):
                print(f"   Error: {exploit_result['error']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
