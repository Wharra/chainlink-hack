import os
import time
import json
import requests
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---

# Directories
CANDIDATES_DIR = "./benchmark_candidates"
CANDIDATES_SOL_DIR = "./benchmark_candidates_solana"
TRASH_DIR = "./trash"
GOLD_DIR = "./gold_processed"
SOLUTIONS_DIR = "./benchmark_solutions"
RESULTS_DIR = "./results"
DB_FILE = "database.toon"

# API Keys
google_key = os.getenv("GOOGLE_API_KEY")
GOOGLE_API_KEYS = [k.strip() for k in google_key.split(",")] if google_key else []
if not GOOGLE_API_KEYS:
    # Fallback to older env var name if present
    GOOGLE_API_KEYS = os.getenv("GOOGLE_API_KEYS", "").split(",")
    if GOOGLE_API_KEYS == ['']: GOOGLE_API_KEYS = []

# RPC Connections (Alchemy only)
ALCHEMY_KEY = os.getenv("ALCHEMY_API_KEY")

# Chainlink price feeds (JSON string mapping)
# Example:
# CHAINLINK_PRICE_FEEDS='{"ETHEREUM":{"ETH_USD":"0x..."}}'
try:
    CHAINLINK_PRICE_FEEDS = json.loads(os.getenv("CHAINLINK_PRICE_FEEDS", "{}"))
except json.JSONDecodeError:
    CHAINLINK_PRICE_FEEDS = {}

# Fork RPC URLs for testing exploits on forks (Alchemy only)
def get_fork_rpc_url(chain):
    """Returns the fork RPC URL for a given chain using Alchemy."""
    # Priority 1: Custom RPC URL from env (if specified)
    custom_rpc = {
        "ETHEREUM": os.getenv("ETH_RPC_URL"),
        "BASE": os.getenv("BASE_RPC_URL"),
        "ARBITRUM": os.getenv("ARB_RPC_URL")
    }.get(chain)
    
    if custom_rpc:
        return custom_rpc
    
    # Priority 2: Alchemy (default)
    if ALCHEMY_KEY:
        alchemy_urls = {
            "ETHEREUM": f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
            "BASE": f"https://base-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}",
            "ARBITRUM": f"https://arb-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}"
        }
        if chain in alchemy_urls:
            return alchemy_urls[chain]
    
    return None

# Standard RPC URLs (for Web3 connections - Alchemy only)
RPC_URLS = {
    "ETHEREUM": os.getenv("ETH_RPC_URL") or (f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}" if ALCHEMY_KEY else None),
    "BASE":     os.getenv("BASE_RPC_URL") or (f"https://base-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}" if ALCHEMY_KEY else None),
    "ARBITRUM": os.getenv("ARB_RPC_URL") or (f"https://arb-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}" if ALCHEMY_KEY else None)
}
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL") or (f"https://solana-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}" if ALCHEMY_KEY else None)

# Initial Prices (Updated dynamically)
PRICES = {"ETH": 3000.0, "SOL": 150.0}
LAST_PRICE_UPDATE = 0
PRICE_UPDATE_INTERVAL = 300  # 5 minutes

# Web3/RPC Clients (Lazy loaded to avoid immediate crashes)
_web3_connections = {}

def get_web3(chain):
    """Returns a Web3 instance for the given chain."""
    if chain not in _web3_connections:
        if chain in RPC_URLS and RPC_URLS[chain]:
            try:
                _web3_connections[chain] = Web3(Web3.HTTPProvider(RPC_URLS[chain]))
            except:
                return None
    return _web3_connections.get(chain)

# --- FUNCTIONS ---

def update_live_prices():
    """Fetches real-time prices from Binance Public API."""
    global PRICES, LAST_PRICE_UPDATE
    
    if time.time() - LAST_PRICE_UPDATE < PRICE_UPDATE_INTERVAL:
        return

    print("[SYSTEM] Fetching live crypto prices...")
    try:
        # 0. Try Chainlink price feed first (optional)
        chainlink_eth_feed = CHAINLINK_PRICE_FEEDS.get("ETHEREUM", {}).get("ETH_USD")
        if chainlink_eth_feed:
            chainlink_price = get_chainlink_price("ETHEREUM", chainlink_eth_feed)
            if chainlink_price > 0:
                PRICES["ETH"] = chainlink_price

        # 1. Fetch ETH Price (Used for Ethereum, Base, Arbitrum)
        # Note: Base and Arbitrum use ETH as the native gas token, so their contract 
        # "value" (in Wei) is correctly converted using the ETH price.
        if not chainlink_eth_feed:
            eth_resp = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", timeout=5)
            if eth_resp.status_code == 200:
                PRICES["ETH"] = float(eth_resp.json()["price"])
            
        sol_resp = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", timeout=5)
        if sol_resp.status_code == 200:
            PRICES["SOL"] = float(sol_resp.json()["price"])
            
        LAST_PRICE_UPDATE = time.time()
        print(f"[SYSTEM] Updated: ETH=${PRICES['ETH']:.2f}, SOL=${PRICES['SOL']:.2f}")
    except Exception as e:
        print(f"[WARN] Failed to fetch live prices: {e}")

def get_gas_price(chain):
    """Fetches current gas price (Gwei for EVM, Lamports for Solana)."""
    if chain == "SOLANA":
        return 5000 # Standard lamports per signature roughly
    
    w3 = get_web3(chain)
    if w3:
        try:
            wei = w3.eth.gas_price
            return float(w3.from_wei(wei, 'gwei'))
        except:
            return 0
    return 0

def read_db():
    if not os.path.exists(DB_FILE): return []
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f]

def append_to_db(entry):
    """Appends a new job to the DB file."""
    with open(DB_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

# --- UNIVERSAL PRICING ---
TOKEN_PRICE_CACHE = {} 
PRICE_CACHE_EXPIRY = 600 # 10 Minutes
TOKEN_SYMBOL_CACHE = {}

# Simple price fallbacks for common assets when price API misses them.
STABLE_SYMBOLS = {"USDC", "USDT", "DAI", "USDP", "USDB", "BUSD", "TUSD", "FRAX"}
WRAPPED_NATIVE_BY_CHAIN = {
    "ETHEREUM": {"WETH"},
    "BASE": {"WETH"},
    "ARBITRUM": {"WETH"},
    "SOLANA": {"WSOL"},
}

def get_token_price_universal(chain, token_address):
    """
    Fetches the USD price of any token using DeFiLlama API.
    Handles caching to avoid hitting rate limits.
    """
    global TOKEN_PRICE_CACHE
    
    # 1. Normalize Config
    chain_map = {
        "ETHEREUM": "ethereum",
        "BASE": "base",
        "ARBITRUM": "arbitrum",
        "SOLANA": "solana",
        # Testnets - Mock or Fail
        "SEPOLIA": "ethereum", # Fallback to eth price? No, address won't match.
        "BASE_SEPOLIA": "base"
    }
    
    # Mock Pricing for Testnets (If we want to test logic)
    if chain in ["SEPOLIA", "BASE_SEPOLIA"]:
        # If it's a known 'testnet stablecoin' address (mock), return $1.
        # Otherwise, assume it's a valuable test token for our experiment.
        return 1.0 # Treat all testnet tokens as $1 for logic verification
    
    platform = chain_map.get(chain)
    if not platform: return 0.0
    
    key = f"{platform}:{token_address}"
    
    # 2. Check Cache
    if key in TOKEN_PRICE_CACHE:
        price, ts = TOKEN_PRICE_CACHE[key]
        if time.time() - ts < PRICE_CACHE_EXPIRY:
            return price
            
    # 3. Fetch from API
    try:
        url = f"https://coins.llama.fi/prices/current/{key}"
        # print(f"[PRICE] Fetching {url}...")
        resp = requests.get(url, timeout=5)
        
        if resp.status_code == 200:
            data = resp.json()
            if "coins" in data and key in data["coins"]:
                price = data["coins"][key]["price"]
                TOKEN_PRICE_CACHE[key] = (price, time.time())
                return price
    except Exception as e:
        # print(f"[WARN] Price fetch failed for {key}: {e}")
        pass
        
    return 0.0

# --- CHAINLINK PRICE FEEDS ---
def get_chainlink_price(chain, feed_address):
    """Fetches price from a Chainlink AggregatorV3 feed."""
    w3 = get_web3(chain)
    if not w3:
        return 0.0

    try:
        abi = [
            {"constant": True, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function"},
            {
                "constant": True,
                "inputs": [],
                "name": "latestRoundData",
                "outputs": [
                    {"name": "roundId", "type": "uint80"},
                    {"name": "answer", "type": "int256"},
                    {"name": "startedAt", "type": "uint256"},
                    {"name": "updatedAt", "type": "uint256"},
                    {"name": "answeredInRound", "type": "uint80"},
                ],
                "type": "function",
            },
        ]
        ctr = w3.eth.contract(address=feed_address, abi=abi)
        decimals = ctr.functions.decimals().call()
        _, answer, _, _, _ = ctr.functions.latestRoundData().call()
        if answer <= 0:
            return 0.0
        return float(answer) / (10 ** decimals)
    except Exception:
        return 0.0

# --- METADATA (SYMBOL) ---
def get_token_symbol(chain, token_address):
    """Fetches token symbol using Web3; cached for reuse."""
    global TOKEN_SYMBOL_CACHE

    key = f"{chain}:{token_address}"
    if key in TOKEN_SYMBOL_CACHE:
        return TOKEN_SYMBOL_CACHE[key]

    w3 = get_web3(chain)
    if not w3:
        return None

    try:
        abi = [{"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function"}]
        ctr = w3.eth.contract(address=token_address, abi=abi)
        symbol = ctr.functions.symbol().call()
        if isinstance(symbol, bytes):
            symbol = symbol.decode("utf-8", errors="ignore")
        symbol = symbol.strip()
        if symbol:
            TOKEN_SYMBOL_CACHE[key] = symbol
        return symbol
    except:
        return None

def get_token_price_fallback(chain, token_address):
    """Fallbacks for common assets when universal pricing fails."""
    symbol = get_token_symbol(chain, token_address)
    if not symbol:
        return 0.0

    symbol_upper = symbol.upper()
    if symbol_upper in STABLE_SYMBOLS:
        return 1.0

    wrapped = WRAPPED_NATIVE_BY_CHAIN.get(chain, set())
    if symbol_upper in wrapped:
        if chain in ["ETHEREUM", "BASE", "ARBITRUM"]:
            return PRICES.get("ETH", 0.0)
        if chain == "SOLANA":
            return PRICES.get("SOL", 0.0)

    return 0.0

# --- METADATA (DECIMALS) ---
TOKEN_META_CACHE = {} 

def get_token_decimals(chain, token_address):
    """Fetches token decimals using Alchemy/Web3."""
    global TOKEN_META_CACHE
    
    key = f"{chain}:{token_address}"
    if key in TOKEN_META_CACHE:
        return TOKEN_META_CACHE[key]
        
    w3 = get_web3(chain)
    if not w3: return 18 # Default fallback
    
    # 1. Try Alchemy API (Faster)
    # Actually, standard Web3 'call' is universal. 
    # alchemy_getTokenMetadata is HTTP dependent. Let's stick to standard `decimals()` call.
    try:
        abi = [{"constant":True,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}]
        ctr = w3.eth.contract(address=token_address, abi=abi)
        dec = ctr.functions.decimals().call()
        TOKEN_META_CACHE[key] = dec
        return dec
    except:
        return 18 # Fallback
