import express from 'express';

import {
  closePosition,
  disconnectFromMT5,
  exportUserData,
  getAccountInfo,
  getConnectionStatus,
  getOrders,
  getPositions,
  getStoredAccounts,
  getSymbolInfo,
  initializeMT5,
  loginToMT5Account,
  loginWithStoredCredentials,
  placeOrder,
  registerMT5Master,
  registerMT5Slave,
  removeStoredAccount,
  updateUserPreferences,
} from '../controllers/mt5Controller.js';

const router = express.Router();

// MT5 Connection Management
router.post('/initialize', initializeMT5);
router.delete('/disconnect/:userId', disconnectFromMT5);
router.get('/status/:userId', getConnectionStatus);

// Account Management
router.post('/login', loginToMT5Account);
router.post('/login/stored', loginWithStoredCredentials);
router.get('/account/:userId', getAccountInfo);

// Stored Accounts
router.get('/accounts/:userId', getStoredAccounts);
router.delete('/accounts/remove', removeStoredAccount);

// Trading Operations
router.get('/positions/:userId', getPositions);
router.get('/orders/:userId', getOrders);
router.post('/order/place', placeOrder);
router.post('/position/close', closePosition);

// Market Data
router.get('/symbol/:userId/:symbol', getSymbolInfo);

// Copy Trading Registration
router.post('/register/master', registerMT5Master);
router.post('/register/slave', registerMT5Slave);

// User Preferences
router.put('/preferences/:userId', updateUserPreferences);

// Data Export
router.get('/export/:userId', exportUserData);

export default router;
