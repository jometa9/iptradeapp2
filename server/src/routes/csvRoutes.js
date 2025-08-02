import express from 'express';

import {
  emergencyShutdown,
  getAllAccounts,
  getConnectivityStats,
  getCopierStatus,
  getSlaveConfig,
  installBot,
  resetAllToOn,
  runInstallScript,
  scanCSVFiles,
  scanPlatformAccounts,
  setGlobalStatus,
  setMasterStatus,
  updateSlaveConfig,
} from '../controllers/csvAccountsController.js';

const router = express.Router();

// Middleware para validar API key (mantener compatibilidad)
const requireValidSubscription = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API Key required' });
  }
  req.apiKey = apiKey;
  next();
};

// Server-Sent Events para file watching real
router.get('/csv/events', requireValidSubscription, (req, res) => {
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

export default router;
