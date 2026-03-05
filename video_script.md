# ChainGuard - Video Presentation Script (5 Minutes)

**Target Track:** Risk & Compliance
**Total Estimated Time:** 4 minutes 50 seconds

---

## [0:00 - 0:40] The Problem: The DeFi Minefield
**Audio (Speaker):**
"Every day, hundreds of new tokens and Uniswap hooks are deployed on Ethereum. But here's the $1,000,000 problem: a significant fraction of them are honeypots, rug pulls, or have hidden backdoors. By the time human security researchers find and flag these malicious contracts, users have already lost their funds. Human review is simply too slow for the speed of DeFi."

**Video (What to display):**
- **0:00-0:15:** Show a fast-paced screen recording of Etherscan demonstrating new contracts being deployed constantly, or a headline about a recent DeFi rug pull/honeypot.
- **0:15-0:30:** Display a diagram of a user sending ETH to a smart contract, but the return path is blocked (A literal "Honeypot" graphic/animation).
- **0:30-0:40:** Title Card: "The Solution requires automated speed AND intelligent analysis."

---

## [0:40 - 1:20] Enter ChainGuard: Real-Time Risk Sentinel
**Audio (Speaker):**
"For the Chainlink Hackathon's Risk and Compliance track, we built ChainGuard: a real-time risk sentinel. ChainGuard monitors Ethereum, identifies malicious contracts using AI, and posts immutable risk reports on-chain. We solve the 'speed vs intelligence' dilemma by combining deterministic Static Analysis with an autonomous Gemini 2.0 Flash agent. Our static regex scanner provides a fast, deterministic Yes/No for known patterns, while Gemini provides a 0-100 risk score and catches novel vectors. We then prove it mathematically using Foundry."

**Video (What to display):**
- **0:40-1:00:** Display the ChainGuard logo/title slide.
- **1:00-1:20:** Show a split-screen: On the left, "Static Analysis" (deterministic Yes/No regex). On the right, "Gemini Flash AI" (Intelligent 0-100 Scoring). Then the two merge to form the final verdict.

---

## [1:20 - 2:00] Architecture & Tech Stack
**Audio (Speaker):**
"Here is how it works under the hood.
First, our EVM Sentry listens to the blockchain for new Uniswap V3 and V4 pool deployments in real time.
Second, the Golden Bridge fetches the contract's USD value via Chainlink Price Feeds, filtering out zero-value noise and prioritizing high-value targets.
Third, we merge determinism with intelligence. The contract is first analyzed by our Static Scanner, which uses regex rules to provide a hard Yes/No on known attack surfaces. Those deterministic findings are fed into Google Gemini 2.0 Flash, which reasons over the code and outputs an intelligent risk score from 0 to 100.
If a contract is flagged, our autonomous agent generates a Foundry Exploit to mathematically confirm the vulnerability, and automatically writes an immutable risk report to our RiskRegistry on Sepolia.

**Video (What to display):**
- **1:20-2:00:** High-quality visual of the Architecture Flow. Highlight components:
  1. Mainnet EVM Sentry (Uniswap V3/V4 events)
  2. Golden Bridge (Chainlink Price Feeds filtering)
  3. Static Analysis (Yes/No Flags) + Gemini 2.0 AI (0-100 Score)
  4. Foundry Exploit Generation & Mainnet Fork Validation
  5. Auto on-chain submission → Sepolia RiskRegistry
- Briefly show a snippet of `utils.py` (Price Feeds integration).

---

## [2:00 - 3:00] Live Demo: Full Autopilot Pipeline
**Audio (Speaker):**
"Let's watch the full pipeline run live — completely autonomous, no manual steps.
We launch ChainGuard with a single command: `./start.sh`.
The EVM Sentry immediately begins listening to Ethereum mainnet. The moment a new Uniswap pool is created, the Golden Bridge prices the contract using Chainlink, fetches its source from Etherscan, and scores it with Gemini.
Here on the dashboard we can see contracts being analyzed in real time. Watch this one — score 92, vulnerability: Honeypot. The pipeline has already submitted this to our Sepolia RiskRegistry automatically — and the dashboard shows us the Etherscan transaction link right here."

**Video (What to display):**
- **2:00-2:15:** Terminal: run `./start.sh`, show all 4 services starting (Risk API, Dashboard API, EVM Sentry, Golden Bridge).
- **2:15-2:40:** Dashboard at `http://localhost:5173` — show the live feed of contracts being analyzed, red THREAT badges appearing with scores and vulnerability labels.
- **2:40-2:55:** Click on a THREAT entry. Show the Etherscan popup with the real Sepolia tx hash — the on-chain RiskRegistry write happened automatically.
- **2:55-3:00:** Briefly show `RiskRegistry.risks[address]` on Sepolia Etherscan — the record is immutable.

---

## [3:00 - 4:00] Live Demo: Mathematical Proof via Antigravity IDE
**Audio (Speaker):**
"But how do we know the AI's vulnerability hypothesis isn't a hallucination? We prove it mathematically.
When a contract scores 70 or above, ChainGuard queues a Proof of Concept request.
Our autonomous Antigravity agent, powered by Gemini 2.0 Flash, takes over. We trigger it with a single command: `/generate_pocs`.
The agent reads the high-risk contract, spawns a Foundry environment against a live mainnet fork, and writes a real Solidity exploit test. If it fails, the agent iterates and fixes its own code. 
Watch as it mathematically validates that the funds can indeed be drained — zero false positives."

**Video (What to display):**
- **3:00-3:15:** Show `poc_requests/` directory containing a queued `.md` file for the flagged contract.
- **3:15-3:30:** Open Antigravity with the project loaded, type `/generate_pocs` in the agent chat.
- **3:30-3:50:** Fast-forward the Gemini 2.0 Flash agent autonomously fetching source, writing and fixing `Exploit.t.sol` in `poc_requests/done/`.
- **3:50-4:00:** Show the final terminal output of `forge test`: `[PASS] testExploit()` in green, with gas used and assertions passed. Reference the real The DAO result: reentrancy depth 10, 54.18 gwei extracted, 3/3 assertions passed.

---

## [4:00 - 4:30] Real-World Usefulness
**Audio (Speaker):**
"The implications for Risk and Compliance are massive.
Because we have both immutable on-chain reports and mathematical PoC validation, DEXs like Uniswap can implement a simple hook that checks the Risk Registry before allowing a swap. If a token scores 70 or above, the swap is blocked — protecting everyday users from honeypots automatically. DeFi insurance protocols can use these scores to dynamically price premiums. And wallets can warn users before they sign a transaction with a flagged contract."

**Video (What to display):**
- **4:00-4:30:** Bullet points on screen with icons:
  - 🛡️ Automated DEX Safeguards (Uniswap Hooks query RiskRegistry)
  - 📈 Dynamic DeFi Insurance Pricing
  - 🦊 Wallet Transaction Warnings

---

## [4:30 - 4:50] Outro
**Audio (Speaker):**
"ChainGuard proves that we can automate security at the speed of deployment. By combining Chainlink's decentralized infrastructure — Price Feeds and on-chain registries — with static analysis and AI reasoning, we've built a fully autonomous sentinel that goes from contract deployment to immutable on-chain risk record to mathematical exploit proof, with zero human intervention. All code is open source and linked in our GitHub. Thank you to the Chainlink team."

**Video (What to display):**
- **4:30-4:40:** Fast-paced montage: Golden Bridge terminal scoring a contract, dashboard red THREAT popup with Etherscan link, Antigravity IDE running `forge test` green PASS.
- **4:40-4:50:** Final slide: "ChainGuard" logo, team name, GitHub repo link, and Sepolia RiskRegistry address `0x60A94FFCa6B313117487E7AD1cDAa6d56b41a821`.
