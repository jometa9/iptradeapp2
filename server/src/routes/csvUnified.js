import express from 'express';

import * as csvUnifiedController from '../controllers/csvUnifiedController.js';
import csvManagerUnified from '../services/csvManagerUnified.js';

const router = express.Router();

// Rutas de cuentas
router.get('/accounts/all', csvUnifiedController.getAllAccounts);
router.get('/accounts/pending', csvUnifiedController.getPendingAccounts);
router.post('/accounts/:accountId/convert-to-master', csvUnifiedController.convertToMaster);
router.post('/accounts/:accountId/convert-to-slave', csvUnifiedController.convertToSlave);
router.put('/accounts/master/:accountId', csvUnifiedController.updateMasterConfig);
router.put('/accounts/slave/:accountId', csvUnifiedController.updateSlaveConfig);
router.delete('/accounts/:accountId', csvUnifiedController.deleteAccount);

// Rutas de copier status
router.get('/copier/status', csvUnifiedController.getCopierStatus);
router.post('/copier/global', csvUnifiedController.updateGlobalCopierStatus);
router.post('/copier/emergency-shutdown', csvUnifiedController.emergencyShutdown);
router.post('/copier/reset-all-on', csvUnifiedController.resetAllToOn);

// Rutas de configuración de slave
router.get('/slave-config/:accountId', csvUnifiedController.getSlaveConfig);
router.put('/slave-config/:accountId', csvUnifiedController.updateSlaveConfig);

// Rutas de estadísticas
router.get('/statistics', csvUnifiedController.getStatistics);

// Server-Sent Events para actualizaciones en tiempo real
router.get('/events', (req, res) => {
  console.log('🔌 SSE connection established for unified CSV');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Heartbeat cada 30 segundos
  const heartbeat = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
    );
  }, 30000);

  // Función para enviar actualizaciones
  const sendUpdate = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Escuchar eventos del CSV Manager Unificado
  const handleFileChange = () => {
    const allAccounts = csvManagerUnified.getAllActiveAccounts();
    const stats = csvManagerUnified.getStatistics();

    sendUpdate({
      type: 'accountsUpdate',
      timestamp: new Date().toISOString(),
      accounts: allAccounts,
      statistics: stats,
    });
  };

  const handleAccountsUpdate = data => {
    sendUpdate({
      type: 'accountsUpdate',
      timestamp: data.timestamp,
      accounts: data.accounts,
    });
  };

  const handleCSVUpdate = data => {
    sendUpdate({
      type: 'csvUpdate',
      ...data,
    });
  };

  // Suscribirse a eventos
  csvManagerUnified.on('fileChanged', handleFileChange);
  csvManagerUnified.on('accountsUpdate', handleAccountsUpdate);
  csvManagerUnified.on('csvUpdated', handleCSVUpdate);

  // Enviar datos iniciales
  const initialData = csvManagerUnified.getAllActiveAccounts();
  const initialStats = csvManagerUnified.getStatistics();

  sendUpdate({
    type: 'initial_data',
    timestamp: new Date().toISOString(),
    accounts: initialData,
    statistics: initialStats,
  });

  // Cleanup cuando se desconecta
  req.on('close', () => {
    console.log('🔌 SSE connection closed for unified CSV');
    clearInterval(heartbeat);
    csvManagerUnified.off('fileChanged', handleFileChange);
    csvManagerUnified.off('accountsUpdate', handleAccountsUpdate);
    csvManagerUnified.off('csvUpdated', handleCSVUpdate);
  });
});

export default router;
