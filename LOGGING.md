# IPTRADE Server Logging & Troubleshooting Guide

## Log File Locations

### Production Mode

When running the packaged Electron app, server logs are written to the **user data directory**:

#### macOS
```
~/Library/Application Support/iptradeapp/logs/
```

#### Windows
```
%APPDATA%\IPTRADE\logs\
```

#### Linux
```
~/.config/IPTRADE/logs/
```

### Log Files

| File | Purpose |
|------|---------|
| `server.log` | General server logs including startup, requests, and normal operations |
| `server-error.log` | Error logs including exceptions, failures, and stack traces |

### Quick Access to Logs

#### macOS
```bash
# View real-time server logs
tail -f ~/Library/Application\ Support/IPTRADE/logs/server.log

# View real-time error logs
tail -f ~/Library/Application\ Support/IPTRADE/logs/server-error.log

# Open logs directory in Finder
open ~/Library/Application\ Support/IPTRADE/logs/
```

#### Windows (PowerShell)
```powershell
# View logs
Get-Content "$env:APPDATA\IPTRADE\logs\server.log" -Tail 50 -Wait

# Open logs directory
explorer "$env:APPDATA\IPTRADE\logs"
```

#### Linux
```bash
# View real-time server logs
tail -f ~/.config/IPTRADE/logs/server.log

# View real-time error logs
tail -f ~/.config/IPTRADE/logs/server-error.log

# Open logs directory
xdg-open ~/.config/IPTRADE/logs/
```

## Log Format

All log entries include timestamps in ISO 8601 format:

```
[2025-10-07T12:34:56.789Z] Server Started Successfully!
[2025-10-07T12:34:57.123Z] 🌐 Server URL: http://localhost:30
```

## Common Issues & Solutions

### Issue: Server fails to start

**Symptoms:**
- App shows "Server Startup Error" dialog
- App exits immediately after launch

**Troubleshooting:**
1. Check `server-error.log` for the exact error message
2. Common causes:
   - Port 30 (or configured PORT) already in use
   - Missing server dependencies
   - Corrupted installation

**Solution:**
```bash
# Check what's using port 30
lsof -i :30  # macOS/Linux
netstat -ano | findstr :30  # Windows

# Kill process using the port (if needed)
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Issue: Port already in use

**Symptoms:**
- Log shows "EADDRINUSE" error
- Server retry attempts (1/3, 2/3, 3/3)

**Solution:**
The server automatically tries to kill processes on the port and retry. If it fails after 3 attempts:
1. Manually kill the process using the port
2. Restart the application

### Issue: Missing dependencies

**Symptoms:**
- Log shows "Cannot find module" errors
- Server crashes on startup

**Solution:**
1. Reinstall the application
2. If building from source, ensure `server/node_modules` is properly bundled

### Issue: Permission denied errors

**Symptoms:**
- Log shows "EACCES" or "EPERM" errors
- Cannot write to log files

**Solution:**
```bash
# macOS/Linux - Fix permissions
chmod -R 755 ~/Library/Application\ Support/IPTRADE/

# Windows - Run as Administrator once
```

## Development Mode Logging

In development mode, logs are output directly to the terminal/console:

```bash
# Start in development mode
npm run electron:dev
```

Server logs will appear with `[DEV SERVER]` prefix in the terminal.

## Understanding Log Messages

### Startup Sequence
```
🚀 IPTRADE Production Server Starting...
📂 Base Path: /path/to/userData
🔌 Port: 30
🔍 Checking for existing processes on port 30...
✅ Server Started Successfully!
🌐 Server URL: http://localhost:30
```

### Normal Operation
```
[2025-10-07T12:35:00.000Z] GET /api/status 200 - 5ms
[2025-10-07T12:35:01.000Z] POST /api/orders 201 - 15ms
```

### Error Messages
```
ERROR: ❌ Unable to start server on port 30 after 3 attempts
ERROR: 💡 Another application may be using this port
ERROR: Stack: Error: EADDRINUSE...
```

## Log Rotation

Logs are appended (not rotated automatically). To manage log size:

```bash
# Clear old logs manually
rm ~/Library/Application\ Support/IPTRADE/logs/server*.log
```

Or create a simple rotation script:

```bash
#!/bin/bash
LOG_DIR=~/Library/Application\ Support/IPTRADE/logs/
MAX_SIZE=10485760  # 10MB

for log in "$LOG_DIR"*.log; do
  if [ -f "$log" ] && [ $(stat -f%z "$log") -gt $MAX_SIZE ]; then
    mv "$log" "$log.old"
    touch "$log"
  fi
done
```

## Debugging Tips

### Enable Verbose Logging

Edit `server/src/production.js` to add more detailed logging:

```javascript
// Add after creating the server
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

### Check Server Health

```bash
# Test server is responding
curl http://localhost:30/api/status

# Expected response:
# {"status":"ok","version":"1.2.3"}
```

### Monitor Server Process

```bash
# macOS/Linux
ps aux | grep production.js

# Windows
tasklist | findstr node
```

## Getting Help

When reporting issues, please provide:

1. **OS and version** (e.g., macOS 13.0, Windows 11, Ubuntu 22.04)
2. **App version** (from Help > About)
3. **Last 50 lines of `server.log`**:
   ```bash
   tail -n 50 ~/Library/Application\ Support/IPTRADE/logs/server.log
   ```
4. **All of `server-error.log`**:
   ```bash
   cat ~/Library/Application\ Support/IPTRADE/logs/server-error.log
   ```
5. **Steps to reproduce** the issue

## Log Analysis Tools

### Search for specific errors
```bash
# macOS/Linux
grep "ERROR" ~/Library/Application\ Support/IPTRADE/logs/server-error.log

# Windows PowerShell
Select-String -Path "$env:APPDATA\IPTRADE\logs\server-error.log" -Pattern "ERROR"
```

### Count log entries by type
```bash
# macOS/Linux
grep -c "ERROR" ~/Library/Application\ Support/IPTRADE/logs/server-error.log
grep -c "✅" ~/Library/Application\ Support/IPTRADE/logs/server.log
```

### View logs from specific time range
```bash
# macOS/Linux
grep "2025-10-07T12:" ~/Library/Application\ Support/IPTRADE/logs/server.log
```

## Performance Monitoring

Server startup time and performance metrics are logged:

```
🕐 Started at: 2025-10-07T12:34:56.789Z
📊 Server is ready to accept connections
```

Track these timestamps to identify performance issues.

---

**Need more help?** Check the main [README.md](README.md) or open an issue on GitHub.
