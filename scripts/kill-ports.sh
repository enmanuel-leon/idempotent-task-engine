#!/usr/bin/env bash
echo "Clearing processes on ports 3100 (API) and 5180 (Web)..."

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3100/tcp 5180/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti:3100 -ti:5180 | xargs kill -9 2>/dev/null || true
fi

echo "Ports 3100 and 5180 are now clear."
