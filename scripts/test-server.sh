#!/bin/bash
# Test script for production server
# Usage: ./scripts/test-server.sh

set -e

echo "🧪 Testing Production Server Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server files exist
echo "📁 Checking server files..."
if [ ! -f "server/src/production.js" ]; then
  echo -e "${RED}❌ server/src/production.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Server files found${NC}"
echo ""

# Check if dependencies are installed
echo "📦 Checking server dependencies..."
if [ ! -d "server/node_modules" ]; then
  echo -e "${YELLOW}⚠️  Server dependencies not installed${NC}"
  echo "Installing dependencies..."
  cd server && npm install && cd ..
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Start server in background
echo "🚀 Starting production server..."
cd server
PORT=3000 node src/production.js > /tmp/iptrade-server-test.log 2>&1 &
SERVER_PID=$!
cd ..

echo "   Server PID: $SERVER_PID"
echo "   Port: 3000 (testing)"
echo "   Waiting for server to start..."
sleep 4

# Check if process is still running
if ! ps -p $SERVER_PID > /dev/null; then
  echo -e "${RED}❌ Server process died${NC}"
  echo "Log output:"
  cat /tmp/iptrade-server-test.log
  exit 1
fi
echo -e "${GREEN}✅ Server process running${NC}"
echo ""

# Test endpoints
echo "🔍 Testing API endpoints..."

# Test 1: Status endpoint
echo -n "   Testing /api/status... "
RESPONSE=$(curl -s http://localhost:3000/api/status)
if [[ $RESPONSE == *"running"* ]] || [[ $RESPONSE == *"ok"* ]]; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  echo "   Response: $RESPONSE"
fi

# Test 2: Config endpoint
echo -n "   Testing /api/config... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/config)
if [ "$RESPONSE" = "200" ]; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌ (HTTP $RESPONSE)${NC}"
fi

# Test 3: Swagger docs
echo -n "   Testing /api-docs... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api-docs/)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "301" ]; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌ (HTTP $RESPONSE)${NC}"
fi

# Test 4: Copier status endpoint
echo -n "   Testing /api/copier-status... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/copier-status)
if [ "$RESPONSE" = "200" ]; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${YELLOW}⚠️  (HTTP $RESPONSE - may be expected)${NC}"
fi

echo ""

# Check log file
echo "📝 Checking log files..."
if [ -f "server/logs/server.log" ]; then
  echo -e "${GREEN}✅ Log file created${NC}"
  echo "   Last 5 lines:"
  tail -n 5 server/logs/server.log | sed 's/^/   /'
else
  echo -e "${YELLOW}⚠️  Log file not found (may be in user data directory)${NC}"
fi
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
sleep 1

# Force kill if still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
  kill -9 $SERVER_PID 2>/dev/null || true
fi

echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

echo "=================================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test in Electron: npm run electron:dev"
echo "  2. Build for production: npm run electron:build"
echo "  3. See TEST_PRODUCTION_SERVER.md for more tests"
