# ChainGuard

**Real-time DeFi risk sentinel — Chainlink Hackathon 2026, Risk & Compliance Track**

ChainGuard monitors Uniswap V3/V4 deployments on Ethereum, identifies malicious contracts before users interact with them, and posts immutable risk reports on-chain through Chainlink CRE.


## The Problem

Every day, hundreds of new ERC20 tokens and Uniswap V4 hooks are deployed on mainnet. A significant fraction are honeypots, rug pulls, or backdoored contracts. By the time a security researcher flags one manually, users have already lost funds.

ChainGuard closes that gap — fully automated, from deployment event to on-chain risk record.


## How It Works

```
Ethereum mainnet
      |
      v
[1] EVM Sentry          sentry_evm.py
    Listens for PoolCreated (V3) and Initialize (V4) events in real time.
    Fetches verified source code from Etherscan. Ignores known-safe tokens.
      |
      v
[2] Golden Bridge        golden_bridge.py
    Fetches contract USD value via Chainlink Price Feeds.
    Filters out zero-value contracts. Enriches context for scoring.
      |
      v
[3] Static Scanner       static_scan.py
    Deterministic regex pass over the Solidity source.
    If a HIGH finding is detected, the verdict is immediate — no AI call made.
      |
      v
[4] Antigravity Agent    risk_score.py
    Second layer — only triggered if regex found nothing critical.
    Google Gemini 2.0 Flash reasons over the source code and static flags.
    Returns: continuous Risk Score 0-100 + vulnerability classification.
      |
      v
[5] Exploit Generation   (two-tier system)
    |
    +-- Tier 1 — Batch Runner    batch_exploit.py          (fast, automated)
    |   Template-based: if the vulnerability flag matches a proven .sol template,
    |   Gemini adapts it for the new target and runs forge test on a mainnet fork.
    |   Confirmed exploits go straight to done/. No human needed.
    |
    +-- Tier 2 — Antigravity IDE  .agent/workflows/generate_pocs.md  (novel vectors)
        Invoked for unmatched or failed requests. The agent writes a custom
        Foundry PoC from scratch, iterates until forge test passes,
        then saves the new PoC as a reusable template for future batch runs.
      |
      v
[6] Chainlink CRE        cre/chainguard-risk/
    HTTP-triggered CRE workflow calls the Risk API, aggregates results via
    consensus, and writes the confirmed risk report to RiskRegistry.sol on Sepolia.
    Simulate: cre workflow simulate chainguard-risk --target staging-settings
      |
      v
[7] Dashboard            dashboard/
    React + Vite monitoring UI (port 5173).
    Live tracking of EVM events, AI scoring, and Exploit Agent status.
```


## Why This Architecture Wins

**Determinism + intelligence, paired with mathematical proof.**

AI models are incredibly good at finding weird, complex vulnerabilities in smart contracts, but they hallucinate. Static analysis tools don't hallucinate (a regex match is a mathematical certainty), but they are rigid and only output binary Yes/No flags on known issues.

ChainGuard combines both:
1. **Static Analysis** runs first and is deterministic. A HIGH regex match instantly sets the verdict — no AI call is made.
2. **Gemini 2.0 Flash** is the second layer, only invoked when regex finds nothing critical. It reasons over the source code and outputs a continuous **Risk Score (0-100)**.
3. **Two-Tier Exploit Generation**: When the risk is confirmed (score >= 70 or HIGH regex hit):
   - **Batch Runner** instantly adapts a proven template for the exact vulnerability flag. Template correctness was already verified on a previous contract — zero iteration needed.
   - **Antigravity IDE Agent** handles novel vectors. Writes a custom Foundry PoC, iterates until it passes, saves the result as a new template for future batch runs.
4. **Chainlink CRE** orchestrates the final step: calling the Risk API off-chain, reaching consensus across DON nodes, and writing the immutable result on-chain.

This guarantees reproducibility, auditability, and a hard baseline with zero false positives.


## Chainlink Integration

| Component | File | Role |
|---|---|---|
| Chainlink Data Feeds | [utils.py](utils.py) | ETH/USD price used for contract valuation in golden_bridge.py |
| Chainlink CRE Workflow settings | [cre/chainguard-risk/workflow.yaml](cre/chainguard-risk/workflow.yaml) | Workflow definition — run with `cre workflow simulate` |
| Chainlink CRE Workflow entry point | [cre/chainguard-risk/main.ts](cre/chainguard-risk/main.ts) | HTTP trigger wired to the CRE SDK runner |
| Chainlink CRE HTTP + EVM logic | [cre/chainguard-risk/httpCallback.ts](cre/chainguard-risk/httpCallback.ts) | Calls Risk API, reaches DON consensus, writes on-chain via EVMClient |
| RiskRegistry (Solidity) | [contracts/RiskRegistry.sol](contracts/RiskRegistry.sol) | On-chain immutable risk record — receives CRE writeReport calls |
| Risk API (CRE adapter) | [risk_api.py](risk_api.py) | HTTP bridge consumed by the CRE workflow |

**CRE Workflow simulation:**
```bash
cd cre/chainguard-risk
cre workflow simulate chainguard-risk --target staging-settings
```

The CRE workflow is HTTP-triggered (by the EVM Sentry or manually). It calls the ChainGuard Risk API, aggregates the result via `consensusIdenticalAggregation`, encodes it as ABI data, signs a CRE report, and writes it to `RiskRegistry.sol` on Sepolia via `evmClient.writeReport`. Any protocol can then query `RiskRegistry.risks[address]` before interacting with an unknown contract.


## Quick Start

**Requirements:** Python 3.9+, Node 18+, Foundry, an Alchemy key, an Etherscan key, a Google AI key.

```bash
# 1. Install Python dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Install CRE workflow dependencies
cd cre/chainguard-risk && bun install && cd ../..

# 3. Configure environment
cp .env-example .env
# Fill in: ALCHEMY_API_KEY, ETHERSCAN_API_KEY, GOOGLE_API_KEY, PRIVATE_KEY

# 4. Start everything
./start.sh
```

Open **http://localhost:5173** — click **Honeypot** to run a live demo scan.

**Simulate the CRE Workflow:**
```bash
cd cre/chainguard-risk
cre workflow simulate chainguard-risk --target staging-settings
```

**Score a contract manually (Antigravity CLI):**
```bash
python risk_score.py --address 0xYourContract --exploit --json
```

**Generate a Foundry PoC exploit (Antigravity IDE — novel vectors only):**
```
# Open the project in Antigravity, then type:
/generate_pocs
# Batch runner fires first; novel vectors handled by the IDE agent.
# PoCs appear in poc_requests/done/, new templates in poc_requests/templates/
```


## On-Chain Flow (Dashboard)

When a contract scores >= 70/100:
1. A PoC request is queued in `poc_requests/` for the exploit pipeline
2. **Tier 1** — Batch Runner attempts a fast template-based exploit first
3. **Tier 2** — Antigravity IDE agent handles unmatched/novel vectors, saves a new template
4. The CRE workflow writes the confirmed risk report to `RiskRegistry.sol` on Sepolia
5. Dashboard shows the Etherscan tx link — the record is immutable


## PoC Generation (Two-Tier System)

**Tier 1 — Batch Runner (`batch_exploit.py`)**
1. Reads the exploit request (address, vulnerability flag, fork URL)
2. Looks up a proven `.sol` template in `poc_requests/templates/<flag>.sol`
3. Sends template + new contract source to Gemini (falls back to Claude) for adaptation
4. Runs `forge test --fork-url` on the adapted exploit
5. On success: saves forge output + moves request to `poc_requests/done/`
6. On failure or no template: leaves request for the IDE agent

**Tier 2 — Antigravity IDE Agent (`/generate_pocs`)**
1. Picks up requests not resolved by the batch runner
2. Fetches verified source from Etherscan
3. Writes `Exploit.t.sol` from scratch and runs `forge test --fork-url`
4. Iterates until the test passes
5. Saves the proven PoC as `poc_requests/templates/<flag>.sol` for future batch runs
6. Moves the request to `poc_requests/done/`

**Continuous polling:** `start.sh` launches the Batch Runner as a background daemon that polls every 60 seconds. For novel vectors with no template, the Antigravity IDE agent (`/generate_pocs`) handles the rest.

**Example (test run):** The DAO reentrancy — 10x recursive drain, 54.18 gwei extracted, 3/3 assertions passed.


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
|-- sentry_evm.py              # EVM event listener (V3 PoolCreated + V4 Initialize)
|-- golden_bridge.py           # Value filter + Chainlink price feed + AI scoring
|-- static_scan.py             # Deterministic pre-analysis (regex)
|-- risk_score.py              # Antigravity CLI — standalone scorer + exploit runner
|-- exploit_runner.py          # Foundry fork-test exploit runner
|-- batch_exploit.py           # Tier-1 batch runner — template-based automated exploits
|-- risk_api.py                # HTTP API consumed by Chainlink CRE workflow
|-- dashboard_api.py           # Dashboard bridge (port 8001) + SSE streaming
|-- utils.py                   # Chainlink Data Feeds + shared helpers
|-- start.sh / stop.sh         # Start/stop all services
|-- contracts/
|   |-- RiskRegistry.sol       # On-chain risk registry (Sepolia: 0x60A9...a821)
|   +-- deploy.py              # Deployment script (forge create)
|-- cre/
|   +-- chainguard-risk/
|       |-- workflow.yaml      # CRE workflow settings (simulate / deploy)
|       |-- main.ts            # CRE SDK entry point — HTTP trigger
|       |-- httpCallback.ts    # Risk API call + DON consensus + EVM write
|       +-- config.staging.json
|-- dashboard/                 # React + Vite monitoring dashboard
|-- poc_requests/              # Queued exploit requests
|   |-- templates/             # Proven Foundry PoC templates (by vulnerability flag)
|   +-- done/                  # Completed PoC files + forge test outputs
+-- .agent/
    +-- workflows/
        +-- generate_pocs.md   # Antigravity IDE skill: batch runner then novel vectors
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
