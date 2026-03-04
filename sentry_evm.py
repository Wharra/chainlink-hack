import time
import requests
import os
from web3 import Web3
from dotenv import load_dotenv
import utils

load_dotenv()

# --- CONFIGURATION ---
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
alchemy_key = os.getenv("ALCHEMY_API_KEY")

if not alchemy_key:
    print("ERROR: ALCHEMY_API_KEY is missing!")
else:
    print(f"DEBUG: Alchemy Key: {alchemy_key[:4]}...{alchemy_key[-4:]}")

ETH_RPC = f"https://eth-mainnet.g.alchemy.com/v2/{alchemy_key}"

# --- UNISWAP ADDRESSES (Ethereum Mainnet) ---
UNISWAP_V3_FACTORY    = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
UNISWAP_V4_POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90"
ZERO_ADDRESS          = "0x0000000000000000000000000000000000000000"

# --- EVENT TOPICS (computed from Solidity signatures) ---
# keccak256("PoolCreated(address,address,uint24,int24,address)")
V3_POOL_CREATED_TOPIC = "0x" + Web3.keccak(text="PoolCreated(address,address,uint24,int24,address)").hex()
# keccak256("Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)")
V4_INITIALIZE_TOPIC   = "0x" + Web3.keccak(text="Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)").hex()

# Known safe tokens - no need to analyze
SAFE_TOKENS = {
    Web3.to_checksum_address("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),  # WETH
    Web3.to_checksum_address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),  # USDC
    Web3.to_checksum_address("0xdAC17F958D2ee523a2206206994597C13D831ec7"),  # USDT
    Web3.to_checksum_address("0x6B175474E89094C44Da98b954EedeAC495271d0F"),  # DAI
    Web3.to_checksum_address("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"),  # WBTC
    Web3.to_checksum_address("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),  # UNI
    Web3.to_checksum_address("0x514910771AF9Ca656af840dff83E8264EcF986CA"),  # LINK
    Web3.to_checksum_address("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE"),  # SHIB
    Web3.to_checksum_address("0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0"),  # MATIC/POL
    Web3.to_checksum_address("0x4d224452801ACEd8B2F0aebE155379bb5D594381"),  # APE
    Web3.to_checksum_address("0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"),  # stETH
    Web3.to_checksum_address("0xD533a949740bb3306d119CC777fa900bA034cd52"),  # CRV
    Web3.to_checksum_address("0xc00e94Cb662C3520282E6f5717214004A7f26888"),  # COMP
    Web3.to_checksum_address("0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2"),  # MKR
    Web3.to_checksum_address("0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e"),  # YFI
    Web3.to_checksum_address("0x6B3595068778DD592e39A122f4f5a5cF09C90fE2"),  # SUSHI
    Web3.to_checksum_address("0xBe9895146f7AF43049ca1c1AE358B0541Ea49704"),  # cbETH
    Web3.to_checksum_address("0xae78736Cd615f374D3085123A210448E74Fc6393"),  # rETH
}

BACKFILL_BLOCKS = 2000  # ~7h of history on startup (~200 API calls)
SAVE_DIR = utils.CANDIDATES_DIR
os.makedirs(SAVE_DIR, exist_ok=True)


# --- HELPERS ---

def get_verified_source(address):
    """Fetches verified source code from Etherscan."""
    url = (
        f"https://api.etherscan.io/v2/api"
        f"?chainid=1&module=contract&action=getsourcecode"
        f"&address={address}&apikey={ETHERSCAN_API_KEY}"
    )
    try:
        r = requests.get(url, timeout=10).json()
        if r['status'] == '1' and r['result'][0]['SourceCode']:
            return r['result'][0]['SourceCode']
    except Exception as e:
        print(f"  [ETHERSCAN] Error for {address}: {e}")
    return None


def save_contract(label, address, source, context=""):
    """Saves the source code with context for Gemini analysis."""
    filename = os.path.join(SAVE_DIR, f"ETHEREUM_{address}.sol")
    # Avoid overwriting an already-analyzed file
    if os.path.exists(filename):
        return
    header = f"// [CONTEXT] {context}\n// Address: {address}\n\n"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(header + source)
    print(f"  [SAVE] {label} → {address[:12]}... saved for analysis")


def is_safe_token(address):
    """Returns True if the address is a known safe token (no need to analyze)."""
    try:
        return Web3.to_checksum_address(address) in SAFE_TOKENS
    except:
        return False


# --- UNISWAP V3: Traitement d'un nouveau pool ---

def process_v3_pool(token0, token1, fee, pool_address):
    """
    A new Uniswap V3 pool was just created.
    Analyzes unknown tokens: are they honeypots or rug pulls?
    """
    fee_pct = fee / 10000
    print(f"\n[V3 POOL] New pool detected!")
    print(f"  Token0 : {token0}")
    print(f"  Token1 : {token1}")
    print(f"  Fee    : {fee_pct}%  |  Pool: {pool_address[:12]}...")

    for label, addr in [("TOKEN0", token0), ("TOKEN1", token1)]:
        if is_safe_token(addr):
            print(f"  [SKIP] {label} ({addr[:12]}...) = known safe token")
            continue

        print(f"  [FETCH] Code source de {label}: {addr[:12]}...")
        source = get_verified_source(addr)

        if source:
            context = (
                f"ERC20 token deployed in a Uniswap V3 pool. "
                f"Pair: {token0[:10]}/{token1[:10]} | Fee: {fee_pct}% | Pool: {pool_address}. "
                f"Analyze for honeypot, rug pull, unlimited mint, blacklist."
            )
            save_contract(f"V3-{label}", addr, source, context)
        else:
            print(f"  [SKIP] {label} not verified on Etherscan (not yet or closed-source)")

        time.sleep(0.5)  # Respect Etherscan rate limit


# --- UNISWAP V4: New hook processing ---

def process_v4_hook(hook_address, currency0, currency1, fee):
    """
    A new Uniswap V4 pool with hook was just initialized.
    Analyzes the hook: can it steal funds or manipulate prices?
    """
    print(f"\n[V4 HOOK] New hook detected!")
    print(f"  Hook      : {hook_address}")
    print(f"  Currency0 : {currency0}")
    print(f"  Currency1 : {currency1}")
    print(f"  Fee       : {fee / 10000}%")

    print(f"  [FETCH] Code source du hook: {hook_address[:12]}...")
    source = get_verified_source(hook_address)

    if source:
        context = (
            f"Uniswap V4 hook deployed on pool {currency0[:10]}/{currency1[:10]}. "
            f"Fee: {fee / 10000}%. "
            f"Analyze callbacks: beforeSwap, afterSwap, beforeAddLiquidity, "
            f"afterRemoveLiquidity to detect fund theft, price manipulation, "
            f"liquidity drain, or admin backdoor."
        )
        save_contract("V4-HOOK", hook_address, source, context)
    else:
        print(f"  [SKIP] Hook not verified on Etherscan")


# --- ABI DECODING ---

def decode_topic_address(topic):
    """Extracts an address from an indexed topic (bytes32 padded)."""
    h = topic.hex() if hasattr(topic, "hex") else topic
    return Web3.to_checksum_address("0x" + h[-40:])

def decode_data_address(data_hex, word_index):
    """Extracts an address from ABI data (each word = 32 bytes = 64 hex chars)."""
    word = data_hex[word_index * 64 : word_index * 64 + 64]
    return Web3.to_checksum_address("0x" + word[-40:])

def decode_data_uint(data_hex, word_index):
    """Extracts an integer from ABI data."""
    word = data_hex[word_index * 64 : word_index * 64 + 64]
    return int(word, 16)

def to_hex(data):
    """Normalizes data (bytes or str) to hex without '0x' prefix."""
    if isinstance(data, (bytes, bytearray)):
        return data.hex()
    return data[2:] if data.startswith("0x") else data


# --- SCANNER: Block range scan ---

def rpc_get_logs(address, topic, from_block, to_block):
    """
    Direct JSON-RPC call to Alchemy for eth_getLogs.
    Returns log list or [] on error.
    """
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getLogs",
        "params": [{
            "address": address,
            "topics":  [topic],
            "fromBlock": hex(from_block),
            "toBlock":   hex(to_block),
        }],
        "id": 1
    }
    resp = requests.post(ETH_RPC, json=payload, timeout=10)
    body = resp.json()
    if "error" in body:
        raise Exception(f"Alchemy RPC error: {body['error']}")
    return body.get("result", [])


def scan_blocks(w3, from_block, to_block):
    """
    Scans a block range via direct JSON-RPC (eth_getLogs).
    Detects: Uniswap V3 pools (PoolCreated) + V4 hooks (Initialize).
    """
    chunk_size = 10  # Strict limit of Alchemy free tier plan

    for chunk_start in range(from_block, to_block + 1, chunk_size):
        chunk_end = min(chunk_start + chunk_size - 1, to_block)

        # --- V3: PoolCreated ---
        # topics[1]=token0, topics[2]=token1, topics[3]=fee
        # data = abi.encode(int24 tickSpacing, address pool)
        try:
            logs = rpc_get_logs(UNISWAP_V3_FACTORY, V3_POOL_CREATED_TOPIC, chunk_start, chunk_end)
            if logs:
                print(f"  [V3] {len(logs)} pool(s) (blocks {chunk_start}-{chunk_end})")
            for log in logs:
                token0 = decode_topic_address(log["topics"][1])
                token1 = decode_topic_address(log["topics"][2])
                fee    = int(log["topics"][3], 16)
                data   = to_hex(log["data"])
                pool   = decode_data_address(data, 1)  # word 0=tickSpacing, word 1=pool
                process_v3_pool(token0, token1, fee, pool)
        except Exception as e:
            print(f"  [V3] Erreur {chunk_start}-{chunk_end}: {e}")

        # --- V4: Initialize (uniquement si hook non-zero) ---
        # topics[1]=id, topics[2]=currency0, topics[3]=currency1
        # data = abi.encode(uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)
        try:
            logs = rpc_get_logs(UNISWAP_V4_POOL_MANAGER, V4_INITIALIZE_TOPIC, chunk_start, chunk_end)
            hooks_found = []
            for log in logs:
                currency0 = decode_topic_address(log["topics"][2])
                currency1 = decode_topic_address(log["topics"][3])
                data      = to_hex(log["data"])
                fee       = decode_data_uint(data, 0)    # word 0 = fee
                hooks     = decode_data_address(data, 2) # word 2 = hooks
                if hooks != Web3.to_checksum_address(ZERO_ADDRESS):
                    hooks_found.append((hooks, currency0, currency1, fee))
            if hooks_found:
                print(f"  [V4] {len(hooks_found)} hook(s) (blocks {chunk_start}-{chunk_end})")
            for (hooks, currency0, currency1, fee) in hooks_found:
                process_v4_hook(hooks, currency0, currency1, fee)
        except Exception as e:
            print(f"  [V4] Erreur {chunk_start}-{chunk_end}: {e}")

        time.sleep(0.2)  # Respecter le rate limit Alchemy


# --- MAIN ---

def main():
    print("=" * 60)
    print("ChainGuard Sentry - Uniswap V3 + V4 Hook Monitor")
    print("=" * 60)

    # Ethereum connection
    print(f"\n[RPC] Connecting to Ethereum mainnet...")
    w3 = Web3(Web3.HTTPProvider(ETH_RPC))

    if not w3.is_connected():
        print("[ERROR] Cannot connect to Ethereum!")
        return

    current_block = w3.eth.block_number
    print(f"[RPC] Connected! Current block: #{current_block}")

    print(f"\n[MONITOR] Watching:")
    print(f"  → Uniswap V3 Factory:      {UNISWAP_V3_FACTORY}")
    print(f"  → V3 topic:                {V3_POOL_CREATED_TOPIC}")
    print(f"  → Uniswap V4 PoolManager:  {UNISWAP_V4_POOL_MANAGER}")
    print(f"  → V4 topic:                {V4_INITIALIZE_TOPIC}")
    print(f"  → Safe tokens ignored:     {len(SAFE_TOKENS)} (WETH, USDC, USDT...)")
    print(f"  → Saving to:               {SAVE_DIR}")

    # Backfill: fetch recent events
    backfill_start = current_block - BACKFILL_BLOCKS
    print(f"\n[BACKFILL] Scanning last {BACKFILL_BLOCKS} blocks ({backfill_start} → {current_block})...")
    scan_blocks(w3, backfill_start, current_block)
    print(f"[BACKFILL] Done!\n")

    # Main loop - real-time monitoring
    last_block = current_block
    print("[LIVE] Real-time monitoring active (1 scan / ~12s)...")
    print("-" * 60)

    while True:
        try:
            tip = w3.eth.block_number

            if tip > last_block:
                print(f"[SCAN] New blocks: {last_block + 1} → {tip}")
                scan_blocks(w3, last_block + 1, tip)
                last_block = tip

            time.sleep(12)  # ~1 Ethereum block = 12 seconds

        except KeyboardInterrupt:
            print("\n[EXIT] Sentry stopped.")
            break
        except Exception as e:
            print(f"[ERROR] {e}")
            time.sleep(30)


if __name__ == "__main__":
    main()
