# ChainGuard CRE Integration

This folder contains the Chainlink Runtime Environment (CRE) workflow that orchestrates automated blockchain risk detection and onchain reporting.

## Overview

The ChainGuard CRE workflow integrates:
1. **Blockchain Data** - Contract addresses from Ethereum, Base, Arbitrum
2. **External APIs** - Etherscan for verified source code
3. **AI Analysis** - Google Gemini Flash for vulnerability detection
4. **Chainlink Data Feeds** - ETH/USD pricing for contract value assessment
5. **Onchain Write** - Risk reports to immutable RiskRegistry contract

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CRE Workflow Orchestration                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Trigger (Cron: */10 * * * * or Event-driven)            │
│                          ↓                                    │
│  2. Input: target_address (contract to analyze)              │
│                          ↓                                    │
│  3. Command: risk_score.py --address 0x... --json           │
│     ├─ Fetch source from Etherscan                          │
│     ├─ Get balance via Chainlink Price Feeds                │
│     └─ AI vulnerability analysis (Gemini Flash)             │
│                          ↓                                    │
│  4. Parse JSON output (score, vulnerability, value_usd)      │
│                          ↓                                    │
│  5. EVM Transaction: RiskRegistry.reportRisk(...)           │
│     └─ Writes immutable onchain record                      │
│                          ↓                                    │
│  6. Output: tx_hash, risk_score, vulnerability              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Files

- [chainguard-risk/workflow.yaml](chainguard-risk/workflow.yaml) – **Main CRE workflow definition**
- [chainguard-risk/workflow.ts](chainguard-risk/workflow.ts) – TypeScript SDK alternative
- [contracts/RiskRegistry.sol](contracts/RiskRegistry.sol) – Onchain registry for risk reports

## Environment Variables

Configure these in your `.env` file:

### Required

```bash
# Blockchain RPC (for reading state and writing transactions)
CRE_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# RiskRegistry contract address (after deployment)
RISK_REGISTRY_ADDRESS=0x...

# API Keys
ALCHEMY_API_KEY=your_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key
GOOGLE_API_KEY=your_google_api_key

# Private key for signing transactions (DO NOT commit!)
PRIVATE_KEY=0x...
```

### Optional (Chainlink Integration)

```bash
# Chainlink Price Feeds (JSON format)
CHAINLINK_PRICE_FEEDS='{"ETHEREUM":{"ETH_USD":"0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"}}'

# Risk API endpoint (if running remotely)
RISK_API_HOST=127.0.0.1
RISK_API_PORT=8000
```

## Setup Guide

### 1. Deploy RiskRegistry Contract

```bash
# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Deploy to Sepolia testnet
forge create contracts/RiskRegistry.sol:RiskRegistry \
  --rpc-url $CRE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --verify

# Copy deployed address
export RISK_REGISTRY_ADDRESS=0x...
```

### 2. Start ChainGuard Risk API

```bash
# From project root
cd ../..
source .venv/bin/activate
python risk_api.py

# API will be available at http://127.0.0.1:8000
# Test: curl http://127.0.0.1:8000/health
```

### 3. Test CLI Scorer (Used by CRE)

```bash
# Test the risk scoring CLI directly
python risk_score.py \
  --address 0x... \
  --chain ETHEREUM \
  --json

# Expected output:
# {
#   "address": "0x...",
#   "chain": "ETHEREUM",
#   "value_usd": 150.25,
#   "score": 87,
#   "vulnerability": "Unchecked external call"
# }
```

### 4. Run CRE Workflow

#### Option A: Using CRE CLI (Recommended)

```bash
# Install Chainlink CRE CLI
npm install -g @chainlink/cre-cli

# Run workflow
cre workflow run chainguard-risk/workflow.yaml \
  --input target_address=0xYourContractAddress \
  --env-file ../../.env

# Expected output:
# ✓ Step 1: score_contract completed
# ✓ Step 2: write_registry completed (tx: 0x...)
# ✓ Workflow completed successfully
```

#### Option B: Using TypeScript SDK

```bash
# Install dependencies
cd chainguard-risk
npm install

# Run workflow
ts-node workflow.ts 0xYourContractAddress
```

### 5. Verify Onchain Record

```bash
# Read from RiskRegistry
cast call $RISK_REGISTRY_ADDRESS \
  "reports(address)(uint256,string,uint256)" \
  0xYourContractAddress \
  --rpc-url $CRE_RPC_URL

# Or use Etherscan UI
echo "https://sepolia.etherscan.io/address/$RISK_REGISTRY_ADDRESS#readContract"
```

## Workflow Simulation Example

```bash
# 1. Deploy RiskRegistry (one-time)
forge create contracts/RiskRegistry.sol:RiskRegistry \
  --rpc-url $CRE_RPC_URL \
  --private-key $PRIVATE_KEY

# 2. Set address in .env
echo "RISK_REGISTRY_ADDRESS=0x..." >> ../../.env

# 3. Start Risk API in background
cd ../..
source .venv/bin/activate
python risk_api.py &

# 4. Run CRE workflow
cd cre
cre workflow run chainguard-risk/workflow.yaml \
  --input target_address=0x... \
  --env-file ../.env

# 5. Check result
cast call $RISK_REGISTRY_ADDRESS \
  "reports(address)" 0x... \
  --rpc-url $CRE_RPC_URL
```

## Integration with Chainlink

### 1. Chainlink Data Feeds

The risk scorer uses Chainlink Price Feeds to determine contract value:

```python
# In utils.py
chainlink_price = get_chainlink_price("ETHEREUM", feed_address)
# Uses AggregatorV3 interface to get ETH/USD price
```

This ensures accurate, decentralized pricing for risk assessment.

### 2. CRE Orchestration

CRE acts as the orchestration layer connecting:
- **Onchain data** (contract addresses, balances)
- **Off-chain compute** (AI analysis, source code fetching)
- **Onchain reporting** (RiskRegistry transactions)

### 3. Automation Potential

The workflow can be extended with Chainlink Automation:
- Trigger on new contract deployment events
- Schedule periodic rescans of high-value contracts
- Alert on risk score changes

## Troubleshooting

### "Command not found: cre"

Install Chainlink CRE CLI:
```bash
npm install -g @chainlink/cre-cli
```

### "API connection refused"

Ensure `risk_api.py` is running:
```bash
python risk_api.py
# Should output: [API] Risk API listening on http://127.0.0.1:8000
```

### "Transaction failed: insufficient funds"

Ensure your wallet has testnet ETH:
```bash
# Get Sepolia ETH from faucet
echo "https://sepoliafaucet.com"
```

### "Etherscan API rate limit"

Use multiple API keys or add delay:
```bash
# In .env
ETHERSCAN_API_KEY=key1,key2,key3
```

## Production Deployment

For production deployment:

1. **Use mainnet RPCs** and price feeds
2. **Deploy RiskRegistry** to mainnet (gas cost: ~200k)
3. **Configure Chainlink Automation** for continuous monitoring
4. **Set up monitoring** for RiskReported events
5. **Integrate with protocols** via RiskRegistry.reports(address)

## License

MIT
