import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import linkPlatformsController from './controllers/linkPlatformsController.js';
import { killProcessOnPort } from './controllers/ordersController.js';
import { createServer } from './standalone.js';

// Handle both development and production environments
let __dirname;
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = dirname(__filename);
} catch (error) {
  // Fallback for production/packaged environments
  __dirname = process.cwd();
}

// Load configuration from JSON
const configPath = join(__dirname, '../config/app_config.json');
let config;

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
  console.log('🔧 Loaded configuration from:', configPath);
} catch (error) {
  console.warn('⚠️ Failed to load config, using defaults:', error.message);
  config = {
    server: {
      port: 7777,
      environment: process.env.NODE_ENV || 'development',
    },
    paths: {
      configDir: 'config',
      autoLinkCacheFile: 'config/auto_link_cache.json',
    },
  };
}

const { app } = createServer();
const DEV_PORT = config.server.port;

// Cache para controlar el auto-link
const configDir = join(__dirname, '..', config.paths.configDir);
const AUTO_LINK_CACHE_FILE = join(__dirname, '..', config.paths.autoLinkCacheFile);

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
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const cache = {
      timestamp: new Date().toISOString(),
      executed: true,
    };

    fs.writeFileSync(AUTO_LINK_CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('✅ Auto-link marked as executed');
  } catch (error) {
    console.error('❌ Failed to mark auto-link as executed:', error);
  }
};

// Enhanced server startup for both development and production
async function startDevServer() {
  const isProduction = config.server.environment === 'production';
  console.log(
    `🚀 Starting server in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode on port ${DEV_PORT}`
  );

  await killProcessOnPort(DEV_PORT);

  // Wait a moment to ensure port is fully free
  await new Promise(resolve => setTimeout(resolve, 500));

  const startServerAttempt = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(DEV_PORT, () => {
        console.log(`✅ Server successfully started on port ${DEV_PORT}`);
        console.log(`🌐 Server available at: http://localhost:${DEV_PORT}`);
        console.log(`📚 API Documentation: http://localhost:${DEV_PORT}/api-docs`);

        (async () => {
          try {
            console.log('🔍 Checking auto-link execution status...');

            // Verificar si ya se ejecutó el auto-link (cache nunca expira)
            if (hasAutoLinkExecuted()) {
              console.log('✅ Auto-link already executed previously (cached), skipping');
              return;
            }

            if (linkPlatformsController.isLinking) {
              console.log('⏳ Auto-link is already in progress, skipping');
              return;
            }

            console.log('🚀 Starting auto-link process...');
            const result = await linkPlatformsController.findAndSyncMQLFoldersManual();
            console.log('✅ Auto-link process completed:', result);

            // Marcar como ejecutado en el cache
            markAutoLinkExecuted();

            console.log('📊 CSV watching is integrated into the main process');
          } catch (err) {
            console.error('❌ Auto Link Platforms failed on start:', err);
          }
        })();

        resolve(server);
      });

      server.on('error', async err => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`⚠️ Port ${DEV_PORT} is in use (attempt ${attempt}/3)`);
          if (attempt < 3) {
            console.log('🔄 Retrying server startup...');
            // Try to kill processes again and retry
            await killProcessOnPort(DEV_PORT);
            setTimeout(() => {
              startServerAttempt(attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 2000);
          } else {
            console.error(`❌ Unable to start server on port ${DEV_PORT} after 3 attempts`);
            console.error('💡 Please check if another application is using this port');
            console.error('💡 You can try changing the PORT in your .env file');
            reject(err);
          }
        } else {
          console.error('❌ [SERVER FAILED TO START]', err);
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
