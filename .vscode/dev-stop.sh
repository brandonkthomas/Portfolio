#!/usr/bin/env bash

#==============================================================================================
# Cursor support for .NET Core debugging
#==============================================================================================

set -euo pipefail

# Resolve repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PID_FILE="$ROOT_DIR/.vscode/dotnet.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found; nothing to stop."
  exit 0
fi

PID="$(cat "$PID_FILE" || true)"
if [[ -z "$PID" ]]; then
  rm -f "$PID_FILE"
  echo "Empty PID file; nothing to stop."
  exit 0
fi

if ps -p "$PID" -o pid= >/dev/null 2>&1; then
  # Graceful stop (SIGINT similar to Ctrl+C)
  kill -INT "$PID" || true
  for _ in {1..50}; do
    if ! ps -p "$PID" -o pid= >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  # Escalate if needed
  if ps -p "$PID" -o pid= >/dev/null 2>&1; then
    kill -TERM "$PID" || true
    sleep 0.5
  fi
  if ps -p "$PID" -o pid= >/dev/null 2>&1; then
    kill -KILL "$PID" || true
  fi
fi

rm -f "$PID_FILE"
echo "dotnet app stopped"


