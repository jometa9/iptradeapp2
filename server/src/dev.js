import dotenv from 'dotenv';
import fs, { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { checkAccountActivity } from './controllers/accountsController.js';
import linkPlatformsController from './controllers/linkPlatformsController.js';
import { killProcessOnPort } from './controllers/ordersController.js';
import { createServer } from './standalone.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Load environment variables from root .env only
// Try to load from current directory first, then from parent directory
const rootEnvPath = join(process.cwd(), '.env');
const parentEnvPath = join(process.cwd(), '..', '.env');

console.log('🔍 Checking for .env files:');
console.log('- Current directory .env:', rootEnvPath);
console.log('- Parent directory .env:', parentEnvPath);

// Check which path exists and load it
if (existsSync(rootEnvPath)) {
  console.log('✅ Loading .env from current directory');
  dotenv.config({ path: rootEnvPath });
} else if (existsSync(parentEnvPath)) {
  console.log('✅ Loading .env from parent directory');
  dotenv.config({ path: parentEnvPath });
} else {
  console.warn('⚠️ No .env file found in current or parent directory');
}

const { app } = createServer();
const DEV_PORT = process.env.PORT || 30;

// Cache para controlar el auto-link
const AUTO_LINK_CACHE_FILE = join(__dirname, '../config/auto_link_cache.json');

// Endpoint simple para limpiar cache
app.post('/api/clear-auto-link-cache', (req, res) => {
  try {
    if (fs.existsSync(AUTO_LINK_CACHE_FILE)) {
      fs.unlinkSync(AUTO_LINK_CACHE_FILE);
      console.log('🗑️ Auto-link cache cleared via endpoint');
    }
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Función para verificar si ya se ejecutó el auto-link
const hasAutoLinkExecuted = () => {
  try {
    if (fs.existsSync(AUTO_LINK_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(AUTO_LINK_CACHE_FILE, 'utf8'));
      const now = new Date();
      const cacheTime = new Date(cache.timestamp);

      // Cache válido por 24 horas
      const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
      return hoursDiff < 24;
    }
  } catch (error) {
    console.log('⚠️ Error reading auto-link cache:', error.message);
  }
  return false;
};

// Función para marcar el auto-link como ejecutado
const markAutoLinkExecuted = () => {
  try {
    // Crear directorio si no existe
    const configDir = join(__dirname, '../config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const cache = {
      timestamp: new Date().toISOString(),
      executed: true,
    };

    fs.writeFileSync(AUTO_LINK_CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('💾 Auto-link cache saved');
  } catch (error) {
    console.log('⚠️ Error saving auto-link cache:', error.message);
  }
};

// Debug: Let's see what environment variables are loaded
console.log('🔧 DEV MODE Environment variables:');
console.log('- process.env.PORT:', process.env.PORT);
console.log('- Final DEV_PORT:', DEV_PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- LICENSE_API_URL:', process.env.LICENSE_API_URL);

console.log('- .env file:', join(process.cwd(), '..', '.env'));
console.log('- Current working directory:', process.cwd());

async function startDevServer() {
  console.log(`🚀 Starting IPTRADE DEV Server on port ${DEV_PORT}...`);

  // Kill any existing processes on this port
  await killProcessOnPort(DEV_PORT);

  // Wait a moment to ensure port is fully free
  await new Promise(resolve => setTimeout(resolve, 500));

  const startServerAttempt = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(DEV_PORT, () => {
        console.log('🎉 === IPTRADE DEV SERVER STARTED ===');
        console.log(`📡 Development server running on port ${DEV_PORT}`);
        console.log(`🔗 Available at: http://localhost:${DEV_PORT}`);
        console.log(`🔗 Health check: http://localhost:${DEV_PORT}/api/status`);

        // Start periodic account activity monitoring
        console.log(
          '🔍 Starting account activity monitoring (5-second timeout, checking every 1 second)...'
        );
        setInterval(() => {
          checkAccountActivity();
        }, 1000);

        // Auto-run Link Platforms on server start (with cache)
        (async () => {
          try {
            // Verificar si ya se ejecutó el auto-link recientemente
            if (hasAutoLinkExecuted()) {
              console.log('💾 Auto-link cache found - skipping auto-start');
              return;
            }

            console.log('🧩 Auto-running Link Platforms on server start...');
            console.log(
              '📊 Link Platforms state before auto-start:',
              linkPlatformsController.isLinking
            );

            // Check if Link Platforms is already running (shouldn't happen on fresh start, but safety check)
            if (linkPlatformsController.isLinking) {
              console.log('⚠️ Link Platforms is already running - skipping auto-start');
              return;
            }

            const result = await linkPlatformsController.findAndSyncMQLFoldersManual();
            console.log('✅ Auto Link Platforms result:', result);
            console.log(
              '📊 Link Platforms state after auto-start:',
              linkPlatformsController.isLinking
            );

            // Marcar como ejecutado en el cache
            markAutoLinkExecuted();

            // CSV watching is now integrated into the main process, no need for separate call
            console.log('✅ Auto-start: Link Platforms completed with integrated CSV watching');
          } catch (err) {
            console.error('❌ Auto Link Platforms failed on start:', err);
          }
        })();

        resolve(server);
      });

      server.on('error', async err => {
        if (err.code === 'EADDRINUSE') {
          console.log(
            `⚠️  Port ${DEV_PORT} is still in use (attempt ${attempt}/3), cleaning again...`
          );

          if (attempt < 3) {
            // Try to kill processes again and retry
            await killProcessOnPort(DEV_PORT);
            setTimeout(() => {
              startServerAttempt(attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 2000);
          } else {
            console.error(`❌ Unable to start dev server on port ${DEV_PORT} after 3 attempts`);
            console.error('Please check if another application is using this port');
            reject(err);
          }
        } else {
          console.error('❌ [DEV SERVER FAILED TO START]', err);
          reject(err);
        }
      });
    });
  };

  try {
    await startServerAttempt();
  } catch (error) {
    console.error('💥 Failed to start dev server:', error.message);
    process.exit(1);
  }
}

startDevServer();
