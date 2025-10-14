# Testing Production Server Setup

This guide helps you test the production server configuration before building the full Electron app.

## Quick Test - Standalone Server

Test that the production server can start independently:

```bash
# From project root
cd server
node src/production.js
```

**Expected output:**
```
============================================================
🚀 IPTRADE Production Server Starting...
============================================================
📂 Base Path: /current/directory
🔌 Port: 30
📝 Log File: /current/directory/logs/server.log
❌ Error Log File: /current/directory/logs/server-error.log
🕐 Started at: 2025-10-07T...
============================================================
🔍 Checking for existing processes on port 30...

✅ Server Started Successfully!
🌐 Server URL: http://localhost:30
📚 API Documentation: http://localhost:30/api-docs

📊 Server is ready to accept connections
============================================================
```

## Test Server Endpoints

With the server running, test the API endpoints:

```bash
# Test basic status endpoint
curl http://localhost:30/api/status
# Expected: {"status":"ok","version":"..."}

# Test Swagger documentation
open http://localhost:30/api-docs  # macOS
# Or visit in browser

# Test other endpoints
curl http://localhost:30/api/config
curl http://localhost:30/api/copier-status
curl http://localhost:30/api/csv/accounts
```

## Test in Electron Development Mode

Test the server integration with Electron:

```bash
# Stop standalone server first (Ctrl+C)

# Start Electron in dev mode
npm run electron:dev
```

**Expected behavior:**
1. Vite dev server starts on port 5174
2. Backend server starts on port 30
3. Electron window opens
4. Check console for server startup messages

## Test Production Build Locally

Before distributing, test the production build:

### Step 1: Build the app

```bash
# Build frontend and server
npm run build

# Build Electron app (macOS example)
npm run electron:build
```

### Step 2: Check bundled files

Verify the server files are included:

```bash
# macOS
ls -la release/mac/IPTRADE.app/Contents/Resources/server/

# Windows
dir release\win-unpacked\resources\server\

# Should see:
# - src/
# - node_modules/
# - package.json
# - config/
```

### Step 3: Run the packaged app

```bash
# macOS
open release/mac/IPTRADE.app

# Windows
.\release\win-unpacked\IPTRADE.exe

# Linux
./release/linux-unpacked/iptrade
```

### Step 4: Check logs

After running the app, check that logs are created:

```bash
# macOS
ls -la ~/Library/Application\ Support/IPTRADE/logs/
cat ~/Library/Application\ Support/IPTRADE/logs/server.log

# Windows
dir %APPDATA%\IPTRADE\logs
type %APPDATA%\IPTRADE\logs\server.log

# Linux
ls -la ~/.config/IPTRADE/logs/
cat ~/.config/IPTRADE/logs/server.log
```

## Troubleshooting Tests

### Test fails: "Port already in use"

```bash
# Find and kill process on port 30
# macOS/Linux:
lsof -ti:30 | xargs kill -9

# Windows:
netstat -ano | findstr :30
taskkill /PID <PID> /F
```

### Test fails: "Cannot find module"

Check that server dependencies are installed:

```bash
cd server
npm install
cd ..
```

### Test fails: Server doesn't start in packaged app

1. Check if `server` directory exists in resources:
   ```bash
   # macOS
   ls -la release/mac/IPTRADE.app/Contents/Resources/server/
   ```

2. Check if `node_modules` is included:
   ```bash
   # macOS
   ls -la release/mac/IPTRADE.app/Contents/Resources/server/node_modules/
   ```

3. Check electron-builder config in `package.json`:
   ```json
   "extraResources": [
     {
       "from": "server",
       "to": "server",
       "filter": ["**/*"]
     }
   ]
   ```

### Test fails: Logs not created

Check write permissions:

```bash
# macOS/Linux
chmod -R 755 ~/Library/Application\ Support/IPTRADE/

# Test log directory creation
mkdir -p ~/Library/Application\ Support/IPTRADE/logs/
touch ~/Library/Application\ Support/IPTRADE/logs/test.log
```

## Automated Test Script

Create a simple test script:

```bash
#!/bin/bash
# test-production-server.sh

echo "Testing Production Server Setup..."

# Start server in background
cd server
node src/production.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test endpoint
RESPONSE=$(curl -s http://localhost:30/api/status)

if [[ $RESPONSE == *"ok"* ]]; then
  echo "✅ Server test passed!"
  echo "Response: $RESPONSE"
else
  echo "❌ Server test failed!"
  echo "Response: $RESPONSE"
fi

# Cleanup
kill $SERVER_PID

cd ..
```

Make it executable:
```bash
chmod +x test-production-server.sh
./test-production-server.sh
```

## Performance Testing

Test server performance under load:

```bash
# Install Apache Bench if not available
# macOS: brew install httpd
# Ubuntu: sudo apt-get install apache2-utils

# Simple load test
ab -n 1000 -c 10 http://localhost:30/api/status

# Expected: All requests should succeed (200 OK)
```

## Checklist Before Production Release

- [ ] Standalone server starts successfully
- [ ] All API endpoints respond correctly
- [ ] Server integrates with Electron dev mode
- [ ] Production build includes server files
- [ ] Packaged app starts server successfully
- [ ] Logs are created in correct location
- [ ] Logs contain meaningful information
- [ ] Server handles errors gracefully
- [ ] Server stops cleanly on app exit
- [ ] Port conflicts are handled properly

## Common Test Scenarios

### Scenario 1: Fresh install
1. Build and package app
2. Install on clean system (VM recommended)
3. Launch app
4. Verify server starts
5. Check log files created
6. Test API endpoints from frontend

### Scenario 2: Update/upgrade
1. Install previous version
2. Run once to create config files
3. Install new version over old
4. Launch app
5. Verify server starts with existing config
6. Check backward compatibility

### Scenario 3: Crash recovery
1. Start app
2. Force kill server process (not Electron)
3. Restart app
4. Verify server restarts successfully
5. Check error logs for issues

### Scenario 4: Multiple instances
1. Start app
2. Try starting second instance
3. Verify single instance lock works
4. Or verify port conflict handling

## Next Steps

After successful testing:

1. **Tag release**: `git tag -a v1.2.3 -m "Production server implementation"`
2. **Push tag**: `git push origin v1.2.3`
3. **Create release**: `npm run publish` (if GitHub releases configured)
4. **Document**: Update README with any new deployment instructions
5. **Monitor**: Check logs from early users for issues

## Additional Resources

- [LOGGING.md](LOGGING.md) - Complete logging documentation
- [README.md](README.md) - Main project documentation
- Server source: `server/src/production.js`
- Server manager: `server-production.cjs`

---

**Questions or issues?** Open an issue on GitHub with test results and log files.
