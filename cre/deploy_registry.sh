#!/usr/bin/env bash
# Deploy RiskRegistry.sol to Sepolia and update config.staging.json
# Usage: cd cre && bash deploy_registry.sh

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load env
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

if [ -z "$CRE_RPC_URL" ]; then
  echo "ERROR: CRE_RPC_URL not set in .env"
  exit 1
fi
if [ -z "$PRIVATE_KEY" ]; then
  echo "ERROR: PRIVATE_KEY not set in .env"
  exit 1
fi

echo "Deploying RiskRegistry.sol to Sepolia..."

OUTPUT=$(forge create "$SCRIPT_DIR/contracts/RiskRegistry.sol:RiskRegistry" \
  --rpc-url "$CRE_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast)

echo "$OUTPUT"

# Extract deployed address
REGISTRY_ADDRESS=$(echo "$OUTPUT" | grep "Deployed to:" | awk '{print $3}')

if [ -z "$REGISTRY_ADDRESS" ]; then
  echo "ERROR: Could not extract deployed address from forge output."
  exit 1
fi

echo ""
echo "✅ RiskRegistry deployed at: $REGISTRY_ADDRESS"

# Update config.staging.json
CONFIG="chainguard-risk/config.staging.json"
python3 -c "
import json, sys
with open('$CONFIG') as f:
    c = json.load(f)
c['evms'][0]['registryAddress'] = '$REGISTRY_ADDRESS'
with open('$CONFIG', 'w') as f:
    json.dump(c, f, indent=2)
print('✅ Updated $CONFIG with registry address.')
"

echo ""
echo "Next steps:"
echo "  1. Set workflow-owner-address in chainguard-risk/workflow.yaml"
echo "  2. Run: cd cre && cre workflow simulate chainguard-risk --target staging-settings"
