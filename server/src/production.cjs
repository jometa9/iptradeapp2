/**
 * Production Server Entry Point (CommonJS)
 * This file is spawned as a child process when the Electron app runs in production mode.
 * It runs the full server with all routes, controllers, and services.
 * Using CommonJS for better compatibility in packaged Electron apps.
 */

// Immediately log that we started to help debugging
console.log('[STARTUP] production.cjs starting...');
console.log('[STARTUP] Node version:', process.version);
console.log('[STARTUP] Platform:', process.platform);
console.log('[STARTUP] Current working directory:', process.cwd());
console.log('[STARTUP] Process arguments:', process.argv);
console.log('[STARTUP] Environment variables:');
console.log('  - PORT:', process.env.PORT);
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - ELECTRON_RESOURCES_PATH:', process.env.ELECTRON_RESOURCES_PATH);
console.log('  - NODE_PATH:', process.env.NODE_PATH);

console.log('[STARTUP] Loading modules...');

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

console.log('[STARTUP] Core modules loaded successfully');

// Load route loader
const { loadRoutes } = require('./routeLoader.cjs');

// Store routes globally
let routes = null;

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

const logFile = path.join(logsDir, 'server.log');
const errorLogFile = path.join(logsDir, 'server-error.log');

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
  // Write directly to stdout for Electron to capture
  originalConsoleLog(message);
  // Force flush stdout to ensure Electron sees the output immediately
  if (process.stdout && typeof process.stdout.write === 'function') {
    process.stdout.write(''); // Flush
  }
};

console.error = (...args) => {
  const message = args.join(' ');
  logWithTimestamp(`ERROR: ${message}`, true);
  // Write to stderr for Electron to capture
  originalConsoleError(`ERROR: ${message}`);
};

console.warn = (...args) => {
  const message = args.join(' ');
  logWithTimestamp(`WARN: ${message}`, false);
  // Write to stdout for Electron to capture
  originalConsoleWarn(`WARN: ${message}`);
};

// Create server function
async function createServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Load routes if not already loaded
  if (!routes) {
    console.log('[SERVER] Loading routes...');
    routes = await loadRoutes();
    console.log('[SERVER] Routes loaded successfully');
  }

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Swagger API documentation
  try {
    const swaggerUi = require('swagger-ui-express');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(routes.swaggerDocs));
  } catch (error) {
    console.warn('⚠️ Swagger UI not available:', error.message);
  }

  // Routes
  app.use('/api', routes.statusRoutes);
  app.use('/api', routes.orderRoutes);
  app.use('/api', routes.configRoutes);
  app.use('/api', routes.tradingConfigRoutes);

  // Keep these for now for compatibility
  app.use('/api', routes.copierStatusRoutes);
  app.use('/api', routes.csvRoutes);
  app.use('/api', routes.eventRoutes);
  app.use('/api/accounts', routes.accountsRoutes);
  app.use('/api/slave-config', routes.slaveConfigRoutes);
  app.use('/api/link-platforms', routes.linkPlatformsRoutes);

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
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

// Start server function
async function startProductionServer() {
  try {
    const PORT = process.env.PORT || 3000;

    console.log('='.repeat(60));
    console.log('🚀 IPTRADE Production Server Starting...');
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
    const { app } = await createServer();

    return new Promise((resolve, reject) => {
      const startAttempt = (attempt = 1) => {
        const server = app.listen(PORT, '127.0.0.1', (err) => {
          if (err) {
            console.error('Failed to start server:', err);
            reject(err);
            return;
          }

          console.log('');
          console.log('✅ Server Started Successfully!');
          console.log(`🌐 Server URL: http://localhost:${PORT}`);
          console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
          console.log('');
          console.log('📊 Server is ready to accept connections');
          console.log('='.repeat(60));

          // Send IPC message to parent process if available (when forked)
          if (process.send) {
            process.send({ type: 'server-started', port: PORT });
          }

          resolve(server);
        });

        server.on('error', async (err) => {
          if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${PORT} is in use (attempt ${attempt}/3)`);

            if (attempt < 3) {
              console.log('🔄 Retrying server startup...');
              await killProcessOnPort(PORT);
              setTimeout(() => {
                startAttempt(attempt + 1);
              }, 2000);
            } else {
              const errorMsg = `❌ Unable to start server on port ${PORT} after 3 attempts`;
              console.error(errorMsg);
              console.error('💡 Another application may be using this port');
              console.error('💡 Check the error log for details');
              reject(new Error(errorMsg));
              process.exit(1);
            }
          } else {
            console.error('❌ Server Error:', err);
            reject(err);
            process.exit(1);
          }
        });
      };

      startAttempt();
    });

  } catch (error) {
    console.error('💥 Fatal Error Starting Production Server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle process termination gracefully
const shutdownGracefully = (signal) => {
  console.log('');
  console.log(`🛑 Received ${signal} signal`);
  console.log('🔄 Shutting down server gracefully...');

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

// Start the server with error handling
startProductionServer().catch((error) => {
  console.error('💥 Failed to start server:', error);
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
      type: 'server-error', 
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
  }
  
  process.exit(1);
});
