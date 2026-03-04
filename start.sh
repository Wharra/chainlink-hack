#!/bin/bash
# ChainGuard — start all services

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin/activate"
LOGS="$SCRIPT_DIR/logs"

mkdir -p "$LOGS"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[start]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err() { echo -e "${RED}[error]${NC} $1"; }

# Activate venv
if [ ! -f "$VENV" ]; then
  err "Virtual environment not found at .venv — run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi
source "$VENV"

# Kill any leftovers on our ports
for PORT in 8000 8001; do
  PID=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    warn "Port $PORT already in use (pid $PID) — killing"
    kill -9 $PID 2>/dev/null
    sleep 0.5
  fi
done

cd "$SCRIPT_DIR"

# 1. Risk API (port 8000)
log "Starting Risk API (port 8000)..."
nohup python risk_api.py > "$LOGS/risk_api.log" 2>&1 &
echo $! > "$LOGS/risk_api.pid"

# 2. Dashboard API (port 8001)
log "Starting Dashboard API (port 8001)..."
nohup python dashboard_api.py > "$LOGS/dashboard_api.log" 2>&1 &
echo $! > "$LOGS/dashboard_api.pid"

# 3. EVM Sentry
log "Starting EVM Sentry..."
nohup python sentry_evm.py > "$LOGS/sentry_evm.log" 2>&1 &
echo $! > "$LOGS/sentry_evm.pid"

# 4. Golden Bridge
log "Starting Golden Bridge..."
nohup python golden_bridge.py > "$LOGS/golden_bridge.log" 2>&1 &
echo $! > "$LOGS/golden_bridge.pid"

# 5. Wait for APIs to be ready, then start frontend
sleep 2

log "Starting dashboard (Vite dev server)..."
cd "$SCRIPT_DIR/dashboard"
npm run dev &
echo $! > "$LOGS/vite.pid"

cd "$SCRIPT_DIR"

sleep 1
echo ""
echo -e "${GREEN}ChainGuard is running.${NC}"
echo ""
echo "  Dashboard   →  http://localhost:5173"
echo "  Risk API    →  http://localhost:8000/health"
echo "  Logs        →  ./logs/"
echo ""
echo -e "Run ${YELLOW}./stop.sh${NC} to stop everything."
