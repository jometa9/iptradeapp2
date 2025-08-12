import express from 'express';

import {
  connectPlatforms,
  deletePendingAccount,
  emergencyShutdown,
  getAllAccounts,
  getConnectivityStats,
  getCopierStatus,
  getSlaveConfig,
  installBot,
  registerCSVAsPending,
  resetAllToOn,
  runInstallScript,
  scanCSVFiles,
  scanPendingAccounts,
  scanPlatformAccounts,
  setGlobalStatus,
  setMasterStatus,
  updateSlaveConfig,
} from '../controllers/csvAccountsController.js';

const router = express.Router();

// Contador de conexiones SSE activas y limitador por IP
let activeSSEConnections = 0;
const activeConnectionsByIP = new Map();

// Middleware para validar API key (mantener compatibilidad)
const requireValidSubscription = (req, res, next) => {
  // Buscar API key en headers o query params (para SSE)
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey) {
    return res.status(401).json({ error: 'API Key required' });
  }
  req.apiKey = apiKey;
  next();
};

// Server-Sent Events para file watching real
router.get('/csv/events', requireValidSubscription, (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  // PROTECCIÓN: Solo una conexión por IP
  if (activeConnectionsByIP.has(clientIP)) {
    console.log(`🚫 SSE: BLOCKING duplicate connection from IP: ${clientIP}`);
    res.status(429).json({ error: 'Only one SSE connection per IP allowed' });
    return;
  }

  activeSSEConnections++;
  const connectionId = activeSSEConnections;
  activeConnectionsByIP.set(clientIP, connectionId);

  console.log(`🔌 SSE connection #${connectionId} established (Total: ${activeSSEConnections})`);
  console.log(
    `📋 Connection details: User-Agent=${req.headers['user-agent']?.substring(0, 50)}...`
  );
  console.log(`🔑 API Key: ${req.query.apiKey?.substring(0, 12)}...`);
  console.log(`📍 Client IP: ${clientIP}`);

  // Trigger auto Link Platforms on first frontend connection
  if (activeSSEConnections === 1) {
    console.log('🎯 First frontend connection detected - triggering auto Link Platforms...');

    // Import and execute Link Platforms asynchronously
    import('../controllers/linkPlatformsController.js').then(
      ({ default: linkPlatformsController }) => {
        linkPlatformsController
          .findAndSyncMQLFoldersManual()
          .then(result => {
            console.log('✅ Auto Link Platforms completed after frontend connection:', {
              mql4Folders: result.mql4Folders.length,
              mql5Folders: result.mql5Folders.length,
              csvFiles: result.csvFiles.length,
              errors: result.errors.length,
            });
          })
          .catch(error => {
            console.error('❌ Auto Link Platforms failed after frontend connection:', error);
          });
      }
    );
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Enviar heartbeat cada 30 segundos
  const heartbeat = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
    );
  }, 30000);

  // Función para procesar datos en formato correcto para el frontend
  const processDataForFrontend = rawData => {
    return {
      copierStatus: {
        globalStatus: rawData.copierStatus?.globalStatus || false,
        globalStatusText: rawData.copierStatus?.globalStatusText || 'OFF',
        masterAccounts: rawData.copierStatus?.masterAccounts || {},
        totalMasterAccounts: rawData.copierStatus?.totalMasterAccounts || 0,
      },
      accounts: {
        masterAccounts: rawData.accounts?.masterAccounts || {},
        unconnectedSlaves: rawData.accounts?.unconnectedSlaves || [],
      },
    };
  };

  // Función para enviar actualizaciones
  const sendUpdate = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Escuchar cambios en CSV files
  import('../services/csvManager.js')
    .then(({ default: csvManager }) => {
      const handleCSVUpdate = (filePath, data) => {
        // Cuando un archivo CSV se actualiza, enviar datos procesados
        const updatedData = {
          type: 'csv_updated',
          filePath,
          timestamp: new Date().toISOString(),
          ...processDataForFrontend({
            copierStatus: csvManager.getCopierStatus(),
            accounts: csvManager.getAllActiveAccounts(),
          }),
        };

        sendUpdate(updatedData);
      };

      // Reemitir eventos de pending accounts (sin forzar escaneo adicional)
      const handlePendingUpdate = payload => {
        try {
          const accounts = payload.accounts || [];
          const summary = {
            totalAccounts: accounts.length,
            onlineAccounts: accounts.filter(a => a.status === 'online').length,
            offlineAccounts: accounts.filter(a => a.status === 'offline').length,
            platformStats: accounts.reduce((acc, a) => {
              const plat = a.platform || 'Unknown';
              if (!acc[plat]) acc[plat] = { online: 0, offline: 0, total: 0 };
              acc[plat][a.status === 'online' ? 'online' : 'offline'] += 1;
              acc[plat].total += 1;
              return acc;
            }, {}),
          };

          sendUpdate({
            type: 'pendingAccountsUpdate',
            timestamp: payload.timestamp || new Date().toISOString(),
            accounts,
            summary,
            platforms: Object.keys(summary.platformStats),
          });
        } catch (e) {
          console.error('Error handling pending accounts update:', e);
        }
      };

      // Reemitir eventos de Link Platforms
      const handleLinkPlatformsEvent = payload => {
        try {
          console.log(
            `📨 Forwarding Link Platforms event to SSE #${connectionId}: ${payload.type}`
          );
          console.log(`🔍 Total active SSE connections: ${activeSSEConnections}`);
          sendUpdate({
            type: 'linkPlatformsEvent',
            timestamp: payload.timestamp || new Date().toISOString(),
            eventType: payload.type, // 'started', 'completed', 'error'
            message: payload.message,
            result: payload.result,
            error: payload.error,
          });
        } catch (e) {
          console.error('Error handling Link Platforms event:', e);
        }
      };

      // Reemitir eventos de background scan (SOLO para logs, NO afecta spinner)
      const handleBackgroundScanEvent = payload => {
        try {
          console.log(`🔇 Forwarding background scan event: ${payload.type}`);
          sendUpdate({
            type: 'backgroundScanEvent',
            timestamp: payload.timestamp || new Date().toISOString(),
            eventType: payload.type, // 'completed', 'error'
            message: payload.message,
            newInstallations: payload.newInstallations,
            error: payload.error,
          });
        } catch (e) {
          console.error('Error handling background scan event:', e);
        }
      };

      // Agregar listener al CSV Manager
      csvManager.on('fileUpdated', handleCSVUpdate);
      csvManager.on('pendingAccountsUpdate', handlePendingUpdate);
      csvManager.on('linkPlatformsEvent', handleLinkPlatformsEvent);
      csvManager.on('backgroundScanEvent', handleBackgroundScanEvent);

      // Enviar datos iniciales en formato correcto para el frontend
      const initialData = {
        type: 'initial_data',
        timestamp: new Date().toISOString(),
        ...processDataForFrontend({
          copierStatus: csvManager.getCopierStatus(),
          accounts: csvManager.getAllActiveAccounts(),
        }),
      };

      sendUpdate(initialData);

      // Enviar estado actual de Link Platforms al cliente que se conecta
      import('../controllers/linkPlatformsController.js')
        .then(linkPlatformsModule => {
          const linkStatus = linkPlatformsModule.default.getLinkingStatus();
          console.log('📤 SSE: Checking Link Platforms status for new client:', linkStatus);

          if (linkStatus.isLinking) {
            console.log('📤 SSE: Sending Link Platforms started event to new client');
            sendUpdate({
              type: 'linkPlatformsEvent',
              timestamp: linkStatus.timestamp,
              eventType: 'started',
              message: 'Link Platforms process is in progress',
            });
          } else {
            // SIEMPRE enviar idle cuando el cliente se conecta y no hay linking activo
            console.log('📤 SSE: Sending idle state to new client (ensuring spinner stops)');
            sendUpdate({
              type: 'linkPlatformsEvent',
              timestamp: new Date().toISOString(),
              eventType: 'idle',
              message: 'Link Platforms is idle',
            });
          }
        })
        .catch(error => {
          console.error('Error checking Link Platforms status:', error);
        });

      // Cleanup cuando el cliente se desconecta
      req.on('close', () => {
        activeSSEConnections--;
        activeConnectionsByIP.delete(clientIP);
        console.log(
          `🔌 SSE connection #${connectionId} closed (Remaining: ${activeSSEConnections})`
        );
        console.log(`📍 Released IP: ${clientIP}`);
        clearInterval(heartbeat);
        csvManager.off('fileUpdated', handleCSVUpdate);
        csvManager.off('pendingAccountsUpdate', handlePendingUpdate);
        csvManager.off('linkPlatformsEvent', handleLinkPlatformsEvent);
        csvManager.off('backgroundScanEvent', handleBackgroundScanEvent);
      });
    })
    .catch(error => {
      console.error('Error importing csvManager:', error);
    });
});

// Server-Sent Events para frontend (sin autenticación)
router.get('/csv/events/frontend', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Enviar heartbeat cada 30 segundos
  const heartbeat = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
    );
  }, 30000);

  // Función para procesar datos en formato correcto para el frontend
  const processDataForFrontend = rawData => {
    return {
      copierStatus: {
        globalStatus: rawData.copierStatus?.globalStatus || false,
        globalStatusText: rawData.copierStatus?.globalStatusText || 'OFF',
        masterAccounts: rawData.copierStatus?.masterAccounts || {},
        totalMasterAccounts: rawData.copierStatus?.totalMasterAccounts || 0,
      },
      accounts: {
        masterAccounts: rawData.accounts?.masterAccounts || {},
        unconnectedSlaves: rawData.accounts?.unconnectedSlaves || [],
      },
    };
  };

  // Función para enviar actualizaciones
  const sendUpdate = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Escuchar cambios en CSV files
  import('../services/csvManager.js')
    .then(({ default: csvManager }) => {
      const handleCSVUpdate = (filePath, data) => {
        // Cuando un archivo CSV se actualiza, enviar datos procesados
        const updatedData = {
          type: 'csv_updated',
          filePath,
          timestamp: new Date().toISOString(),
          ...processDataForFrontend({
            copierStatus: csvManager.getCopierStatus(),
            accounts: csvManager.getAllActiveAccounts(),
          }),
        };

        sendUpdate(updatedData);
      };

      // Agregar listener al CSV Manager
      csvManager.on('fileUpdated', handleCSVUpdate);

      // Enviar datos iniciales en formato correcto para el frontend
      const initialData = {
        type: 'initial_data',
        timestamp: new Date().toISOString(),
        ...processDataForFrontend({
          copierStatus: csvManager.getCopierStatus(),
          accounts: csvManager.getAllActiveAccounts(),
        }),
      };

      sendUpdate(initialData);

      // Cleanup cuando el cliente se desconecta
      req.on('close', () => {
        clearInterval(heartbeat);
        csvManager.off('fileUpdated', handleCSVUpdate);
      });
    })
    .catch(error => {
      console.error('Error importing csvManager:', error);
    });
});

/**
 * @swagger
 * /csv/accounts/all:
 *   get:
 *     summary: Get all accounts from CSV
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: All accounts from CSV
 */
router.get('/csv/accounts/all', requireValidSubscription, getAllAccounts);

/**
 * @swagger
 * /csv/copier/status:
 *   get:
 *     summary: Get copier status from CSV
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Copier status from CSV
 */
router.get('/csv/copier/status', requireValidSubscription, getCopierStatus);

/**
 * @swagger
 * /csv/copier/global:
 *   post:
 *     summary: Set global copier status
 *     tags: [CSV]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Global status updated
 */
router.post('/csv/copier/global', requireValidSubscription, setGlobalStatus);

/**
 * @swagger
 * /csv/copier/master:
 *   post:
 *     summary: Set master copier status
 *     tags: [CSV]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               masterAccountId:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Master status updated
 */
router.post('/csv/copier/master', requireValidSubscription, setMasterStatus);

/**
 * @swagger
 * /csv/slave-config/{slaveAccountId}:
 *   get:
 *     summary: Get slave configuration
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: slaveAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slave configuration
 */
router.get('/csv/slave-config/:slaveAccountId', requireValidSubscription, getSlaveConfig);

/**
 * @swagger
 * /csv/slave-config:
 *   post:
 *     summary: Update slave configuration
 *     tags: [CSV]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slaveAccountId:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Slave configuration updated
 */
router.post('/csv/slave-config', requireValidSubscription, updateSlaveConfig);

/**
 * @swagger
 * /csv/copier/emergency-shutdown:
 *   post:
 *     summary: Emergency shutdown
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Emergency shutdown executed
 */
router.post('/csv/copier/emergency-shutdown', requireValidSubscription, emergencyShutdown);

/**
 * @swagger
 * /csv/copier/reset-all-on:
 *   post:
 *     summary: Reset all copiers to ON
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: All copiers reset to ON
 */
router.post('/csv/copier/reset-all-on', requireValidSubscription, resetAllToOn);

/**
 * @swagger
 * /csv/connectivity/stats:
 *   get:
 *     summary: Get connectivity statistics
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Connectivity statistics
 */
router.get('/csv/connectivity/stats', requireValidSubscription, getConnectivityStats);

/**
 * @swagger
 * /csv/scan:
 *   post:
 *     summary: Scan for CSV files
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: CSV files scanned
 */
router.post('/csv/scan', requireValidSubscription, scanCSVFiles);

/**
 * @swagger
 * /csv/install-bot:
 *   post:
 *     summary: Install bot on platform
 *     tags: [CSV]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bot installed
 */
router.post('/csv/install-bot', requireValidSubscription, installBot);

/**
 * @swagger
 * /csv/run-install-script:
 *   post:
 *     summary: Run install script for platform
 *     tags: [CSV]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *     responses:
 *       200:
 *         description: Install script executed
 */
router.post('/csv/run-install-script', requireValidSubscription, runInstallScript);

/**
 * @swagger
 * /csv/scan-platform-accounts:
 *   post:
 *     summary: Scan platform accounts
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Platform accounts scanned
 */
router.post('/csv/scan-platform-accounts', requireValidSubscription, scanPlatformAccounts);

/**
 * @swagger
 * /csv/scan-pending:
 *   get:
 *     summary: Scan simplified pending accounts from CSV files
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Pending accounts scan completed
 */
router.get('/csv/scan-pending', requireValidSubscription, scanPendingAccounts);

/**
 * @swagger
 * /csv/pending/{accountId}:
 *   delete:
 *     summary: Delete a pending account from CSV files
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending account deleted successfully
 */
router.delete('/csv/pending/:accountId', requireValidSubscription, deletePendingAccount);

/**
 * @swagger
 * /csv/connect-platforms:
 *   post:
 *     summary: Scan and connect all trading platforms
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Platform connection scan completed
 */
router.post('/csv/connect-platforms', requireValidSubscription, connectPlatforms);

/**
 * @swagger
 * /csv/register-as-pending:
 *   post:
 *     summary: Register CSV accounts as pending accounts
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: CSV accounts registered as pending
 */
router.post('/csv/register-as-pending', requireValidSubscription, registerCSVAsPending);

export default router;
