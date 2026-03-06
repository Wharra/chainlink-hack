#!/bin/bash
# ChainGuard — stop all services

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGS="$SCRIPT_DIR/logs"

GREEN='\033[0;32m'
NC='\033[0m'

stop_pid() {
  local NAME=$1
  local PIDFILE="$LOGS/$NAME.pid"
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null
      echo -e "${GREEN}[stop]${NC} $NAME (pid $PID)"
    fi
    rm -f "$PIDFILE"
  fi
}

stop_pid "risk_api"
stop_pid "dashboard_api"
stop_pid "sentry_evm"
stop_pid "golden_bridge"
stop_pid "batch_exploit"
stop_pid "vite"

# Clean up any leftover processes on our ports
for PORT in 8000 8001 5173; do
  PID=$(lsof -ti:$PORT 2>/dev/null)
  [ -n "$PID" ] && kill -9 $PID 2>/dev/null
done

echo "Done."
