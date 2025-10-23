#!/usr/bin/env bash

#==============================================================================================
# Cursor support for .NET Core debugging
#==============================================================================================

set -euo pipefail

# Resolve repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PID_FILE="$ROOT_DIR/.vscode/dotnet.pid"
LOG_FILE="$ROOT_DIR/.vscode/dotnet.out"
mkdir -p "$ROOT_DIR/.vscode"

# If already running, do nothing
if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$EXISTING_PID" ]] && ps -p "$EXISTING_PID" -o pid= >/dev/null 2>&1; then
    echo "dotnet app already running (PID $EXISTING_PID)"
    exit 0
  fi
fi

# Config
PORT="${PORT:-8081}"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://localhost:$PORT}"

# Start app in background and capture PID
nohup dotnet run --project "$ROOT_DIR/Portfolio.csproj" > "$LOG_FILE" 2>&1 &
DOTNET_PID=$!
echo "$DOTNET_PID" > "$PID_FILE"

# Wait for readiness
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-60}"
START_TIME="$(date +%s)"
until curl -sSf "http://localhost:$PORT" >/dev/null 2>&1; do
  sleep 0.2
  NOW="$(date +%s)"
  if (( NOW - START_TIME > MAX_WAIT_SECONDS )); then
    echo "Timed out waiting for app on port $PORT; see $LOG_FILE"
    exit 1
  fi
  if ! ps -p "$DOTNET_PID" -o pid= >/dev/null 2>&1; then
    echo "dotnet process terminated unexpectedly. See $LOG_FILE"
    exit 1
  fi
done

echo "App is ready on http://localhost:$PORT (PID $DOTNET_PID)"


