const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/restart-service:
 *   post:
 *     summary: Restart the service
 *     description: Restarts the server service by clearing caches and reinitializing connections
 *     tags: [Service]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Service restart initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid API key
 *       500:
 *         description: Internal server error
 */
router.post('/restart-service', async (req, res) => {
  try {
    const restartResults = {
      csvWatching: false,
      linkPlatforms: false,
      sseService: false,
      cacheClearing: false,
      fileSystemCache: false,
      csvContentCleared: false,
    };

    // 1. Limpiar caché de CSV watching si existe
    try {
      const csvWatchingService = require('../services/csvWatchingService');
      if (csvWatchingService && csvWatchingService.clearCache) {
        await csvWatchingService.clearCache();
        restartResults.csvWatching = true;
      }
    } catch (error) {}

    // 2. Limpiar caché de link platforms si existe
    try {
      const linkPlatformsService = require('../services/linkPlatformsService');
      if (linkPlatformsService && linkPlatformsService.clearCache) {
        await linkPlatformsService.clearCache();
        restartResults.linkPlatforms = true;
      }
    } catch (error) {}

    // 3. Reinicializar SSE connections si existe
    try {
      const sseService = require('../services/sseService');
      if (sseService && sseService.reinitialize) {
        await sseService.reinitialize();
        restartResults.sseService = true;
      }
    } catch (error) {}

    // 4. Limpiar cachés de archivos del sistema
    try {
      const fs = require('fs');
      const path = require('path');

      // Limpiar archivos de caché específicos
      const cacheFiles = [
        'config/auto_link_cache.json',
        'server/config/csv_watching_cache.json',
        'config/mql_paths_cache.json',
      ];

      for (const cacheFile of cacheFiles) {
        try {
          const fullPath = path.join(process.cwd(), cacheFile);
          if (fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, '{}');
          }
        } catch (fileError) {}
      }

      restartResults.fileSystemCache = true;
    } catch (error) {}

    // 4.5. Borrar contenido de archivos CSV cacheados 4 veces
    try {
      const fs = require('fs');
      const path = require('path');

      // Leer las rutas de CSV desde el cache
      const csvCachePath = path.join(
        process.cwd(),
        'server',
        'server',
        'config',
        'csv_watching_cache.json'
      );

      if (fs.existsSync(csvCachePath)) {
        const cacheData = JSON.parse(fs.readFileSync(csvCachePath, 'utf8'));
        const csvFiles = cacheData.csvFiles || [];

        // Repetir 4 veces el borrado del contenido
        for (let iteration = 1; iteration <= 4; iteration++) {
          for (const csvFile of csvFiles) {
            try {
              if (fs.existsSync(csvFile)) {
                // Borrar el contenido del archivo escribiendo vacío
                fs.writeFileSync(csvFile, '');
              }
            } catch (fileError) {
              // Silencioso, continuar con el siguiente
            }
          }
        }

        restartResults.csvContentCleared = true;
      }
    } catch (error) {
      // Error silencioso
    }

    // 5. Limpiar memoria caché de Node.js
    try {
      // Limpiar require cache para módulos específicos (no core modules)
      Object.keys(require.cache).forEach(key => {
        if (key.includes('/services/') || key.includes('/controllers/')) {
          delete require.cache[key];
        }
      });
      restartResults.cacheClearing = true;
    } catch (error) {}

    res.json({
      success: true,
      message: 'Service restarted successfully',
      details: restartResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Service restart failed:', error);
    res.status(500).json({
      success: false,
      message: 'Service restart failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
