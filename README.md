# ChainGuard

**Real-time DeFi risk sentinel — Chainlink Hackathon 2025, Risk & Compliance Track**

ChainGuard monitors Uniswap V3/V4 deployments on Ethereum, identifies malicious contracts before users interact with them, and posts immutable risk reports on-chain through Chainlink CRE.


## The Problem

Every day, hundreds of new ERC20 tokens and Uniswap V4 hooks are deployed on mainnet. A significant fraction are honeypots, rug pulls, or backdoored contracts. By the time a security researcher flags one manually, users have already lost funds.

ChainGuard closes that gap — fully automated, from deployment event to on-chain risk record.


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
[3] Static Scanner       static_scan.py
    Deterministic regex pass over the Solidity source.
    Fast execution providing strict Yes/No flags for known patterns.
      │
      ▼
[4] Antigravity Agent    risk_score.py
    Google Gemini 2.0 Flash with a hardened security prompt.
    Takes the code + exact deterministic regex flags and reasons over them.
    Returns: continuous Risk Score 0–100 + vulnerability classification.
      │
      ▼
[5] Exploit Generation   exploit_runner.py / generate_pocs.md
    If score >= 70, the Antigravity Agent writes a custom Foundry PoC.
    The exploit is tested against a live mainnet fork. If it passes,
    the vulnerability is strictly confirmed with zero false positives.
      │
      ▼
[6] Chainlink CRE        cre/chainguard-risk/workflow.yaml
    Off-chain compute workflow that orchestrates the final submission.
    Writes the confirmed risk report to RiskRegistry.sol on Sepolia.
      │
      ▼
[7] Dashboard            dashboard/
    React + Vite monitoring UI (port 5173).
    Live tracking of EVM events, AI scoring, and Exploit Agent status.
```


## Why This Architecture Wins

**Determinism + intelligence, paired with mathematical proof.**

AI models are incredibly good at finding weird, complex vulnerabilities in smart contracts, but they hallucinate. Static analysis tools don't hallucinate (a regex match is a mathematical certainty), but they are rigid and only output binary Yes/No flags on known issues.

ChainGuard combines both:
1. **Static Analysis** provides the deterministic baseline (Yes/No flags).
2. **Gemini 2.0 Flash** provides intelligent reasoning, merging the deterministic flags with its own contextual reading to output a continuous **Risk Score (0-100)**.
3. **Foundry Exploit Generation**: When Gemini flags a high risk, the Antigravity Agent is tasked to write a Foundry `.t.sol` test against a mainnet fork. If the exploit passes, the funds can mathematically be drained.

This guarantees reproducibility, auditability, and a hard baseline with zero false positives.


## Chainlink Integration

| Component | File | Role |
|---|---|---|
| Chainlink Data Feeds | [utils.py](utils.py) | ETH/USD price used for contract valuation |
| Chainlink CRE Workflow | [cre/chainguard-risk/workflow.yaml](cre/chainguard-risk/workflow.yaml) | Orchestrates the full pipeline off-chain |
| Chainlink CRE SDK | [cre/chainguard-risk/workflow.ts](cre/chainguard-risk/workflow.ts) | TypeScript SDK alternative |
| RiskRegistry (Solidity) | [contracts/RiskRegistry.sol](contracts/RiskRegistry.sol) | On-chain immutable risk record (Sepolia: `0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821`) |
| Risk API (CRE adapter) | [risk_api.py](risk_api.py) | HTTP bridge consumed by the CRE workflow |

The CRE workflow triggers on a cron (`*/10 * * * *`) or contract deployment event, calls the Risk API, and writes the result on-chain. Any protocol can then query `RiskRegistry.risks[address]` before interacting with an unknown contract.


## Quick Start

**Requirements:** Python 3.9+, Node 18+, Foundry, an Alchemy key, an Etherscan key, a Google AI key.

```bash
# 1. Install Python dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Install dashboard dependencies
cd dashboard && npm install && cd ..

# 3. Configure environment
cp .env-example .env
# Fill in: ALCHEMY_API_KEY, ETHERSCAN_API_KEY, GOOGLE_API_KEY, PRIVATE_KEY

# 4. Start everything
./start.sh
```

Open **http://localhost:5173** — click **✕ Honeypot** to run a live demo scan.

**Score a contract manually (Antigravity CLI):**

```bash
python risk_score.py --address 0xYourContract --exploit --json
```

**Generate a Foundry PoC exploit (Antigravity IDE):**

```
# Open the project in Antigravity, then type:
/generate_pocs
# PoC appears in poc_requests/done/
```


## On-Chain Flow (Dashboard)

When a contract scores ≥ 70/100:
1. Dashboard auto-calls `/api/submit` → signs tx with your Sepolia wallet
2. `RiskRegistry.reportRisk(address, score, vulnerability)` is written on-chain
3. Popup shows the tx hash + Etherscan link
4. A PoC request is queued in `poc_requests/` for Antigravity to process

## PoC Generation (Antigravity IDE)

After a scan queues a request in `poc_requests/`, open the project in Antigravity and run `/generate_pocs`. The agent:
1. Reads the exploit request (address, vulnerability, fork URL)
2. Fetches the verified source from Etherscan
3. Writes `Exploit.t.sol` and runs `forge test --fork-url`
4. Iterates until the test passes
5. Moves the request to `poc_requests/done/`

In production, requests are created automatically when the EVM Sentry flags a new Uniswap V3/V4 pool with score ≥ 70. The PoC is generated against the real deployed contract via mainnet fork.

**Example (test run):** The DAO reentrancy — 10× recursive drain, 54.18 gwei extracted, 3/3 assertions passed.


## Deploy the On-Chain Registry

```bash
# Deploy RiskRegistry to Sepolia
python contracts/deploy.py

# Already deployed at: 0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821
# https://sepolia.etherscan.io/address/0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821
```


## Project Structure

```
chainlink-hack/
├── sentry_evm.py              # EVM event listener (V3 PoolCreated + V4 Initialize)
├── golden_bridge.py           # Value filter + AI scoring orchestrator
├── static_scan.py             # Deterministic pre-analysis (regex + Slither)
├── risk_score.py              # Antigravity CLI — standalone scorer + exploit runner
├── exploit_runner.py          # Foundry fork-test exploit runner
├── risk_api.py                # HTTP API consumed by Chainlink CRE
├── dashboard_api.py           # Dashboard bridge (port 8001) + SSE streaming
├── utils.py                   # Chainlink price feeds + shared helpers
├── start.sh / stop.sh         # Start/stop all services
├── contracts/
│   ├── RiskRegistry.sol       # On-chain risk registry (deployed on Sepolia)
│   └── deploy.py              # Deployment script (forge create)
├── cre/
│   └── chainguard-risk/
│       ├── workflow.yaml      # Chainlink CRE workflow definition
│       └── workflow.ts        # CRE TypeScript SDK version
├── dashboard/                 # React + Vite monitoring dashboard
├── poc_requests/              # Queued exploit requests (processed by /generate_pocs)
│   └── done/                  # Completed PoC Solidity files
└── .agent/
    └── workflows/
        └── generate_pocs.md   # Antigravity IDE skill for Foundry PoC generation
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

MIT — built for defensive security research and protocol risk management.
