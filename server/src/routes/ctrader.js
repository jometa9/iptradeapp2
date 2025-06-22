import express from 'express';

import {
  authenticateAccount,
  connectToApi,
  disconnectFromApi,
  getAuthStatus,
  getConnectionStatus,
  getCtraderAccounts,
  handleOAuthCallback,
  initiateAuth,
  registerCtraderMaster,
  registerCtraderSlave,
  revokeAuth,
} from '../controllers/ctraderController.js';

const router = express.Router();

// OAuth Authentication
router.post('/auth/initiate', initiateAuth);
router.get('/auth/callback', handleOAuthCallback);
router.get('/auth/status/:userId', getAuthStatus);
router.delete('/auth/revoke/:userId', revokeAuth);

// API Connection Management
router.post('/connect', connectToApi);
router.delete('/disconnect/:userId', disconnectFromApi);
router.get('/status/:userId', getConnectionStatus);

// Account Management
router.get('/accounts/:userId', getCtraderAccounts);
router.post('/account/authenticate', authenticateAccount);

// Register accounts with your existing system
router.post('/register/master', registerCtraderMaster);
router.post('/register/slave', registerCtraderSlave);

export default router;
