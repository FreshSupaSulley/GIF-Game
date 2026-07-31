# DEV ALWAYS ASSUMES WE ARE RUNNING ON CONSISTENT PORTS!!

#!/bin/bash
# dev.sh - Boots the client, server, and Cloudflare tunnel for Discord Activity development.
# Usage: ./dev.sh

set -e

# Colors for log prefixes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $SERVER_PID $CLIENT_PID $TUNNEL_PID 2>/dev/null
  wait $SERVER_PID $CLIENT_PID $TUNNEL_PID 2>/dev/null
  echo "Done."
}

trap cleanup EXIT INT TERM

DIR="$(cd "$(dirname "$0")" && pwd)"

# Check .env exists
if [ ! -f "$DIR/.env" ]; then
  echo "Error: .env file not found at project root. Copy .env.example to .env and fill in your credentials."
  exit 1
fi

echo "Starting GIF Game dev environment..."
echo ""

# Start server
echo -e "${GREEN}[server]${NC} Starting Express server on :3001..."
cd "$DIR/packages/server"
npx tsx --env-file=../../.env --watch src/index.ts 2>&1 | sed "s/^/$(printf "${GREEN}[server]${NC} ")/" &
SERVER_PID=$!

# Start client
echo -e "${BLUE}[client]${NC} Starting Vite dev server on :5173..."
cd "$DIR/packages/client"
npx vite 2>&1 | sed "s/^/$(printf "${BLUE}[client]${NC} ")/" &
CLIENT_PID=$!

# Give servers a moment to start
sleep 2

# Start tunnel
echo -e "${RED}[tunnel]${NC} Starting Cloudflare tunnel → http://localhost:5173..."
npx cloudflared tunnel --url http://localhost:5173 2>&1 | sed "s/^/$(printf "${RED}[tunnel]${NC} ")/" &
TUNNEL_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Waiting for tunnel URL..."
echo " Copy the *.trycloudflare.com URL and add it to:"
echo " Discord Developer Portal → Activities → URL Mappings"
echo ""
echo " Map: /  →  {tunnel-url}"
echo ""
echo " Press Ctrl+C to stop all services."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
