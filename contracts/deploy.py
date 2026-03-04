#!/usr/bin/env python3
"""Deploy RiskRegistry.sol to Sepolia and update .env"""
import os, sys, subprocess, json, re
from dotenv import load_dotenv

load_dotenv()

PRIVATE_KEY  = os.getenv("PRIVATE_KEY", "")
ALCHEMY_KEY  = os.getenv("ALCHEMY_API_KEY", "")
RPC_URL      = f"https://eth-sepolia.g.alchemy.com/v2/{ALCHEMY_KEY}"
SOL_FILE     = os.path.join(os.path.dirname(__file__), "RiskRegistry.sol")
ENV_FILE     = os.path.join(os.path.dirname(__file__), "..", ".env")

if not PRIVATE_KEY:
    print("❌ PRIVATE_KEY missing in .env"); sys.exit(1)
if not ALCHEMY_KEY:
    print("❌ ALCHEMY_API_KEY missing in .env"); sys.exit(1)

print("🚀 Deploying RiskRegistry to Sepolia...")
result = subprocess.run([
    "forge", "create",
    SOL_FILE + ":RiskRegistry",
    "--rpc-url",    RPC_URL,
    "--private-key", PRIVATE_KEY,
    "--broadcast",
], capture_output=True, text=True)

print(result.stdout)
if result.returncode != 0:
    print("❌ Deploy failed:", result.stderr); sys.exit(1)

# Parse deployed address
match = re.search(r"Deployed to:\s*(0x[0-9a-fA-F]{40})", result.stdout)
if not match:
    print("❌ Could not parse deployed address"); sys.exit(1)

address = match.group(1)
print(f"\n✅ RiskRegistry deployed: {address}")
print(f"   https://sepolia.etherscan.io/address/{address}\n")

# Update .env
with open(ENV_FILE, "r") as f:
    env_content = f.read()

if "RISK_REGISTRY_ADDRESS=" in env_content:
    env_content = re.sub(r"RISK_REGISTRY_ADDRESS=.*", f"RISK_REGISTRY_ADDRESS={address}", env_content)
else:
    env_content += f"\nRISK_REGISTRY_ADDRESS={address}\n"

with open(ENV_FILE, "w") as f:
    f.write(env_content)

print(f"✅ .env updated with RISK_REGISTRY_ADDRESS={address}")
print("\nRestart dashboard_api.py to apply the change.")
