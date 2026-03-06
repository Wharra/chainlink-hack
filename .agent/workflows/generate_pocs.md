---
description: Automatically process flagged contracts and generate Foundry PoC exploits
---

# Antigravity IDE: PoC Generation Workflow

You are the Antigravity IDE Agent for ChainGuard. The system has detected high-risk vulnerabilities in recent smart contracts and has placed Exploit Requests in the `poc_requests/` directory (relative to the repo root).

**All paths below are relative to the repository root.** Determine the repo root at startup by running `git rev-parse --show-toplevel` (store it as `REPO_ROOT`). Prefix all relative paths with `REPO_ROOT`.

## Step 0 — Batch Exploit (automated, runs first)

Before doing any manual work, run the batch exploit script to clear out contracts whose vulnerability type already has a proven template:

```bash
python batch_exploit.py
```

This script will:
- Scan every pending `.md` in `poc_requests/`
- For any contract whose vulnerability flag matches a template in `poc_requests/templates/`, automatically generate an adapted PoC via AI, run it on a fork, and report results
- Move successfully exploited requests to `poc_requests/done/`
- Leave unmatched or failed requests in `poc_requests/` for you to handle manually

After batch_exploit.py finishes, proceed with the remaining requests below.

## Your Mission:
For EVERY `.md` file still in `poc_requests/` (i.e. not handled by batch_exploit.py):

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
5. **Report, Save Template & Cleanup:**
   - Once successful, summarize the exploit mechanics in the chat.
   - Save the raw stdout from the successful `forge test` to: `poc_requests/done/<target_contract_address>_output.txt`
   - **Save the proven PoC as a template:** Extract the vulnerability flag from the request file (the part after "Regex: " in the `**Vulnerability:**` line). Write the successful `Exploit.t.sol` to `poc_requests/templates/<flag>.sol` (e.g. `poc_requests/templates/uncapped-mint.sol`). If a template for this flag already exists, overwrite it only if the new PoC is cleaner or more general.
   - Move the request file from `poc_requests/` to `poc_requests/done/` to mark it as complete.

6. **Continuous Polling Mode:**
   - Instead of stopping when the folder is empty, wait for new exploit requests.
   - Use the `Bash` tool to execute `sleep 60`.
   - After the sleep, first run `python batch_exploit.py` again to clear any template-matched requests, then check `poc_requests/` using `Glob`.
   - If a new file appears, process it (Steps 1-5). If still empty, sleep again.
   - Repeat this polling cycle for up to 50 iterations to act as a long-running exploit daemon.

## Context
- Project root: determined dynamically via `git rev-parse --show-toplevel`
- PoC requests dir: `poc_requests/`
- Done dir: `poc_requests/done/`
- Templates dir: `poc_requests/templates/`
- Batch exploit script: `batch_exploit.py`
- Antigravity CLI: `python risk_score.py --address <addr> --exploit --json`
- Fork RPC: already included in each `.md` request file under `**Fork URL:**` -- read it directly from there, do not access `.env`