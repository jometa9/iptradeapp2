/**
 * Production Server Manager
 * Spawns the full Node.js server (server/src/production.js) as a child process
 * and manages its lifecycle within the Electron app.
 */

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

let serverProcess = null;
const port = process.env.PORT || 3000;

/**
 * Get the correct base path for the app
 */
function getBasePath() {
  try {
    const { app } = require('electron');
    if (app.isPackaged) {
      // Production: use resources path where server files are bundled
      return path.join(process.resourcesPath, 'server');
    } else {
      // Development: use project server directory
      return path.join(app.getAppPath(), 'server');
    }
  } catch (error) {
    return path.join(process.cwd(), 'server');
  }
}

/**
 * Get the user data path for logs
 */
function getUserDataPath() {
  try {
    const { app } = require('electron');
    return app.getPath('userData');
  } catch (error) {
    return process.cwd();
  }
}

/**
 * Start the production server as a child process
 */
function startProductionServer() {
  return new Promise((resolve, reject) => {
    try {
      const basePath = getBasePath();
      const userDataPath = getUserDataPath();
      const serverEntryPoint = path.join(basePath, 'src', 'production.js');

      console.log('🚀 [PRODUCTION] Starting full server...');
      console.log('📂 Server path:', basePath);
      console.log('📝 Logs path:', userDataPath);
      console.log('🔌 Port:', port);
      console.log('🎯 Entry point:', serverEntryPoint);

      // Verify server file exists
      if (!fs.existsSync(serverEntryPoint)) {
        const error = new Error(`Server entry point not found: ${serverEntryPoint}`);
        console.error('❌', error.message);
        reject(error);
        return;
      }

      // Setup environment variables for the child process
      const serverEnv = {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production',
        ELECTRON_RESOURCES_PATH: userDataPath,
        // Add node_modules paths for production
        NODE_PATH: path.join(basePath, 'node_modules')
      };

      // Fork the server process (better for Node.js scripts)
      serverProcess = fork(serverEntryPoint, [], {
        cwd: basePath,
        env: serverEnv,
        silent: false, // Let output go to parent's stdio
        execArgv: [] // Don't inherit parent's exec arguments
      });

      console.log('🔄 Server process forked with PID:', serverProcess.pid);

      // Track server startup
      let serverStarted = false;
      const startupTimeout = setTimeout(() => {
        if (!serverStarted) {
          console.error('❌ Server startup timeout');
          reject(new Error('Server failed to start within 10 seconds'));
        }
      }, 10000);

      // Handle IPC messages from child process
      serverProcess.on('message', (message) => {
        console.log('[SERVER MESSAGE]', message);

        if (message && message.type === 'server-started') {
          if (!serverStarted) {
            serverStarted = true;
            clearTimeout(startupTimeout);
            console.log('✅ Server confirmed running via IPC');
            resolve({ port, basePath: userDataPath });
          }
        }
      });

      // Handle process exit
      serverProcess.on('close', (code) => {
        console.log(`[SERVER] Process exited with code ${code}`);
        serverProcess = null;

        if (!serverStarted) {
          clearTimeout(startupTimeout);
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      // Handle process errors
      serverProcess.on('error', (err) => {
        console.error('[SERVER] Process error:', err);
        clearTimeout(startupTimeout);

        if (!serverStarted) {
          reject(err);
        }
      });

    } catch (error) {
      console.error('❌ Failed to start production server:', error);
      reject(error);
    }
  });
}

/**
 * Stop the production server
 */
function stopProductionServer() {
  return new Promise((resolve) => {
    if (serverProcess) {
      console.log('🛑 Stopping production server...');

      // Give the process time to shutdown gracefully
      const shutdownTimeout = setTimeout(() => {
        if (serverProcess) {
          console.log('⚠️  Force killing server process');
          serverProcess.kill('SIGKILL');
          serverProcess = null;
        }
        resolve();
      }, 5000);

      // Try graceful shutdown first
      serverProcess.on('close', () => {
        clearTimeout(shutdownTimeout);
        console.log('✅ Server stopped successfully');
        serverProcess = null;
        resolve();
      });

      // Send shutdown signal (platform-specific)
      try {
        if (process.platform === 'win32') {
          // On Windows, use IPC message for graceful shutdown
          serverProcess.send('shutdown');
        } else {
          // On Unix-like systems, use SIGTERM
          serverProcess.kill('SIGTERM');
        }
      } catch (error) {
        console.error('Error sending shutdown signal:', error);
        clearTimeout(shutdownTimeout);
        serverProcess = null;
        resolve();
      }
    } else {
      console.log('ℹ️  No server process to stop');
      resolve();
    }
  });
}

/**
 * Get server URL
 */
function getServerUrl() {
  return `http://localhost:${port}`;
}

/**
 * Check if server is running
 */
function isServerRunning() {
  return serverProcess !== null && !serverProcess.killed;
}

module.exports = {
  startProductionServer,
  stopProductionServer,
  getServerUrl,
  isServerRunning
};