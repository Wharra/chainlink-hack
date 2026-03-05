---
description: Automatically process flagged contracts and generate Foundry PoC exploits
---
# Antigravity IDE: PoC Generation Workflow

You are the Antigravity IDE Agent for ChainGuard. The system has detected high-risk vulnerabilities in recent smart contracts and has placed Exploit Requests in the `/Users/armand/chainlink-hack/poc_requests/` directory.

## Your Mission:
For EVERY `.md` file in `/Users/armand/chainlink-hack/poc_requests/`:

1. **Read the File:** Use the `Read` tool to read the exploit request. It contains the target contract source code, the chain information, the expected vulnerability, and a suggested API Fork URL.
2. **Initialize Foundry Environment:**
   - Create a new directory at `/tmp/poc_<contract_address>`
   - Run `forge init --no-git /tmp/poc_<contract_address>` using the `Bash` tool.
3. **Write the PoC:**
   - Create the target contract file in `src/`.
   - Create a `test/Exploit.t.sol` file containing a Foundry test that *mathematically proves* the vulnerability described in the request.
   - You must write the actual Solidity code to execute the exploit.
4. **Run the Exploit:**
   - Run `forge test --fork-url <provided_fork_url> -vvvv` using the `Bash` tool (timeout 120s).
   - If the test fails, iteratively fix the exploit using `Edit` and re-run until it passes.
5. **Report & Cleanup:**
   - Once successful, summarize the exploit mechanics in the chat.
   - Save the raw stdout from the successful `forge test` to a file at: `/Users/armand/chainlink-hack/poc_requests/done/<target_contract_address>_output.txt`
   - Move the request file from `poc_requests/` to `/Users/armand/chainlink-hack/poc_requests/done/` to mark it as complete.

6. **Continuous Polling Mode:**
   - Instead of stopping when the folder is empty, wait for new exploit requests.
   - Use the `Bash` tool to execute `sleep 60`.
   - After the sleep, check `/Users/armand/chainlink-hack/poc_requests/` again using `Glob`.
   - If a new file appears, process it (Steps 1–5). If still empty, sleep again.
   - Repeat this polling cycle for up to 50 iterations to act as a long-running exploit daemon.

## Context
- Project root: `/Users/armand/chainlink-hack/`
- PoC requests dir: `/Users/armand/chainlink-hack/poc_requests/`
- Done dir: `/Users/armand/chainlink-hack/poc_requests/done/`
- Antigravity CLI: `python /Users/armand/chainlink-hack/risk_score.py --address <addr> --exploit --json`
- Fork RPC: use `ALCHEMY_API_KEY` from `.env` → `https://eth-mainnet.g.alchemy.com/v2/<key>`
