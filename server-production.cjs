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
      const resourcesPath = path.join(process.resourcesPath, 'server');
      console.log('🔍 [PRODUCTION] Checking resources path:', resourcesPath);
      
      // Verify the path exists
      if (fs.existsSync(resourcesPath)) {
        console.log('✅ [PRODUCTION] Resources path exists');
        return resourcesPath;
      } else {
        console.error('❌ [PRODUCTION] Resources path does not exist:', resourcesPath);
        // Fallback to app path
        const appPath = path.join(app.getAppPath(), 'server');
        console.log('🔍 [PRODUCTION] Trying app path:', appPath);
        if (fs.existsSync(appPath)) {
          console.log('✅ [PRODUCTION] App path exists');
          return appPath;
        }
        throw new Error(`Server directory not found in resources (${resourcesPath}) or app (${appPath})`);
      }
    } else {
      // Development: use project server directory
      const devPath = path.join(app.getAppPath(), 'server');
      console.log('🔍 [DEV] Using dev path:', devPath);
      return devPath;
    }
  } catch (error) {
    console.error('❌ [FALLBACK] Error getting base path:', error.message);
    const fallbackPath = path.join(process.cwd(), 'server');
    console.log('🔍 [FALLBACK] Using fallback path:', fallbackPath);
    return fallbackPath;
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
      const serverEntryPoint = path.join(basePath, 'src', 'production.cjs');

      console.log('🚀 [PRODUCTION] Starting full server...');
      console.log('📂 Server path:', basePath);
      console.log('📝 Logs path:', userDataPath);
      console.log('🔌 Port:', port);
      console.log('🎯 Entry point:', serverEntryPoint);

      // Verify server file exists
      if (!fs.existsSync(serverEntryPoint)) {
        console.error('❌', `Server entry point not found: ${serverEntryPoint}`);
        
        // Try minimal server as fallback
        const minimalServerPath = path.join(basePath, 'src', 'minimal-production.cjs');
        if (fs.existsSync(minimalServerPath)) {
          console.log('🔄 Falling back to minimal server...');
          serverEntryPoint = minimalServerPath;
        } else {
          const error = new Error(`No server entry point found. Tried: ${serverEntryPoint} and ${minimalServerPath}`);
          console.error('❌', error.message);
          reject(error);
          return;
        }
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

      console.log('🔧 [PRODUCTION] Environment setup:');
      console.log('  - PORT:', serverEnv.PORT);
      console.log('  - NODE_ENV:', serverEnv.NODE_ENV);
      console.log('  - ELECTRON_RESOURCES_PATH:', serverEnv.ELECTRON_RESOURCES_PATH);
      console.log('  - NODE_PATH:', serverEnv.NODE_PATH);
      console.log('  - Working directory:', basePath);

      // Fork the server process (better for Node.js scripts)
      serverProcess = fork(serverEntryPoint, [], {
        cwd: basePath,
        env: serverEnv,
        silent: false, // Let output go to parent's stdio
        execArgv: [] // No special flags needed for CommonJS
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
        } else if (message && message.type === 'server-error') {
          console.error('❌ Server reported error via IPC:', message.error);
          clearTimeout(startupTimeout);
          reject(new Error(`Server error: ${message.error.message}`));
        }
      });

      // Handle process exit
      serverProcess.on('close', (code) => {
        console.log(`[SERVER] Process exited with code ${code}`);
        serverProcess = null;

        if (!serverStarted) {
          clearTimeout(startupTimeout);
          
          // If the full server failed and we haven't tried minimal server yet, try it
          if (code === 9 && !serverEntryPoint.includes('minimal-production.cjs')) {
            console.log('🔄 Full server failed with exit code 9, trying minimal server...');
            const minimalServerPath = path.join(basePath, 'src', 'minimal-production.cjs');
            if (fs.existsSync(minimalServerPath)) {
              // Retry with minimal server
              setTimeout(() => {
                startProductionServer().then(resolve).catch(reject);
              }, 1000);
              return;
            }
          }
          
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