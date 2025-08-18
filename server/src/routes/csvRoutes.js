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
  registerCSVAsPending,
  scanPendingAccounts,
  scanPlatformAccounts,
  updateCSVAccountType,
} from '../controllers/csvAccountsController.js';
import { getSlaveConfig } from '../controllers/slaveConfigController.js';

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
        const updatedData = {
          type: 'csv_updated',
          filePath,
          timestamp: new Date().toISOString(),
          ...processDataForFrontend({
            // copierStatus: csvManager.getCopierStatus(),
            accounts: csvManager.getAllActiveAccounts(),
          }),
        };

        sendUpdate(updatedData);
      };

      // Reemitir eventos de pending accounts (sin forzar escaneo adicional)
      const handlePendingUpdate = payload => {
        try {
          console.log(
            `🔥 [SSE BACKEND] handlePendingUpdate called with ${payload.accounts?.length || 0} accounts`
          );

          const accounts = payload.accounts || [];

          // Log cada cuenta para debugging
          accounts.forEach(acc => {
            console.log(
              `   📱 [SSE] Account ${acc.account_id}: status=${acc.status}, current_status=${acc.current_status || acc.status}`
            );
          });

          const summary = {
            totalAccounts: accounts.length,
            onlineAccounts: accounts.filter(a => (a.current_status || a.status) === 'online')
              .length,
            offlineAccounts: accounts.filter(a => (a.current_status || a.status) === 'offline')
              .length,
            platformStats: accounts.reduce((acc, a) => {
              const plat = a.platform || 'Unknown';
              if (!acc[plat]) acc[plat] = { online: 0, offline: 0, total: 0 };
              const status = a.current_status || a.status;
              acc[plat][status === 'online' ? 'online' : 'offline'] += 1;
              acc[plat].total += 1;
              return acc;
            }, {}),
          };

          console.log(
            `🚀 [SSE BACKEND] Sending pendingAccountsUpdate to ${activeSSEConnections} connections`
          );
          console.log(
            `   📊 Summary: ${summary.onlineAccounts} online, ${summary.offlineAccounts} offline`
          );

          sendUpdate({
            type: 'pendingAccountsUpdate',
            timestamp: payload.timestamp || new Date().toISOString(),
            accounts,
            summary,
            platforms: Object.keys(summary.platformStats),
          });

          console.log(`✅ [SSE BACKEND] pendingAccountsUpdate event sent successfully`);
        } catch (e) {
          console.error('❌ [SSE BACKEND] Error handling pending accounts update:', e);
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

      // Reemitir eventos de eliminación de cuentas
      const handleAccountDeleted = payload => {
        try {
          console.log(
            `📢 Forwarding accountDeleted event: ${payload.accountType} ${payload.accountId}`
          );
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

      // Reemitir eventos de conversión de cuentas
      const handleAccountConverted = payload => {
        try {
          console.log(
            `📢 Forwarding accountConverted event: ${payload.newType} ${payload.accountId}`
          );
          sendUpdate({
            type: 'accountConverted',
            timestamp: payload.timestamp || new Date().toISOString(),
            accountId: payload.accountId,
            newType: payload.newType, // 'master' or 'slave'
            platform: payload.platform,
            apiKey: payload.apiKey,
          });
        } catch (e) {
          console.error('Error handling accountConverted event:', e);
        }
      };

      csvManager.on('accountDeleted', handleAccountDeleted);
      csvManager.on('accountConverted', handleAccountConverted);

      // Esperar un momento para que csvManager cargue los archivos
      // O forzar un escaneo si no hay archivos cargados
      if (csvManager.csvFiles.size === 0) {
        console.log('⏳ SSE: Waiting for CSV files to be loaded...');
        // Dar más tiempo para que Link Platforms configure los archivos
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Incluso si hay archivos, esperar un poco para que se complete el parsing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Enviar datos iniciales en formato correcto para el frontend
      const accountsData = await csvManager.getAllActiveAccounts();
      console.log(
        `📊 SSE Initial data - Pending accounts: ${accountsData.pendingAccounts?.length || 0}`
      );

      const initialData = {
        type: 'initial_data',
        timestamp: new Date().toISOString(),
        ...processDataForFrontend({
          // copierStatus: csvManager.getCopierStatus(),
          accounts: accountsData,
        }),
      };

      sendUpdate(initialData);

      // Si no había pending accounts en initial_data, forzar un update después
      if (!accountsData.pendingAccounts || accountsData.pendingAccounts.length === 0) {
        setTimeout(async () => {
          const updatedData = await csvManager.getAllActiveAccounts();
          if (updatedData.pendingAccounts && updatedData.pendingAccounts.length > 0) {
            console.log('📤 SSE: Sending delayed pending accounts update');
            sendUpdate({
              type: 'pendingAccountsUpdate',
              timestamp: new Date().toISOString(),
              accounts: updatedData.pendingAccounts,
              summary: {
                totalAccounts: updatedData.pendingAccounts.length,
                onlineAccounts: updatedData.pendingAccounts.filter(a => a.status === 'online')
                  .length,
                offlineAccounts: updatedData.pendingAccounts.filter(a => a.status === 'offline')
                  .length,
              },
            });
          }
        }, 2000);
      }

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
            // Check if there's a recent completed result to show
            if (linkStatus.lastResult && linkStatus.lastTimestamp) {
              const lastResultTime = new Date(linkStatus.lastTimestamp);
              const now = new Date();
              const timeDiff = (now - lastResultTime) / 1000; // seconds

              // If the last result was within the last 30 seconds, show it
              if (timeDiff < 30) {
                console.log('📤 SSE: Sending recent completed Link Platforms result to new client');
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
                console.log('📤 SSE: Sending idle state to new client (ensuring spinner stops)');
                sendUpdate({
                  type: 'linkPlatformsEvent',
                  timestamp: new Date().toISOString(),
                  eventType: 'idle',
                  message: 'Link Platforms is idle',
                });
              }
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
        csvManager.off('accountDeleted', handleAccountDeleted);
        csvManager.off('accountConverted', handleAccountConverted);
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
        const updatedData = {
          type: 'csv_updated',
          filePath,
          timestamp: new Date().toISOString(),
          ...processDataForFrontend({
            // copierStatus: csvManager.getCopierStatus(),
            accounts: csvManager.getAllActiveAccounts(),
          }),
        };

        sendUpdate(updatedData);
      };

      // Agregar listener al CSV Manager
      csvManager.on('fileUpdated', handleCSVUpdate);

      // Esperar un momento para que csvManager cargue los archivos
      // O forzar un escaneo si no hay archivos cargados
      if (csvManager.csvFiles.size === 0) {
        console.log('⏳ SSE: Waiting for CSV files to be loaded...');
        // Dar más tiempo para que Link Platforms configure los archivos
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Incluso si hay archivos, esperar un poco para que se complete el parsing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Enviar datos iniciales en formato correcto para el frontend
      const accountsData = await csvManager.getAllActiveAccounts();
      console.log(
        `📊 SSE Initial data - Pending accounts: ${accountsData.pendingAccounts?.length || 0}`
      );

      const initialData = {
        type: 'initial_data',
        timestamp: new Date().toISOString(),
        ...processDataForFrontend({
          // copierStatus: csvManager.getCopierStatus(),
          accounts: accountsData,
        }),
      };

      sendUpdate(initialData);

      // Si no había pending accounts en initial_data, forzar un update después
      if (!accountsData.pendingAccounts || accountsData.pendingAccounts.length === 0) {
        setTimeout(async () => {
          const updatedData = await csvManager.getAllActiveAccounts();
          if (updatedData.pendingAccounts && updatedData.pendingAccounts.length > 0) {
            console.log('📤 SSE: Sending delayed pending accounts update');
            sendUpdate({
              type: 'pendingAccountsUpdate',
              timestamp: new Date().toISOString(),
              accounts: updatedData.pendingAccounts,
              summary: {
                totalAccounts: updatedData.pendingAccounts.length,
                onlineAccounts: updatedData.pendingAccounts.filter(a => a.status === 'online')
                  .length,
                offlineAccounts: updatedData.pendingAccounts.filter(a => a.status === 'offline')
                  .length,
              },
            });
          }
        }, 2000);
      }

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
// router.get('/csv/copier/status', requireValidSubscription, getCopierStatus);

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
// router.post('/csv/install-bot', requireValidSubscription, installBot);

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
// router.post('/csv/run-install-script', requireValidSubscription, runInstallScript);

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
    csvManager.refreshAllFileData();

    const allAccounts = csvManager.getAllActiveAccounts();

    res.json({
      success: true,
      message: 'CSV data refreshed from existing files',
      accounts: allAccounts,
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
      const allAccounts = csvManager.getAllActiveAccounts();
      res.json({
        success: true,
        message: `Account ${accountId} converted to pending successfully`,
        accounts: allAccounts,
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

export default router;
