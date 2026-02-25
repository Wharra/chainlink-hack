# ChainGuard

**Real-time DeFi risk sentinel - Chainlink Hackathon 2025, Risk & Compliance Track**

ChainGuard monitors Uniswap V3/V4 deployments on Ethereum, identifies malicious contracts before users interact with them, and posts immutable risk reports on-chain through Chainlink CRE.


## The Problem

Every day, hundreds of new ERC20 tokens and Uniswap V4 hooks are deployed on mainnet. A significant fraction are honeypots, rug pulls, or backdoored contracts. By the time a security researcher flags one manually, users have already lost funds.

ChainGuard closes that gap - fully automated, from deployment event to on-chain risk record.


## How It Works

```
Ethereum mainnet
      │
      ▼
[1] EVM Sentry          sentry_evm.py
    Listens for PoolCreated (V3) and Initialize (V4) events in real time.
    Fetches verified source code from Etherscan. Ignores known-safe tokens.
      │
      ▼
[2] Golden Bridge        golden_bridge.py
    Fetches contract USD value via Chainlink Price Feeds.
    Filters out zero-value contracts. Enriches context for scoring.
      │
      ▼
[3] Static Scan          static_scan.py
    Deterministic regex pass over the Solidity source (<10 ms).
    16 patterns across HIGH / MEDIUM / LOW severity.
    Optional Slither integration for deeper AST-level checks.
    Findings are injected into the AI prompt as structured context.
      │
      ▼
[4] Antigravity          risk_score.py
    Google Gemini Flash with a hardened security prompt.
    Reasons over code + static findings to detect both known patterns
    and novel, unnamed attack vectors no rule-based tool has seen.
    Returns: risk score 0–100 + vulnerability classification.
      │
      ▼
[5] Risk API             risk_api.py
    Flask HTTP server (port 8000). Called by the Chainlink CRE workflow.
    Exposes /score and /health endpoints.
      │
      ▼
[6] Chainlink CRE        cre/chainguard-risk/workflow.yaml
    Off-chain compute workflow that orchestrates the full pipeline.
    Writes the risk report to RiskRegistry.sol on Sepolia.
    Emits RiskReported(address, score, vulnerability, timestamp).
```


## Why This Architecture Wins

**Determinism + intelligence, not a choice between them.**

Static analysis (Slither) is fully deterministic - the same contract always produces the same findings. That guarantees reproducibility, auditability, and a hard baseline that judges and auditors can verify.

Gemini is the opposite: it reasons, infers, and generalizes - catching novel, unnamed attack vectors that no rule-based tool has ever classified. The static findings are fed into its prompt, grounding its reasoning in concrete evidence.

Two layers. Neither alone is sufficient.


## Chainlink Integration

| Component | File | Role |
|---|---|---|
| Chainlink Data Feeds | [utils.py](utils.py) | ETH/USD price used for contract valuation |
| Chainlink CRE Workflow | [cre/chainguard-risk/workflow.yaml](cre/chainguard-risk/workflow.yaml) | Orchestrates the full pipeline off-chain |
| Chainlink CRE SDK | [cre/chainguard-risk/workflow.ts](cre/chainguard-risk/workflow.ts) | TypeScript SDK alternative |
| RiskRegistry (Solidity) | [cre/contracts/RiskRegistry.sol](cre/contracts/RiskRegistry.sol) | On-chain immutable risk record |
| Risk API (CRE adapter) | [risk_api.py](risk_api.py) | HTTP bridge consumed by the CRE workflow |

The CRE workflow triggers on a cron (`*/10 * * * *`) or contract deployment event, calls the Risk API, and writes the result on-chain. Any protocol can then query `RiskRegistry.reports[address]` before interacting with an unknown contract.


## Quick Start

**Requirements:** Python 3.9+, Node 18+, an Alchemy key, an Etherscan key, a Google AI key.

```bash
# 1. Install Python dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Fill in: ALCHEMY_API_KEY, ETHERSCAN_API_KEY, GOOGLE_API_KEY

# 3. Start the pipeline (three separate terminals)
python sentry_evm.py       # watches Ethereum for new pools
python golden_bridge.py    # scores contracts as they appear
python risk_api.py         # serves the Chainlink CRE workflow
```

**Score a contract manually (Antigravity CLI):**

```bash
python risk_score.py --address 0xYourContract --chain ETHEREUM --json
```

```json
{
  "address": "0x...",
  "chain": "ETHEREUM",
  "score": 91,
  "vulnerability": "Honeypot - transfer blocked for non-whitelisted addresses"
}
```

**Run the dashboard:**

```bash
python dashboard_api.py    # port 8001
cd dashboard && npm install && npm run dev
```


## Deploy the On-Chain Registry

```bash
# Deploy RiskRegistry to Sepolia
forge create cre/contracts/RiskRegistry.sol:RiskRegistry \
  --rpc-url $CRE_RPC_URL \
  --private-key $PRIVATE_KEY

# Run the CRE workflow
cre workflow run cre/chainguard-risk/workflow.yaml \
  --input target_address=0x... \
  --env-file .env
```


## Project Structure

```
hack_defi/
├── sentry_evm.py              # EVM event listener (V3 PoolCreated + V4 Initialize)
├── golden_bridge.py           # Value filter + AI scoring orchestrator
├── static_scan.py             # Deterministic pre-analysis (regex + Slither)
├── risk_score.py              # Antigravity CLI - standalone Gemini scorer
├── risk_api.py                # HTTP API consumed by Chainlink CRE
├── dashboard_api.py           # Dashboard bridge (port 8001)
├── utils.py                   # Chainlink price feeds + shared helpers
├── prompt_gemini.txt          # Hardened security prompt template
├── cre/
│   ├── chainguard-risk/
│   │   ├── workflow.yaml      # Chainlink CRE workflow definition
│   │   └── workflow.ts        # CRE TypeScript SDK version
│   ├── contracts/
│   │   └── RiskRegistry.sol   # On-chain risk registry
│   └── README.md
├── dashboard/                 # React + Vite monitoring dashboard
└── .env.example
```


## Vulnerability Classes Detected

ChainGuard covers a broad set of known Solidity attack patterns. Antigravity extends coverage to unnamed and novel vectors.

| Category | Examples |
|---|---|
| Honeypot | Transfer whitelist, sell tax >90%, buy-only logic |
| Rug pull | Owner `withdraw()`, uncapped `mint()`, `selfdestruct` drain |
| Backdoor | Hidden `delegatecall`, mutable implementation proxy |
| Access control | `tx.origin` auth, hardcoded timestamp gates |
| Fund drain | `recoverTokens`, unrestricted `transferFrom` |


## License

MIT - built for defensive security research and protocol risk management.
