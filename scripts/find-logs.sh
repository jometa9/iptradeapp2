#!/bin/bash
# Script to find and display IPTRADE logs

echo "🔍 Searching for IPTRADE logs..."
echo ""

# Possible log locations
LOCATIONS=(
  "$HOME/Library/Application Support/IPTRADE/logs"
  "$HOME/Library/Application Support/iptradeapp/logs"
  "$HOME/Library/Application Support/com.iptrade.app/logs"
  "./server/logs"
  "/tmp/iptrade-logs"
)

FOUND=0

for location in "${LOCATIONS[@]}"; do
  if [ -d "$location" ]; then
    echo "✅ Found logs at: $location"
    echo ""

    if [ -f "$location/server.log" ]; then
      echo "📄 server.log (last 20 lines):"
      echo "---"
      tail -n 20 "$location/server.log"
      echo ""
    fi

    if [ -f "$location/server-error.log" ]; then
      echo "❌ server-error.log (last 20 lines):"
      echo "---"
      tail -n 20 "$location/server-error.log"
      echo ""
    fi

    FOUND=1
    break
  fi
done

if [ $FOUND -eq 0 ]; then
  echo "❌ No logs found in standard locations"
  echo ""
  echo "Checking if app is running..."
  if ps aux | grep -i iptrade | grep -v grep > /dev/null; then
    echo "✅ App is running"
    echo ""
    echo "App processes:"
    ps aux | grep -i iptrade | grep -v grep
  else
    echo "❌ App is not running"
  fi
  echo ""
  echo "Try running the app first:"
  echo "  open release/mac-arm64/IPTRADE.app"
  echo ""
  echo "Or check Console.app for system logs:"
  echo "  open /Applications/Utilities/Console.app"
  echo "  Filter for: IPTRADE"
fi

echo ""
echo "Manual check commands:"
echo "  # List all possible locations"
for location in "${LOCATIONS[@]}"; do
  echo "  ls -la \"$location\" 2>/dev/null"
done
