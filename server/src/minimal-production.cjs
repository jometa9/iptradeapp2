/**
 * Minimal Production Server Entry Point (CommonJS)
 * This is a simplified version of the production server that provides
 * basic functionality when the full server fails to start.
 * Using CommonJS for better compatibility in packaged Electron apps.
 */

// Immediately log that we started to help debugging
console.log('[MINIMAL STARTUP] minimal-production.cjs starting...');
console.log('[MINIMAL STARTUP] Node version:', process.version);
console.log('[MINIMAL STARTUP] Platform:', process.platform);
console.log('[MINIMAL STARTUP] Current working directory:', process.cwd());
console.log('[MINIMAL STARTUP] Environment variables:');
console.log('  - PORT:', process.env.PORT);
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - ELECTRON_RESOURCES_PATH:', process.env.ELECTRON_RESOURCES_PATH);

console.log('[MINIMAL STARTUP] Loading modules...');

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

console.log('[MINIMAL STARTUP] Core modules loaded successfully');

// Get base path - in production, this will be the resources path
function getBasePath() {
  // Check if we're in a packaged Electron app
  if (process.env.ELECTRON_RESOURCES_PATH) {
    return process.env.ELECTRON_RESOURCES_PATH;
  }
  // Fallback to current working directory
  return process.cwd();
}

const basePath = getBasePath();

// Setup logging
const logsDir = path.join(basePath, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'minimal-server.log');
const errorLogFile = path.join(logsDir, 'minimal-server-error.log');

// Create log streams
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

// Helper function to log with timestamp
function logWithTimestamp(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  // Write to file
  if (isError) {
    errorLogStream.write(logMessage);
  } else {
    logStream.write(logMessage);
  }
}

// Store original console methods
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

// Override console methods to write to both log files AND stdout
console.log = (...args) => {
  const message = args.join(' ');
  logWithTimestamp(message, false);
  originalConsoleLog(message);
};

console.error = (...args) => {
  const message = args.join(' ');
  logWithTimestamp(`ERROR: ${message}`, true);
  originalConsoleError(`ERROR: ${message}`);
};

console.warn = (...args) => {
  const message = args.join(' ');
  logWithTimestamp(`WARN: ${message}`, false);
  originalConsoleWarn(`WARN: ${message}`);
};

// Create minimal server function
async function createMinimalServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Basic middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic health check endpoint
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      server: 'minimal',
      timestamp: new Date().toISOString(),
      port: PORT
    });
  });

  // Basic info endpoint
  app.get('/api/info', (req, res) => {
    res.json({
      server: 'IPTRADE Minimal Server',
      version: '1.0.0',
      mode: 'minimal',
      timestamp: new Date().toISOString()
    });
  });

  // Fallback endpoint for any other requests
  app.use('*', (req, res) => {
    res.status(503).json({
      error: 'Minimal server mode',
      message: 'Full server functionality not available',
      server: 'minimal'
    });
  });

  return { app, PORT };
}

// Kill process on port function (simplified)
async function killProcessOnPort(port) {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    if (process.platform === 'win32') {
      await execAsync(`netstat -ano | findstr :${port}`);
    } else {
      await execAsync(`lsof -ti:${port} | xargs kill -9`);
    }
  } catch (error) {
    // Ignore errors - port might not be in use
  }
}

// Start minimal server function
async function startMinimalServer() {
  try {
    const PORT = process.env.PORT || 3000;

    console.log('='.repeat(60));
    console.log('🚀 IPTRADE Minimal Server Starting...');
    console.log('='.repeat(60));
    console.log(`📂 Base Path: ${basePath}`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`📝 Log File: ${logFile}`);
    console.log(`❌ Error Log File: ${errorLogFile}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // Kill any existing processes on the port
    console.log(`🔍 Checking for existing processes on port ${PORT}...`);
    await killProcessOnPort(PORT);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create and start the server
    const { app } = await createMinimalServer();

    return new Promise((resolve, reject) => {
      const startAttempt = (attempt = 1) => {
        const server = app.listen(PORT, '127.0.0.1', (err) => {
          if (err) {
            console.error('Failed to start minimal server:', err);
            reject(err);
            return;
          }

          console.log('');
          console.log('✅ Minimal Server Started Successfully!');
          console.log(`🌐 Server URL: http://localhost:${PORT}`);
          console.log(`📊 Health Check: http://localhost:${PORT}/api/status`);
          console.log('');
          console.log('📊 Minimal server is ready to accept connections');
          console.log('⚠️  Note: Limited functionality available in minimal mode');
          console.log('='.repeat(60));

          // Send IPC message to parent process if available (when forked)
          if (process.send) {
            process.send({ type: 'minimal-server-started', port: PORT });
          }

          resolve(server);
        });

        server.on('error', async (err) => {
          if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${PORT} is in use (attempt ${attempt}/3)`);

            if (attempt < 3) {
              console.log('🔄 Retrying minimal server startup...');
              await killProcessOnPort(PORT);
              setTimeout(() => {
                startAttempt(attempt + 1);
              }, 2000);
            } else {
              const errorMsg = `❌ Unable to start minimal server on port ${PORT} after 3 attempts`;
              console.error(errorMsg);
              reject(new Error(errorMsg));
              process.exit(1);
            }
          } else {
            console.error('❌ Minimal Server Error:', err);
            reject(err);
            process.exit(1);
          }
        });
      };

      startAttempt();
    });

  } catch (error) {
    console.error('💥 Fatal Error Starting Minimal Server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle process termination gracefully
const shutdownGracefully = (signal) => {
  console.log('');
  console.log(`🛑 Received ${signal} signal`);
  console.log('🔄 Shutting down minimal server gracefully...');

  // Flush log streams
  logStream.end();
  errorLogStream.end();

  // Exit after a short delay to allow logs to flush
  setTimeout(() => {
    process.exit(0);
  }, 500);
};

// Handle POSIX signals (Unix/Linux/macOS)
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

// Handle Windows signals
if (process.platform === 'win32') {
  // Windows doesn't support POSIX signals well, so we use IPC
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      shutdownGracefully('shutdown message');
    }
  });

  // Also handle Ctrl+C on Windows
  const readline = require('readline');
  if (process.stdin && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', () => shutdownGracefully('SIGINT'));
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);

  // Flush logs before exit
  logStream.end();
  errorLogStream.end();

  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Start the minimal server with error handling
startMinimalServer().catch((error) => {
  console.error('💥 Failed to start minimal server:', error);
  console.error('💥 Error details:', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    errno: error.errno,
    syscall: error.syscall
  });
  
  // Send error message to parent process if available
  if (process.send) {
    process.send({ 
      type: 'minimal-server-error', 
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
  }
  
  process.exit(1);
});
