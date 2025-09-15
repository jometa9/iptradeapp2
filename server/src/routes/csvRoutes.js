import express from 'express';

import { getAllAccounts, getConnectivityStats } from '../controllers/accountsController.js';
import {
  emergencyShutdown,
  resetAllToOn,
  setGlobalStatus,
  setMasterStatus,
} from '../controllers/copierStatusController.js';
import {
  connectPlatforms,
  deletePendingFromCSV,
  installBot,
  registerCSVAsPending,
  runInstallScript,
  scanPendingAccounts,
  scanPlatformAccounts,
  updateCSVAccountType,
} from '../controllers/csvAccountsController.js';
import { getSlaveConfig } from '../controllers/slaveConfigController.js';
import { requireValidSubscription } from '../middleware/subscriptionAuth.js';

const router = express.Router();

// Contador de conexiones SSE activas y limitador por IP
let activeSSEConnections = 0;
const activeConnectionsByIP = new Map();

// Server-Sent Events para file watching real
router.get('/csv/events', requireValidSubscription, (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  // PROTECCIÓN: Solo una conexión por IP - pero permitir reconexión
  if (activeConnectionsByIP.has(clientIP)) {
    const existingConnectionId = activeConnectionsByIP.get(clientIP);
    console.log(`🔄 [SSE] Client ${clientIP} attempting reconnection (existing: ${existingConnectionId})`);
    
    // Permitir reconexión después de un breve delay
    res.status(429).json({ 
      error: 'Connection already exists for this IP', 
      retryAfter: 2,
      message: 'Please wait 2 seconds before reconnecting' 
    });
    return;
  }

  activeSSEConnections++;
  const connectionId = activeSSEConnections;
  activeConnectionsByIP.set(clientIP, connectionId);
  
  console.log(`✅ [SSE] New connection established: ${clientIP} (ID: ${connectionId}, Total: ${activeSSEConnections})`);
  
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
        pendingAccounts: rawData.accounts?.pendingAccounts || [],
      },
    };
  };

  // Función para enviar actualizaciones
  const sendUpdate = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Escuchar cambios en CSV files
  import('../services/csvManager.js')
    .then(async ({ default: csvManager }) => {
      const handleCSVUpdate = (filePath, data) => {
        // Cuando un archivo CSV se actualiza, enviar datos procesados
        // CSV updates disabled - pending accounts fetched on-demand only
      };

      // Pending accounts updates removed - use direct endpoint calls instead

      // NUEVO: Manejar eventos de conversión de cuentas
      const handleAccountConverted = payload => {
        try {
          // Pending accounts updates removed - frontend should use direct endpoint calls

          // Enviar evento de conversión
          sendUpdate({
            type: 'accountConverted',
            timestamp: payload.timestamp || new Date().toISOString(),
            accountId: payload.accountId,
            newType: payload.newType,
          });
        } catch (e) {
          console.error('❌ [SSE BACKEND] Error handling account conversion:', e);
        }
      };

      // Reemitir eventos de Link Platforms
      const handleLinkPlatformsEvent = payload => {
        try {
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
      csvManager.on('linkPlatformsEvent', handleLinkPlatformsEvent);
      csvManager.on('backgroundScanEvent', handleBackgroundScanEvent);
      csvManager.on('accountConverted', handleAccountConverted);

      // Reemitir eventos de eliminación de cuentas
      const handleAccountDeleted = payload => {
        try {
          sendUpdate({
            type: 'accountDeleted',
            timestamp: payload.timestamp || new Date().toISOString(),
            accountId: payload.accountId,
            accountType: payload.accountType, // 'master' or 'slave'
            apiKey: payload.apiKey,
          });
        } catch (e) {
          console.error('Error handling accountDeleted event:', e);
        }
      };

      // Eliminar esta declaración duplicada de handleAccountConverted

      csvManager.on('accountDeleted', handleAccountDeleted);

      // Esperar un momento para que csvManager cargue los archivos
      // O forzar un escaneo si no hay archivos cargados
      if (csvManager.csvFiles.size === 0) {
        // Dar más tiempo para que Link Platforms configure los archivos
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Incluso si hay archivos, esperar un poco para que se complete el parsing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // SSE initial data disabled - pending accounts fetched on-demand only

      // Pending accounts updates removed - frontend should use direct endpoint calls

      // Enviar estado actual de Link Platforms al cliente que se conecta
      import('../controllers/linkPlatformsController.js')
        .then(linkPlatformsModule => {
          const linkStatus = linkPlatformsModule.default.getLinkingStatus();

          if (linkStatus.isLinking) {
            sendUpdate({
              type: 'linkPlatformsEvent',
              timestamp: linkStatus.timestamp,
              eventType: 'started',
              message: 'Link Platforms process is in progress',
            });
          } else {
            // Check if there's a recent completed result to show
            if (linkStatus.lastResult && linkStatus.lastTimestamp) {
              const lastResultTime = new Date(linkStatus.lastTimestamp);
              const now = new Date();
              const timeDiff = (now - lastResultTime) / 1000; // seconds

              // If the last result was within the last 30 seconds, show it
              if (timeDiff < 30) {
                // Send the start event first
                sendUpdate({
                  type: 'linkPlatformsEvent',
                  timestamp: linkStatus.lastTimestamp,
                  eventType: 'started',
                  message: 'Link Platforms process started',
                });

                // Then send the completed event after a brief moment
                setTimeout(() => {
                  sendUpdate({
                    type: 'linkPlatformsEvent',
                    timestamp: linkStatus.lastTimestamp,
                    eventType: 'completed',
                    message: linkStatus.lastResult.message || 'Link Platforms process completed',
                    result: linkStatus.lastResult.result,
                  });
                }, 100);
              } else {
                // SIEMPRE enviar idle cuando el cliente se conecta y no hay linking activo
                sendUpdate({
                  type: 'linkPlatformsEvent',
                  timestamp: new Date().toISOString(),
                  eventType: 'idle',
                  message: 'Link Platforms is idle',
                });
              }
            } else {
              // SIEMPRE enviar idle cuando el cliente se conecta y no hay linking activo
              sendUpdate({
                type: 'linkPlatformsEvent',
                timestamp: new Date().toISOString(),
                eventType: 'idle',
                message: 'Link Platforms is idle',
              });
            }
          }
        })
        .catch(error => {
          console.error('Error checking Link Platforms status:', error);
        });

      // Cleanup cuando el cliente se desconecta
      req.on('close', () => {
        activeSSEConnections--;
        activeConnectionsByIP.delete(clientIP);
        clearInterval(heartbeat);
        csvManager.off('fileUpdated', handleCSVUpdate);
        csvManager.off('linkPlatformsEvent', handleLinkPlatformsEvent);
        csvManager.off('backgroundScanEvent', handleBackgroundScanEvent);
        csvManager.off('accountConverted', handleAccountConverted);
        csvManager.off('accountDeleted', handleAccountDeleted);
        
        console.log(`❌ [SSE] Connection closed: ${clientIP} (ID: ${connectionId}, Remaining: ${activeSSEConnections})`);
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
        pendingAccounts: rawData.accounts?.pendingAccounts || [],
      },
    };
  };

  // Función para enviar actualizaciones
  const sendUpdate = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Escuchar cambios en CSV files
  import('../services/csvManager.js')
    .then(async ({ default: csvManager }) => {
      const handleCSVUpdate = (filePath, data) => {
        // Cuando un archivo CSV se actualiza, enviar datos procesados
        // CSV updates disabled - pending accounts fetched on-demand only
      };

      // Agregar listener al CSV Manager
      csvManager.on('fileUpdated', handleCSVUpdate);

      // Esperar un momento para que csvManager cargue los archivos
      // O forzar un escaneo si no hay archivos cargados
      if (csvManager.csvFiles.size === 0) {
        // Dar más tiempo para que Link Platforms configure los archivos
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Incluso si hay archivos, esperar un poco para que se complete el parsing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // SSE initial data disabled - pending accounts fetched on-demand only

      // Pending accounts updates removed - frontend should use direct endpoint calls

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
 *     summary: DEPRECATED - Use /api/accounts/unified instead
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Copier status from CSV (DEPRECATED)
 */
// DEPRECATED: Get copier status from CSV - Use /api/accounts/unified instead
const getCopierStatus = async (req, res) => {
  try {
    const csvManager = (await import('../services/csvManager.js')).default;
    const copierStatus = await csvManager.getCopierStatus();

    res.json({
      success: true,
      data: copierStatus,
      timestamp: new Date().toISOString(),
      deprecated: true,
      message: 'Use /api/accounts/unified instead for better performance',
    });
  } catch (error) {
    console.error('Error getting copier status from CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get copier status from CSV',
    });
  }
};

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
// router.post('/csv/slave-config', requireValidSubscription, updateSlaveConfig);

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
// router.post('/csv/scan', requireValidSubscription, scanCSVFiles);

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

// Refresh CSV data from existing files (no new search)
router.post('/csv/refresh', requireValidSubscription, async (req, res) => {
  try {
    const csvManager = (await import('../services/csvManager.js')).default;

    // Solo refrescar datos existentes, no hacer búsqueda completa
    await csvManager.refreshAllFileData();

    // getAllActiveAccounts call removed - pending accounts fetched on-demand only

    res.json({
      success: true,
      message: 'CSV data refreshed from existing files',
      note: 'Pending accounts data removed - use /api/accounts/pending endpoint',
    });
  } catch (error) {
    console.error('Error refreshing CSV data:', error);
    res.status(500).json({ error: 'Failed to refresh CSV data' });
  }
});

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
router.delete('/csv/pending/:accountId', requireValidSubscription, deletePendingFromCSV);

/**
 * @swagger
 * /csv/pending/{accountId}/update-type:
 *   put:
 *     summary: Update CSV account type from pending to master/slave
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newType:
 *                 type: string
 *                 enum: [master, slave]
 *                 description: The new account type
 *     responses:
 *       200:
 *         description: Account type updated successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Account not found
 */
router.put('/csv/pending/:accountId/update-type', requireValidSubscription, updateCSVAccountType);

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

/**
 * @swagger
 * /csv/convert-to-pending/{accountId}:
 *   post:
 *     summary: Convert a configured account back to pending status
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account converted to pending successfully
 *       404:
 *         description: Account not found
 *       500:
 *         description: Error converting account
 */
router.post('/csv/convert-to-pending/:accountId', requireValidSubscription, async (req, res) => {
  try {
    const { accountId } = req.params;
    const csvManager = (await import('../services/csvManager.js')).default;

    const success = csvManager.convertToPending(accountId);
    if (success) {
      // Emitir evento SSE inmediatamente
      csvManager.emit('accountConverted', {
        accountId,
        newType: 'pending',
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: `Account ${accountId} converted to pending successfully`,
        note: 'Use /api/accounts/pending to get updated pending accounts',
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Account ${accountId} not found or could not be converted`,
      });
    }
  } catch (error) {
    console.error(`Error converting account ${req.params.accountId} to pending:`, error);
    res.status(500).json({
      success: false,
      message: 'Error converting account to pending',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /csv/account/{accountId}/status:
 *   post:
 *     summary: Update individual account copy trading status
 *     tags: [CSV]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Whether to enable or disable copy trading for this account
 *     responses:
 *       200:
 *         description: Account status updated successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Account not found
 *       500:
 *         description: Error updating account status
 */
router.post('/csv/account/:accountId/status', requireValidSubscription, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled parameter is required',
      });
    }

    const csvManager = (await import('../services/csvManager.js')).default;
    
    // Si se está desactivando una cuenta master, primero desactivar todas las slaves conectadas
    if (!enabled) {
      try {
        // Obtener las slaves conectadas a este master
        const connectedSlaves = csvManager.getConnectedSlaves(accountId);
        
        // Desactivar cada slave conectada antes de desactivar el master
        for (const slave of connectedSlaves) {
          try {
            await csvManager.updateAccountStatus(slave.id, false);
          } catch (slaveError) {
            console.error(`❌ Error desactivando slave ${slave.id}:`, slaveError);
            // Continuar con las demás slaves aunque una falle
          }
        }
     
      } catch (error) {
        // Continuar con la desactivación del master aunque haya errores con las slaves
      }
    }
    
    // Actualizar el estado de la cuenta (master o slave)
    const success = await csvManager.updateAccountStatus(accountId, enabled);

    if (success) {
      res.json({
        success: true,
        message: `Account ${accountId} ${enabled ? 'enabled' : 'disabled'}`,
        accountId,
        enabled,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Account not found or could not be updated',
      });
    }
  } catch (error) {
    console.error(`Error updating account ${req.params.accountId} status:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update account status',
    });
  }
});

/**
 * @swagger
 * /csv/debug/pending:
 *   get:
 *     summary: Debug endpoint to check pending accounts status
 *     tags: [CSV]
 *     responses:
 *       200:
 *         description: Debug information about pending accounts
 */
router.get('/csv/debug/pending', requireValidSubscription, async (req, res) => {
  try {
    const csvManager = (await import('../services/csvManager.js')).default;

    const pendingAccounts = [];

    // Información de archivos CSV
    const csvFilesInfo = Array.from(csvManager.csvFiles.entries()).map(([filePath, fileData]) => ({
      filePath,
      lastModified: fileData.lastModified,
      rowCount: fileData.data.length,
      data: fileData.data,
    }));

    const debugInfo = {
      timestamp: new Date().toISOString(),
      csvFilesCount: csvManager.csvFiles.size,
      csvFiles: csvFilesInfo,
      pendingAccountsCount: 0,
      pendingAccounts: [],
      note: 'Debug disabled - use /api/accounts/pending for current data',
    };

    res.json({
      success: true,
      debug: debugInfo,
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
