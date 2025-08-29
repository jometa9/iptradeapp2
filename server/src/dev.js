import dotenv from 'dotenv';
import fs, { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import linkPlatformsController from './controllers/linkPlatformsController.js';
import { killProcessOnPort } from './controllers/ordersController.js';
import { createServer } from './standalone.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Load environment variables from root .env only
// Try to load from current directory first, then from parent directory
const rootEnvPath = join(process.cwd(), '.env');
const parentEnvPath = join(process.cwd(), '..', '.env');

// Check which path exists and load it
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
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
    }
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Función para verificar si ya se ejecutó el auto-link
const hasAutoLinkExecuted = () => {
  try {
    if (fs.existsSync(AUTO_LINK_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(AUTO_LINK_CACHE_FILE, 'utf8'));

      // Cache NUNCA expira - una vez ejecutado, no se vuelve a ejecutar automáticamente
      return cache.executed === true;
    }
  } catch (error) {}
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
  } catch (error) {}
};

// Debug: Let's see what environment variables are loaded
async function startDevServer() {
  await killProcessOnPort(DEV_PORT);

  // Wait a moment to ensure port is fully free
  await new Promise(resolve => setTimeout(resolve, 500));

  const startServerAttempt = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(DEV_PORT, () => {
        (async () => {
          try {
            // Verificar si ya se ejecutó el auto-link (cache nunca expira)
            if (hasAutoLinkExecuted()) {
              return;
            }

            if (linkPlatformsController.isLinking) {
              return;
            }

            const result = await linkPlatformsController.findAndSyncMQLFoldersManual();

            // Marcar como ejecutado en el cache
            markAutoLinkExecuted();

            // CSV watching is now integrated into the main process, no need for separate call
          } catch (err) {
            console.error('❌ Auto Link Platforms failed on start:', err);
          }
        })();

        resolve(server);
      });

      server.on('error', async err => {
        if (err.code === 'EADDRINUSE') {
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
