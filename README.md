<div align="center">

<img src="dashboard/public/img/logo-chainguard.png" alt="ChainGuard" width="120" />

# ChainGuard

**Real-time DeFi risk sentinel**

![Chainlink](https://img.shields.io/badge/Chainlink-CRE%20%2B%20Data%20Feeds-375BD2?style=for-the-badge&logo=chainlink&logoColor=white)
![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet%20%2B%20Sepolia-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-CRE%20Workflow-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Hackathon:** Chainlink Convergence 2026 — **Risk & Compliance Track**

ChainGuard monitors every new Uniswap V3/V4 pool on Ethereum, detects malicious contracts using static analysis + Gemini AI, proves vulnerabilities with Foundry exploits on a mainnet fork, and writes immutable risk reports on-chain via **Chainlink CRE**.

> 🔴 **RiskRegistry live on Sepolia:** [`0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821`](https://sepolia.etherscan.io/address/0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821)

</div>

---

## Chainlink Integration

| Component | File | What it does |
|---|---|---|
| **Chainlink Data Feeds** | [utils.py](utils.py) | ETH/USD price feed — values each contract in USD before analysis |
| **CRE Workflow** (settings) | [cre/chainguard-risk/workflow.yaml](cre/chainguard-risk/workflow.yaml) | Workflow definition — `cre workflow simulate chainguard-risk --target staging-settings` |
| **CRE Workflow** (entry point) | [cre/chainguard-risk/main.ts](cre/chainguard-risk/main.ts) | HTTP trigger wired to the CRE SDK runner |
| **CRE Workflow** (core logic) | [cre/chainguard-risk/httpCallback.ts](cre/chainguard-risk/httpCallback.ts) | Calls Risk API → DON consensus → `evmClient.writeReport` on Sepolia |
| **RiskRegistry.sol** | [contracts/RiskRegistry.sol](contracts/RiskRegistry.sol) | On-chain immutable risk record, written by the CRE workflow |
| **Risk API** (CRE adapter) | [risk_api.py](risk_api.py) | HTTP server consumed by the CRE workflow |

**How the CRE workflow runs:**
```bash
cd cre/chainguard-risk
cre workflow simulate chainguard-risk --target staging-settings
```

The workflow receives an HTTP trigger with a contract address → calls the ChainGuard Risk API (Etherscan + Gemini AI + Chainlink Price Feeds) → aggregates the result via `consensusIdenticalAggregation` across DON nodes → encodes the risk report as ABI data → signs it with ECDSA/keccak256 → writes it to `RiskRegistry.sol` on Sepolia via `evmClient.writeReport`.

---

## The Problem

Every day, hundreds of new tokens and Uniswap hooks deploy on Ethereum. A significant fraction are honeypots, rug pulls, or backdoored contracts. By the time a human researcher flags one, users have already lost funds. **Human review is too slow for the speed of DeFi.**

---

## How It Works

```
Ethereum mainnet
      |
      v
[1] EVM Sentry              sentry_evm.py
    Listens for PoolCreated (V3) and Initialize (V4) events in real time.
    Fetches verified source code from Etherscan. Skips known-safe tokens.
      |
      v
[2] Golden Bridge            golden_bridge.py
    Values the contract in USD via Chainlink ETH/USD Price Feed.
    Filters out zero-value contracts. Passes enriched context downstream.
      |
      v
[3] Static Scanner           static_scan.py
    Deterministic regex over the Solidity source.
    HIGH finding → instant verdict, no AI call needed.
      |
      v
[4] Gemini 2.0 Flash         risk_score.py
    Only triggered if regex found nothing critical.
    Reasons over the full source code → Risk Score 0-100 + vulnerability label.
      |
      v
[5] Exploit Generation       (two-tier, fully automated)
    |
    +-- Tier 1: Batch Runner      batch_exploit.py
    |   Matches vulnerability flag to a proven Foundry template.
    |   Gemini adapts the template for the new target.
    |   Runs forge test on a mainnet fork → confirmed or escalated.
    |
    +-- Tier 2: Antigravity Agent .agent/workflows/generate_pocs.md
        Handles novel vectors with no existing template.
        Writes Exploit.t.sol from scratch, iterates until forge test passes.
        Saves the proven exploit as a new template for future batch runs.
      |
      v
[6] Chainlink CRE             cre/chainguard-risk/
    HTTP-triggered workflow → Risk API → DON consensus → writeReport on Sepolia.
      |
      v
[7] Dashboard                 dashboard/
    React + Vite live monitoring UI (http://localhost:5173).
```

---

## Why It Wins

Most risk tools stop at a score. ChainGuard goes further:

1. **Determinism first** — regex runs before any AI. A HIGH match is a mathematical certainty, not a prediction.
2. **AI for the rest** — Gemini 2.0 Flash catches novel vectors the regex can't anticipate, with a continuous 0-100 score.
3. **Mathematical proof** — every flagged contract gets a real Foundry exploit run against a live mainnet fork. If `forge test` passes, the vulnerability is strictly confirmed. Zero false positives.
4. **Immutable on-chain record** — Chainlink CRE writes the verdict to `RiskRegistry.sol`. Any protocol can query it before a swap or a signature.
5. **Self-improving** — every novel exploit confirmed by the IDE agent is saved as a template, making the batch runner faster on future similar contracts.

---

## Quick Start

**Step 1 — Clone and install everything:**
```bash
git clone https://github.com/Wharra/chainlink-hack.git && cd chainlink-hack
bash setup.sh
```
`setup.sh` automatically installs Python venv, pip, Node, Bun, and Foundry. It creates a `.env` file at the end.

**Step 2 — Fill in your API keys in `.env`:**

| Key | Where to get it |
|---|---|
| `ALCHEMY_API_KEY` | https://dashboard.alchemy.com/ |
| `ETHERSCAN_API_KEY` | https://etherscan.io/myapikey |
| `GOOGLE_API_KEY` | https://aistudio.google.com/apikey |
| `PRIVATE_KEY` | Your Sepolia wallet — free ETH at https://faucets.chain.link/ |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ *(optional — exploit fallback)* |

**Step 3 — Start everything:**
```bash
./start.sh
```

Open **http://localhost:5173** — the full pipeline is live.

---

## Antigravity IDE — Novel Exploit Generation

For novel vectors with no existing template:
1. Install [Antigravity](https://antigravity.dev) and open this repo in it
2. Then run:
```
/generate_pocs
```
The agent fetches the contract source, writes a Foundry PoC, iterates until `forge test` passes, and saves the result as a reusable template. Polls every 60s as a long-running daemon.

> Known vulnerability types are handled automatically by the Batch Runner launched via `./start.sh` — no Antigravity needed.

---

## Simulate the CRE Workflow

```bash
cd cre/chainguard-risk
cre workflow simulate chainguard-risk --target staging-settings
```

---

## Services Started by `./start.sh`

| Service | File | Port |
|---|---|---|
| Risk API | risk_api.py | 8000 |
| Dashboard API | dashboard_api.py | 8001 |
| EVM Sentry | sentry_evm.py | — |
| Golden Bridge | golden_bridge.py | — |
| Batch Exploit Runner | batch_exploit.py | — *(polls every 60s)* |
| Dashboard | dashboard/ | 5173 |

Stop everything: `./stop.sh`

---

## Vulnerability Classes Detected

| Category | Examples |
|---|---|
| Honeypot | Transfer whitelist, sell tax >90%, buy-only logic |
| Rug pull | Owner `withdraw()`, uncapped `mint()`, `selfdestruct` drain |
| Backdoor | Hidden `delegatecall`, mutable implementation proxy |
| Access control | `tx.origin` auth, hardcoded timestamp gates |
| Fund drain | `recoverTokens`, unrestricted `transferFrom` |

---

## Project Structure

```
chainlink-hack/
|-- sentry_evm.py        # [1] EVM event listener (Uniswap V3 + V4)
|-- golden_bridge.py     # [2] Chainlink Price Feed valuation + scoring orchestrator
|-- static_scan.py       # [3] Deterministic regex scanner
|-- risk_score.py        # [4] Gemini 2.0 Flash risk scorer (CLI + API)
|-- batch_exploit.py     # [5a] Tier-1 batch exploit runner (template-based)
|-- exploit_runner.py    # [5] Foundry fork-test runner
|-- risk_api.py          # [6] HTTP API consumed by Chainlink CRE
|-- dashboard_api.py     # [7] Dashboard SSE bridge (port 8001)
|-- utils.py             # Chainlink Data Feeds + shared helpers
|-- setup.sh             # One-shot installer
|-- start.sh / stop.sh   # Start / stop all services
|-- contracts/
|   |-- RiskRegistry.sol # On-chain risk registry (Sepolia: 0x60A9...a821)
|   +-- deploy.py        # Deployment script
|-- cre/chainguard-risk/
|   |-- workflow.yaml    # CRE workflow settings
|   |-- main.ts          # CRE SDK entry point (HTTP trigger)
|   |-- httpCallback.ts  # Risk API + DON consensus + EVM writeReport
|   +-- config.staging.json
|-- dashboard/           # React + Vite monitoring UI
|-- poc_requests/
|   |-- templates/       # Proven Foundry PoC templates (indexed by vuln flag)
|   +-- done/            # Confirmed exploits + forge test outputs
+-- .agent/workflows/
    +-- generate_pocs.md # Antigravity IDE agent workflow
```

---

## License

MIT — built for defensive security research and protocol risk management.
