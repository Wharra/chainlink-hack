import os
import time
import shutil
import re
import requests
import json
import random
from web3 import Web3
from solana.rpc.api import Client
from solders.pubkey import Pubkey
from dotenv import load_dotenv
import utils
import static_scan
import exploit_runner

load_dotenv()

# --- CONFIGURATION ---
# Most config is now in utils.py

# 4. FILTERS (Local specific)
MIN_VALUE_USD = 0  # Set to 0 for testing (original: 100)



# --- HELPER FUNCTIONS ---

def update_live_prices():
    """Wrapper for utils."""
    utils.update_live_prices()

def get_gas_price(chain_type, chain_name):
    """Wrapper for utils."""
    return utils.get_gas_price(chain_name)

def get_protocol_deposits(address, chain_prefix, w3):
    """
    DYNAMIC detection of funds managed by the contract in DeFi protocols.
    Automatically detects ALL protocols via patterns (no hardcoding).

    Detected patterns:
    - LP Tokens: Any token with token0/token1/getReserves (Uniswap V2, Sushiswap, etc.)
    - Vault Tokens: Any token with pricePerShare/token (Yearn, Convex, etc.)
    """
    if not w3:
        return 0.0
    
    total_protocol_value_usd = 0.0
    checksum_addr = Web3.to_checksum_address(address)
    
    # Ethereum mainnet only for now
    if chain_prefix != "ETHEREUM":
        return 0.0
    
    # ===== 3. DYNAMIC LP TOKEN AND VAULT DETECTION =====
    # Test all held tokens to auto-detect:
    # - LP tokens (Uniswap V2, Sushiswap, etc.) via token0/token1/getReserves
    # - Vault tokens (Yearn, Convex, etc.) via pricePerShare
    try:
        # Fetch all tokens held by the contract
        alchemy_url = f"https://eth-mainnet.g.alchemy.com/v2/{utils.ALCHEMY_KEY}"
        payload = {
            "id": 1,
            "jsonrpc": "2.0",
            "method": "alchemy_getTokenBalances",
            "params": [checksum_addr, "erc20"]
        }
        resp = requests.post(alchemy_url, json=payload, timeout=5).json()
        
        if "result" in resp and "tokenBalances" in resp["result"]:
            for t in resp["result"]["tokenBalances"]:
                raw_bal = int(t["tokenBalance"], 16)
                if raw_bal == 0:
                    continue
                
                token_addr = Web3.to_checksum_address(t["contractAddress"])
                
                # === PATTERN 1: LP TOKENS (Uniswap V2, Sushiswap, etc.) ===
                # Auto-detect any pair with token0/token1/getReserves
                lp_pair_abi = [
                    {"constant": True, "inputs": [], "name": "token0", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "type": "function"},
                    {"constant": True, "inputs": [], "name": "token1", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "type": "function"},
                    {"constant": True, "inputs": [], "name": "getReserves", "outputs": [{"internalType": "uint112", "name": "_reserve0", "type": "uint112"}, {"internalType": "uint112", "name": "_reserve1", "type": "uint112"}, {"internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32"}], "type": "function"},
                    {"constant": True, "inputs": [], "name": "totalSupply", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "type": "function"}
                ]
                
                try:
                    pair_contract = w3.eth.contract(address=token_addr, abi=lp_pair_abi)
                    token0_addr = pair_contract.functions.token0().call()
                    token1_addr = pair_contract.functions.token1().call()
                    reserves = pair_contract.functions.getReserves().call()
                    total_supply = pair_contract.functions.totalSupply().call()
                    
                    if total_supply > 0 and reserves[0] > 0 and reserves[1] > 0:
                        lp_balance = raw_bal
                        lp_share = lp_balance / total_supply
                        
                        reserve0 = reserves[0]
                        reserve1 = reserves[1]
                        
                        token0_amount = reserve0 * lp_share
                        token1_amount = reserve1 * lp_share
                        
                        token0_decimals = utils.get_token_decimals("ETHEREUM", token0_addr)
                        token1_decimals = utils.get_token_decimals("ETHEREUM", token1_addr)
                        
                        token0_price = utils.get_token_price_universal("ETHEREUM", token0_addr)
                        token1_price = utils.get_token_price_universal("ETHEREUM", token1_addr)
                        
                        token0_value = (token0_amount / (10 ** token0_decimals)) * token0_price
                        token1_value = (token1_amount / (10 ** token1_decimals)) * token1_price
                        
                        lp_value_usd = token0_value + token1_value
                        
                        if lp_value_usd > 10:
                            total_protocol_value_usd += lp_value_usd
                            print(f"  + LP Token ({token0_addr[:6]}.../{token1_addr[:6]}...): ${lp_value_usd:.2f}")
                            continue  # Skip vault detection for this token
                except:
                    pass  # Not an LP token, try vault pattern
                
                # === PATTERN 2: VAULT TOKENS (Yearn, Convex, etc.) ===
                # Auto-detect any vault with pricePerShare
                vault_abi = [
                    {"constant": True, "inputs": [], "name": "pricePerShare", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "type": "function"},
                    {"constant": True, "inputs": [], "name": "token", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "type": "function"},
                    {"constant": True, "inputs": [], "name": "decimals", "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}], "type": "function"}
                ]
                
                try:
                    vault_contract = w3.eth.contract(address=token_addr, abi=vault_abi)
                    price_per_share = vault_contract.functions.pricePerShare().call()
                    underlying_token = vault_contract.functions.token().call()
                    vault_decimals = vault_contract.functions.decimals().call()
                    
                    if price_per_share > 0 and underlying_token != "0x0000000000000000000000000000000000000000":
                        vault_balance_normalized = raw_bal / (10 ** vault_decimals)
                        underlying_amount = vault_balance_normalized * (price_per_share / 1e18)
                        
                        underlying_decimals = utils.get_token_decimals("ETHEREUM", underlying_token)
                        underlying_price = utils.get_token_price_universal("ETHEREUM", underlying_token)
                        
                        vault_value_usd = underlying_amount * underlying_price
                        
                        if vault_value_usd > 10:
                            total_protocol_value_usd += vault_value_usd
                            print(f"  + Vault Token: ${vault_value_usd:.2f}")
                except:
                    pass  # Not a vault token, continue to next token
                    
    except Exception as e:
        pass
    
    return total_protocol_value_usd



# --- CONFIGURATION (Token Lists) ---
# Minimal ERC20 ABI for balanceOf
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

# Supported Tokens to Scan (Symbol, Address, Decimals, PriceKey/FixedValue)
TOKENS = {
    "ETHEREUM": [
        {"symbol": "USDC", "addr": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "dec": 6, "price": 1.0},
        {"symbol": "USDT", "addr": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "dec": 6, "price": 1.0},
        {"symbol": "DAI", "addr": "0x6B175474E89094C44Da98b954EedeAC495271d0F", "dec": 18, "price": 1.0},
        {"symbol": "WETH", "addr": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "dec": 18, "ref": "ETH"},
    ],
    "BASE": [
        {"symbol": "USDC", "addr": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "dec": 6, "price": 1.0},
        {"symbol": "WETH", "addr": "0x4200000000000000000000000000000000000006", "dec": 18, "ref": "ETH"},
    ],
    "ARBITRUM": [
        {"symbol": "USDC", "addr": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "dec": 6, "price": 1.0},
        {"symbol": "USDT", "addr": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "dec": 6, "price": 1.0},
        {"symbol": "WETH", "addr": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "dec": 18, "ref": "ETH"},
    ],
    "SOLANA": [
        {"symbol": "USDC", "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "dec": 6, "price": 1.0},
        {"symbol": "USDT", "mint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "dec": 6, "price": 1.0},
    ]
}

def get_balance_usd(filename, chain_type):
    """Stage 2: Financial filter. Returns Total USD value (Native + Tokens + Protocol Deposits).
    
    Computes two funding sources:
    1. Native balance + directly held tokens (funds initialized at launch)
    2. Funds managed in DeFi protocols (Aave, Compound, Uniswap LP, Yearn, etc.) — funds the contract influences
    """
    try:
        parts = filename.split('_')
        if len(parts) < 2: return 0
        
        chain_prefix = parts[0].upper()
        # Clean filename to get address
        address_part = parts[1].replace(".sol", "").replace(".rs", "").replace(".json", "")
        
        total_value = 0.0

        if chain_type == "EVM":
            w3 = utils.get_web3(chain_prefix)
            if not w3: return 0
            
            checksum_addr = Web3.to_checksum_address(address_part)
            
            # 1. Native Balance (ETH)
            try:
                bal_wei = w3.eth.get_balance(checksum_addr)
                bal_eth = float(w3.from_wei(bal_wei, 'ether'))
                price = utils.PRICES["ETH"]
                total_value += bal_eth * price
            except: pass

            # 2. Token Balances (Universal Discovery via Alchemy)
            # We use Alchemy API directly to find ALL tokens, avoiding hardcoded lists.
            try:
                # Construct Alchemy URL based on chain
                alchemy_url = None
                if chain_prefix == "ETHEREUM": alchemy_url = f"https://eth-mainnet.g.alchemy.com/v2/{utils.ALCHEMY_KEY}"
                elif chain_prefix == "BASE":   alchemy_url = f"https://base-mainnet.g.alchemy.com/v2/{utils.ALCHEMY_KEY}"
                elif chain_prefix == "ARBITRUM": alchemy_url = f"https://arb-mainnet.g.alchemy.com/v2/{utils.ALCHEMY_KEY}"

                if alchemy_url:
                    payload = {
                        "id": 1,
                        "jsonrpc": "2.0",
                        "method": "alchemy_getTokenBalances",
                        "params": [checksum_addr, "erc20"]
                    }
                    resp = requests.post(alchemy_url, json=payload, timeout=5).json()
                    
                    if "result" in resp and "tokenBalances" in resp["result"]:
                        for t in resp["result"]["tokenBalances"]:
                            raw_bal = int(t["tokenBalance"], 16)
                            if raw_bal == 0: continue
                            
                            token_addr = Web3.to_checksum_address(t["contractAddress"])
                            
                            # Get Metadata & Price
                            decimals = utils.get_token_decimals(chain_prefix, token_addr)
                            price = utils.get_token_price_universal(chain_prefix, token_addr)
                            if price <= 0:
                                price = utils.get_token_price_fallback(chain_prefix, token_addr)
                            
                            normalized = raw_bal / (10 ** decimals)
                            val = normalized * price
                            
                            if val > 1.0: # Only count significant dust
                                total_value += val
                                print(f"  + Token {token_addr[:6]}...: ${val:.2f}")

            except Exception as e:
                # print(f"Token Scan Error: {e}")
                pass

            # 3. Protocol Deposits (funds managed by the contract in DeFi protocols)
            # Second funding source: funds the contract has influence over
            try:
                protocol_value = get_protocol_deposits(address_part, chain_prefix, w3)
                if protocol_value > 0:
                    total_value += protocol_value
                    print(f"  + Protocol Deposits (TVL): ${protocol_value:.2f}")
            except Exception as e:
                # Silently fail to avoid polluting logs
                pass
                
            return total_value

        elif chain_type == "SOLANA":
            client = Client(utils.SOLANA_RPC_URL)
            pubkey = Pubkey.from_string(address_part)
            
            # 1. Native Balance (SOL)
            try:
                balance_resp = client.get_balance(pubkey)
                balance_sol = balance_resp.value / 1_000_000_000
                total_value += balance_sol * utils.PRICES["SOL"]
            except: pass
            
            # 2. Token Balances (Spl-Token)
            # Need to find accounts owned by this program/address for specific mints
            tokens = TOKENS.get("SOLANA", [])
            for t in tokens:
                try:
                    # Generic get_token_accounts_by_owner (filtering by mint)
                    # Note: Requires solders imports for Memcmp if using filters, 
                    # but client.get_token_accounts_by_owner accepts mint directly in some versions.
                    # The python solana lib 'get_token_accounts_by_owner' takes (owner, TokenAccountOpts(mint=...))
                    # Simplified: check ATA or just scan.
                    
                    from solana.rpc.types import TokenAccountOpts
                    
                    resp = client.get_token_accounts_by_owner(
                        pubkey, 
                        TokenAccountOpts(mint=Pubkey.from_string(t["mint"]))
                    )
                    
                    token_bal = 0
                    if resp.value:
                        for account in resp.value:
                            # Parse account data? Or simplify.
                            # The response usually contains account info.
                            # Accessing balance inside is complex without layout parsing.
                            # Alternative: get_token_account_balance if we knew the address.
                            
                            # Let's try getting balance of the account found:
                            acc_pubkey = account.pubkey
                            bal_resp = client.get_token_account_balance(acc_pubkey)
                            if bal_resp.value:
                                token_bal += bal_resp.value.ui_amount or 0
                                
                    if token_bal > 0:
                         price = t["price"]
                         total_value += token_bal * price
                except Exception as e: 
                    # print(f"Solana Token Error: {e}")
                    continue
                    
            return total_value

    except Exception as e:
        print(f"[WARN] Balance check failed for {filename}: {e}")
        return 0

def call_antigravity_score(code, chain_name, balance_usd, scan_result=None):
    """Stage 3: AI Filter. Uses rotated API keys."""
    static_context = scan_result['prompt_context'] if scan_result else ""
    fallback_score = scan_result['preliminary_score'] if scan_result else 0
    fallback_vuln = "Rate Limited (Regex Fallback)"
    if scan_result and scan_result.get('findings'):
        fallback_vuln = f"Regex: {scan_result['findings'][0]['name']}"
    # Rotate keys randomly to distribute load
    if not utils.GOOGLE_API_KEYS:
        print("[ERROR] No Google API Keys found!")
        return fallback_score, fallback_vuln

    headers = {'Content-Type': 'application/json'}
    
    # 1. LOAD PROMPT FROM FILE
    try:
        with open("prompt_gemini.txt", "r", encoding="utf-8") as f:
            prompt_template = f.read()
    except FileNotFoundError:
        print("[ERROR] prompt_gemini.txt not found!")
        return 0, "Error: Prompt Missing"

    # 2. FILL TEMPLATE (size-guarded to reduce malformed responses)
    max_code_chars = 24000
    truncated_code = code
    if len(code) > max_code_chars:
        truncated_code = code[:max_code_chars] + "\n/* [TRUNCATED] Code trimmed for model context. */\n"

    prompt = prompt_template.format(
        chain_name=chain_name,
        balance_usd=balance_usd,
        static_analysis=static_context or "Static analysis: not run.",
        code=truncated_code
    )
    
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        global _last_ai_call_ts
        since_last = time.time() - _last_ai_call_ts
        if since_last < AI_MIN_INTERVAL_SECONDS:
            time.sleep(AI_MIN_INTERVAL_SECONDS - since_last)

        # Retry loop for 429 (Rate Limit)
        max_retries = 1 # Keep requests low to avoid rate limits
        
        for attempt in range(max_retries):
            # ROTATE KEY: Pick a random key for each attempt
            current_key = random.choice(utils.GOOGLE_API_KEYS)
            masked_key = f"{current_key[:4]}...{current_key[-4:]}"
            
            # Using gemini-2.5-flash to avoid rate limits and 404s
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={current_key}"
            
            print(f"[AI] Attempt {attempt+1}/{max_retries}")
            
            response = requests.post(url, headers=headers, json=payload)
            _last_ai_call_ts = time.time()
            
            if response.status_code == 200:
                break
            elif response.status_code == 429:
                wait_time = 2 # Short wait since we are switching keys
                print(f"[WARN] Rate Limit (429). Switching key in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"[ERROR] API Error {response.status_code}: {response.text}")
                # Don't break immediately on generic errors if we have multiple keys, strictly speaking
                # but usually 400/403 won't proceed. Let's return error for non-429.
                return fallback_score, fallback_vuln
        else:
             print("[ERROR] Failed after retries (All keys/attempts exhausted). Using Regex Fallback.")
             return fallback_score, fallback_vuln
            
        data = response.json()
        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
        )
        if not text:
            print("[WARN] AI returned empty response.")
            return fallback_score, fallback_vuln

        # 3. PARSE TOON FORMAT (SCORE|VULNERABILITY) with fallback
        match = re.search(r"(\d{1,3})\s*\|\s*([^\n\r]+)", text)
        if match:
            score = int(match.group(1))
            vuln_str = match.group(2).strip()
            # Handle "None" vulnerability
            if vuln_str.lower() in ["none", "n/a", ""]:
                vuln_str = "No significant vulnerability detected"
            score = max(0, min(score, 100))
            return score, vuln_str

        match = re.search(r"(\d{1,3})", text)
        if match:
            score = int(match.group(1))
            score = max(0, min(score, 100))
            # Silent fallback for cleaner demo output
            return score, "Unspecified vulnerability pattern"

        # Malformed response - return safe default without polluting logs
        return fallback_score, fallback_vuln

    except Exception as e:
        print(f"[ERROR] AI Parsing Error: {e}")
        return fallback_score, fallback_vuln

POC_REQUESTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "poc_requests")

def _auto_flag(address: str, score: int, vulnerability: str, chain_name: str):
    """Write poc_request file + submit risk score on-chain when score >= 70."""
    alchemy_key  = os.getenv("ALCHEMY_API_KEY", "")
    private_key  = os.getenv("PRIVATE_KEY", "")
    registry     = os.getenv("RISK_REGISTRY_ADDRESS", "").strip()
    rpc_base     = os.getenv("CRE_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/")
    rpc_url      = rpc_base.rstrip("/") + "/" + alchemy_key

    # 1. Write PoC request file
    try:
        os.makedirs(POC_REQUESTS_DIR, exist_ok=True)
        fork_url = f"https://eth-mainnet.g.alchemy.com/v2/{alchemy_key}"
        content = f"""# PoC Request: {address}

**Chain:** {chain_name.upper()}
**Score:** {score}/100
**Vulnerability:** {vulnerability}
**Fork URL:** {fork_url}

Fetch the verified source code from Etherscan mainnet (chainid=1) and generate
a Foundry PoC test that mathematically proves this vulnerability.
"""
        poc_path = os.path.join(POC_REQUESTS_DIR, f"{address.lower()}.md")
        with open(poc_path, "w") as f:
            f.write(content)
        print(f"[POC] Queued {poc_path}", flush=True)
    except Exception as e:
        print(f"[POC] Failed to write request: {e}")

    # 2. Submit on-chain to RiskRegistry on Sepolia
    if not registry or not private_key or not alchemy_key:
        return
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            return
        abi = [{"inputs": [{"name": "target", "type": "address"}, {"name": "score", "type": "uint256"}, {"name": "vulnerability", "type": "string"}], "name": "reportRisk", "outputs": [], "stateMutability": "nonpayable", "type": "function"}]
        account  = w3.eth.account.from_key(private_key)
        contract = w3.eth.contract(address=Web3.to_checksum_address(registry), abi=abi)
        tx = contract.functions.reportRisk(
            Web3.to_checksum_address(address), score, vulnerability
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200_000,
        })
        signed  = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction).hex()
        print(f"[ONCHAIN] RiskRegistry updated: https://sepolia.etherscan.io/tx/{tx_hash}")
    except Exception as e:
        print(f"[ONCHAIN] Submission failed: {e}")


def append_to_db(chain, contract_name, value, timestamp, vuln_hint, score=0, exploit_confirmed=False):
    """Appends a new job to the TOON database."""
    if score >= 85:
        status = "THREAT"
    elif score >= 50:
        status = "MEDIUM"
    else:
        status = "SAFE"
    entry = {
        "chain": chain,
        "time": int(timestamp),
        "contract": contract_name,
        "value_usd": value,
        "status": status,
        "score": score,
        "output_name": f"{chain}_{contract_name.replace('.sol', '').replace('.txt', '').replace('.json', '')}_{int(timestamp)}",
        "vulnerability": vuln_hint,
        "exploit_confirmed": exploit_confirmed,
    }

    utils.append_to_db(entry)
    confirmed_tag = " ⚡EXPLOIT CONFIRMED" if exploit_confirmed else ""
    print(f"[DB] [{status}] {entry['output_name']} score={score} ({vuln_hint}){confirmed_tag}")

# --- CONFIGURATION ---
WAITING_ROOM_DIR = "./waiting_room"
WAITING_PERIOD_SECONDS = 72 * 3600
AI_MIN_INTERVAL_SECONDS = 30  # gemini-flash-latest has a much more generous quota
_last_ai_call_ts = 0.0

def process_waiting_room():
    """Scans waiting room for contracts that might have gained value."""
    if not os.path.exists(WAITING_ROOM_DIR):
        return

    # Process a few files at a time to not block the main loop too long
    waiting_files = [f for f in os.listdir(WAITING_ROOM_DIR) if f.endswith(".sol") or f.endswith(".json")]
    
    if not waiting_files:
        return

    # Random sample check 5 files to avoid congestion
    to_check = random.sample(waiting_files, min(5, len(waiting_files)))
    
    for filename in to_check:
        filepath = os.path.join(WAITING_ROOM_DIR, filename)
        
        # Check Age
        try:
            file_age = time.time() - os.path.getmtime(filepath)
        except FileNotFoundError:
            continue

        if file_age > WAITING_PERIOD_SECONDS:
            print(f"[WAIT] Expired ({file_age/3600:.1f}h). Trashing {filename}.")
            try:
                shutil.move(filepath, os.path.join(utils.TRASH_DIR, filename))
            except FileNotFoundError:
                # File already moved/deleted by another process
                pass
            continue
            
        # Check Value
        chain_type = "SOLANA" if filename.endswith(".json") else "EVM"
        val = get_balance_usd(filename, chain_type)
        
        if val >= MIN_VALUE_USD:
            print(f"[WAIT] FUNDED! {filename} now has ${val:.2f}. Promoting!")
            # Move back to candidates for immediate processing
            target_dir = utils.CANDIDATES_SOL_DIR if chain_type == "SOLANA" else utils.CANDIDATES_DIR
            try:
                shutil.move(filepath, os.path.join(target_dir, filename))
            except FileNotFoundError:
                # File already moved/deleted by another process
                pass
        else:
            # print(f"[WAIT] Still empty {filename} (${val:.2f})...")
            pass

# --- MAIN LOOP ---

def main():
    print("[SYSTEM] Golden Bridge Optimized Active.")
    print(f"[SYSTEM] Minimum Contract Value: ${MIN_VALUE_USD}")
    print(f"[SYSTEM] Waiting Room Active ({WAITING_PERIOD_SECONDS/3600:.0f}h retention).")
    
    # Initial Price Fetch
    update_live_prices()
    
    # Ensure dirs exist
    for d in [utils.CANDIDATES_DIR, utils.CANDIDATES_SOL_DIR, utils.TRASH_DIR, utils.GOLD_DIR, WAITING_ROOM_DIR]:
        os.makedirs(d, exist_ok=True)
    
    last_waiting_room_check = 0

    while True:
        # Refresh prices periodically
        update_live_prices()
        
        # Check Waiting Room every 60s
        if time.time() - last_waiting_room_check > 60:
            process_waiting_room()
            last_waiting_room_check = time.time()
        
        # Gather all files
        try:
            evm_files = [(f, "EVM", utils.CANDIDATES_DIR) for f in os.listdir(utils.CANDIDATES_DIR) if f.endswith(".sol")]
            sol_files = [(f, "SOLANA", utils.CANDIDATES_SOL_DIR) for f in os.listdir(utils.CANDIDATES_SOL_DIR) if f.endswith(".json")]
            all_files = evm_files + sol_files
        except:
            time.sleep(5)
            continue
        
        if not all_files:
            time.sleep(5)
            continue
            
        current_file, chain_type, source_dir = all_files[0]
        filepath = os.path.join(source_dir, current_file)
        
        chain_name = current_file.split('_')[0] if '_' in current_file else chain_type
        
        print(f"\n[PROCESS] Processing: {current_file}")
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                raw_content = f.read()
                
            if current_file.endswith(".json"):
                # Inject Context for IDL
                code = f"// [CONTEXT] This is a Solana Anchor IDL (JSON format) describing the program interface.\n// Analyze the instructions and accounts for logic vulnerabilities.\n\n{raw_content}"
            else:
                code = raw_content
                
        except Exception as e:
            try:
                if os.path.exists(filepath):
                    shutil.move(filepath, os.path.join(utils.TRASH_DIR, current_file))
            except FileNotFoundError:
                pass
            continue


        # --- FILTER 2: BALANCE CHECK ---
        balance_usd = get_balance_usd(current_file, chain_type)
        if balance_usd < MIN_VALUE_USD:
            print(f"[FILTER] Value too low (${balance_usd:.2f}). Moving to Waiting Room.")
            try:
                shutil.move(filepath, os.path.join(WAITING_ROOM_DIR, current_file))
            except FileNotFoundError:
                # File already moved/deleted by another process
                pass
            continue
        
        print(f"[FILTER] High Value Target Verified: ${balance_usd:.2f}")

        # --- FILTER 3: STATIC ANALYSIS (pre-pass before Gemini) ---
        scan = static_scan.analyze(code, filepath)
        if scan['findings']:
            print(f"[SCAN] {len(scan['high'])} HIGH  {len(scan['medium'])} MEDIUM  {len(scan['low'])} LOW  (prelim score: {scan['preliminary_score']})")

        # --- FILTER 4: AI SCORING (Antigravity Core) ---
        score, vuln = call_antigravity_score(code, chain_name, balance_usd, scan_result=scan)
        print(f"[AI] Score: {score}/100. Vulnerability: {vuln}")

        # Attempt exploit confirmation on mainnet fork (only for critical threats)
        exploit_confirmed = False
        if score >= 85 and chain_type == "EVM":
            parts = current_file.split("_")
            contract_addr = parts[1].replace(".sol", "") if len(parts) >= 2 else None
            rpc_url = utils.get_fork_rpc_url(chain_name.upper())
            if contract_addr and rpc_url:
                exploit_result = exploit_runner.confirm_exploit(code, vuln, contract_addr, rpc_url)
                exploit_confirmed = exploit_result["confirmed"]

        # Always add to DB so dashboard shows all scanned pools
        append_to_db(chain_name, current_file, balance_usd, time.time(), vuln, score, exploit_confirmed)

        # Auto-flag high-risk contracts: write on-chain + queue PoC
        if score >= 70 and chain_type == "EVM":
            parts = current_file.split("_")
            contract_addr = parts[1].replace(".sol", "") if len(parts) >= 2 else None
            if contract_addr and contract_addr.startswith("0x"):
                _auto_flag(contract_addr, score, vuln, chain_name)

        if score >= 85:
            print("[ACTION] GOLDEN NUGGET — moving to gold/")
            try:
                shutil.move(filepath, os.path.join(utils.GOLD_DIR, current_file))
            except FileNotFoundError:
                pass
            print("[WAIT] Cooling down for 60 seconds...")
            time.sleep(60)
        else:
            try:
                shutil.move(filepath, os.path.join(utils.TRASH_DIR, current_file))
            except FileNotFoundError:
                pass
            time.sleep(60)

if __name__ == "__main__":
    main()
