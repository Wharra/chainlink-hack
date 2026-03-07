#!/bin/bash
# ChainGuard — one-shot setup script
# Run once after cloning the repo: bash setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

echo ""
echo "  ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗"
echo " ██╔════╝██║  ██║██╔══██╗██║████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗"
echo " ██║     ███████║███████║██║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║"
echo " ██║     ██╔══██║██╔══██║██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║"
echo " ╚██████╗██║  ██║██║  ██║██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝"
echo "  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝"
echo ""
echo "  Real-time DeFi risk sentinel — Chainlink Hackathon 2026"
echo ""

cd "$SCRIPT_DIR"

# ── 1. Python ────────────────────────────────────────────────
log "Checking Python 3.9+..."
if ! command -v python3 &>/dev/null; then
  err "Python 3 not found. Install it from https://www.python.org/downloads/"
fi
PY_VERSION=$(python3 -c 'import sys; print(sys.version_info[:2] >= (3,9))')
if [ "$PY_VERSION" != "True" ]; then
  err "Python 3.9+ required. Current: $(python3 --version)"
fi
log "Python OK — $(python3 --version)"

# ── 2. Virtual environment ───────────────────────────────────
log "Creating Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

log "Installing Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
log "Python dependencies installed."

# ── 3. Node / npm (dashboard) ───────────────────────────────
log "Checking Node.js..."
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install it from https://nodejs.org/"
fi
log "Node OK — $(node --version)"

log "Installing dashboard dependencies (npm)..."
cd "$SCRIPT_DIR/dashboard"
npm install --silent
log "Dashboard dependencies installed."

# ── 4. Bun (CRE workflow) ────────────────────────────────────
cd "$SCRIPT_DIR"
log "Checking Bun..."
if ! command -v bun &>/dev/null; then
  warn "Bun not found. Installing..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
log "Bun OK — $(bun --version)"

log "Installing CRE workflow dependencies (bun)..."
cd "$SCRIPT_DIR/cre/chainguard-risk"
bun install --silent
log "CRE dependencies installed."

# ── 5. Foundry (forge) ──────────────────────────────────────
cd "$SCRIPT_DIR"
log "Checking Foundry (forge)..."
if ! command -v forge &>/dev/null; then
  warn "Foundry not found. Installing..."
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi
log "Foundry OK — $(forge --version | head -1)"

# ── 6. .env setup ───────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  cp "$SCRIPT_DIR/.env-example" "$SCRIPT_DIR/.env"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  ACTION REQUIRED — fill in your API keys in .env${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  ALCHEMY_API_KEY   → https://dashboard.alchemy.com/"
  echo "  ETHERSCAN_API_KEY → https://etherscan.io/myapikey"
  echo "  GOOGLE_API_KEY    → https://aistudio.google.com/apikey"
  echo "  PRIVATE_KEY       → your Sepolia wallet private key (needs Sepolia ETH)"
  echo "  ANTHROPIC_API_KEY → https://console.anthropic.com/ (optional fallback)"
  echo ""
  echo "  Get free Sepolia ETH → https://faucets.chain.link/"
  echo ""
  echo -e "${YELLOW}  Then run: ./start.sh${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
else
  echo ""
  log ".env already exists — skipping copy."
  echo ""
  echo -e "${GREEN}Setup complete. Run: ./start.sh${NC}"
  echo ""
fi
