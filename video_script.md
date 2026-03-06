# ChainGuard — Video Presentation Script (5 Minutes)

**Target Track:** Risk & Compliance
**Total Estimated Time:** 4 minutes 50 seconds

---

## [0:00 - 0:35] The Problem: The DeFi Minefield

**Audio (Speaker):**
"Every day, hundreds of new tokens and Uniswap hooks are deployed on Ethereum. But here's the problem: a significant fraction of them are honeypots, rug pulls, or contracts with hidden backdoors. By the time a human security researcher flags one, users have already lost their funds. Human review is simply too slow for the speed of DeFi. The solution requires automated speed AND intelligent analysis."

**Video:**
- **0:00-0:15:** Etherscan screen recording — new contracts deploying constantly, or a DeFi rug pull headline.
- **0:15-0:30:** Diagram: user sends ETH to a contract, the return path is blocked — a honeypot trap.
- **0:30-0:35:** Title card: **"ChainGuard — Real-Time DeFi Risk Sentinel"**

---

## [0:35 - 1:15] The Solution: Architecture Overview

**Audio (Speaker):**
"For the Chainlink Hackathon's Risk & Compliance track, we built ChainGuard: a fully autonomous sentinel that goes from contract deployment to immutable on-chain risk record with zero human intervention.

It works in layers. Our EVM Sentry listens to Ethereum for new Uniswap V3 and V4 pool deployments. Each new contract is immediately priced in USD using Chainlink Data Feeds. Then our two-layer detection engine kicks in: a deterministic regex scanner gives an instant hard verdict on known attack patterns — no AI call needed — while Gemini 2.0 Flash handles everything else, reasoning over the source code and outputting a risk score from 0 to 100.

If the score hits 70 or above, we don't just flag it — we prove the vulnerability mathematically using Foundry. And then Chainlink CRE writes the confirmed alert on-chain."

**Video:**
- **0:35-0:55:** Architecture diagram animating step by step:
  1. EVM Sentry (Uniswap V3/V4 events)
  2. Chainlink Price Feeds (USD valuation)
  3. Static Analysis (regex, instant Yes/No) + Gemini AI (0-100 score)
  4. Two-Tier Exploit Generation (Foundry fork test)
  5. Chainlink CRE workflow -> RiskRegistry on Sepolia
- **0:55-1:15:** Split screen: left "Static Analysis — deterministic", right "Gemini Flash — intelligent". They merge into one verdict.

---

## [1:15 - 2:00] Live Demo: Full Autopilot Pipeline

**Audio (Speaker):**
"Let's watch the full pipeline run live — completely autonomous.

We launch ChainGuard with a single command. The EVM Sentry immediately starts listening to Ethereum mainnet. The moment a new Uniswap pool is created, the Golden Bridge prices the contract using Chainlink, fetches its source from Etherscan, and scores it with Gemini.

On the dashboard we can see contracts being analyzed in real time. Watch this one — score 92, vulnerability: Honeypot. The pipeline has already submitted this to our Sepolia RiskRegistry automatically — and here's the Etherscan transaction link, right in the dashboard."

**Video:**
- **1:15-1:25:** Terminal: run `./start.sh`, all 4 services starting (Risk API, Dashboard API, EVM Sentry, Golden Bridge).
- **1:25-1:45:** Dashboard at `http://localhost:5173` — live feed of contracts being scored, red THREAT badges appearing.
- **1:45-2:00:** Click a THREAT entry — show the Etherscan popup with a real Sepolia tx hash. Briefly show `RiskRegistry.risks[address]` on Sepolia Etherscan — immutable record.

---

## [2:00 - 3:00] Live Demo: Mathematical Proof via Two-Tier Exploit System

**Audio (Speaker):**
"But how do we know the AI score isn't a hallucination? We prove it mathematically.

When a contract scores 70 or above, ChainGuard queues a Proof of Concept request. Our exploit pipeline runs in two tiers.

Tier 1 is the Batch Runner. It checks whether the detected vulnerability type already has a proven Foundry template. If it does, Gemini automatically adapts that template for the new target contract and runs it against a live mainnet fork — no human involved, no iteration needed.

Here you can see the batch runner processing a flagged contract: it fetches the source, adapts the template, and — green: exploit passed. Vulnerability confirmed. The request is moved to done/.

For novel vulnerabilities with no existing template, Tier 2 kicks in: our Antigravity IDE Agent. We trigger it with a single command — /generate_pocs. The agent writes a custom Foundry exploit from scratch, iterates until the test passes, and saves the result as a new template for future batch runs."

**Video:**
- **2:00-2:15:** Show `poc_requests/` directory with a queued `.md` request file.
- **2:15-2:35:** Terminal: run `python batch_exploit.py`. Show it detecting a matching template, adapting the exploit, running `forge test`, and printing `[PASS] testExploit()` in green.
- **2:35-2:50:** Open Antigravity with the project loaded. Type `/generate_pocs` in the agent chat.
- **2:50-3:00:** Fast-forward: Antigravity IDE writing `Exploit.t.sol`, running forge test, saving to `poc_requests/templates/`. Final `forge test` output: `[PASS] testExploit()`.

---

## [3:00 - 4:00] Live Demo: Chainlink CRE Workflow

**Audio (Speaker):**
"The final piece is Chainlink CRE — the orchestration layer that connects our off-chain risk engine to the blockchain.

Our CRE workflow is HTTP-triggered. When a contract is flagged, it calls our ChainGuard Risk API, which internally runs the full analysis stack — Etherscan source fetch, Chainlink price feed valuation, Gemini scoring. The workflow reaches consensus across the DON, encodes the result as ABI data, signs a CRE report, and writes it to our RiskRegistry smart contract on Sepolia using the EVM client's writeReport function.

Let's simulate it right now using the CRE CLI."

**Video:**
- **3:00-3:15:** Show `cre/chainguard-risk/httpCallback.ts` — highlight the `HTTPClient` call to Risk API, `consensusIdenticalAggregation`, and `evmClient.writeReport`.
- **3:15-3:35:** Terminal: `cd cre/chainguard-risk && cre workflow simulate chainguard-risk --target staging-settings`. Show the workflow logs stepping through:
  - `[Step 1] Target contract: 0x...`
  - `[Step 2] Calling ChainGuard Risk API`
  - `[Step 3] Score: 92/100 — CRITICAL`
  - `[Step 4] Writing to RiskRegistry: 0x60A9...`
  - `[Step 5] ONCHAIN ALERT PUBLISHED! TxHash: 0x...`
- **3:35-4:00:** Show the resulting transaction on Sepolia Etherscan. Call `RiskRegistry.risks[address]` to show the immutable on-chain record with score and vulnerability classification.

---

## [4:00 - 4:30] Real-World Impact

**Audio (Speaker):**
"The implications for Risk & Compliance are massive.

Because we have both immutable on-chain reports and mathematical PoC validation, DEXs like Uniswap can implement a hook that checks the Risk Registry before allowing a swap — if a token scores 70 or above, the swap is blocked, protecting everyday users automatically. DeFi insurance protocols can use these scores to dynamically price premiums. Wallets can warn users before they sign a transaction with a flagged contract.

And the template library grows with every new confirmed exploit — the system gets smarter and faster over time."

**Video:**
- **4:00-4:30:** Bullet points:
  - Automated DEX Safeguards (Uniswap Hooks query RiskRegistry)
  - Dynamic DeFi Insurance Pricing
  - Wallet Transaction Warnings
  - Self-improving template library

---

## [4:30 - 4:50] Outro

**Audio (Speaker):**
"ChainGuard proves that we can automate security at the speed of deployment. By combining Chainlink's infrastructure — Price Feeds, CRE off-chain compute, and on-chain write capabilities — with static analysis, AI reasoning, and automated Foundry exploit generation, we've built a sentinel that requires zero human intervention from contract deployment to immutable on-chain risk record to mathematical proof.

All code is open source. Thank you to the Chainlink team."

**Video:**
- **4:30-4:40:** Fast montage: Golden Bridge terminal scoring a contract, dashboard red THREAT popup with Etherscan link, CRE workflow simulation logs, Antigravity IDE `forge test` green PASS.
- **4:40-4:50:** Final slide: "ChainGuard" logo, GitHub repo link, Sepolia RiskRegistry `0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821`.
