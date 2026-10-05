#!/usr/bin/env bash
echo "Clearing processes on ports 3000 (API) and 5173 (Web)..."

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 5173/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 -ti:5173 | xargs kill -9 2>/dev/null || true
fi

echo "Ports 3000 and 5173 are now clear."
