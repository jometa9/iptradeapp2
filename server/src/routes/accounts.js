import express from 'express';

import {
  connectSlaveToMaster,
  convertPendingToMaster,
  convertPendingToSlave,
  deleteMasterAccount,
  deletePendingAccount,
  deleteSlaveAccount,
  disconnectSlave,
  getAccountActivityStats,
  getAllAccounts,
  getAllAccountsForAdmin,
  getMasterAccount,
  // Pending accounts management
  getPendingAccounts,
  getSlaveAccount,
  getSupportedPlatforms,
  pingAccount,
  registerMasterAccount,
  registerSlaveAccount,
  updateMasterAccount,
  updateSlaveAccount,
} from '../controllers/accountsController.js';
import { authenticateAccount } from '../middleware/roleAuth.js';

const router = express.Router();

// Register accounts
router.post('/master', registerMasterAccount);
router.post('/slave', registerSlaveAccount);

// Connection management
router.post('/connect', connectSlaveToMaster);
router.delete('/disconnect/:slaveAccountId', disconnectSlave);

// Get account information (with activity tracking)
router.get('/master/:masterAccountId', authenticateAccount, getMasterAccount);
router.get('/slave/:slaveAccountId', authenticateAccount, getSlaveAccount);
router.get('/all', authenticateAccount, getAllAccounts);

// Admin UI endpoint (no auth required for admin interface)
router.get('/admin/all', getAllAccountsForAdmin);

// Update accounts
router.put('/master/:masterAccountId', updateMasterAccount);
router.put('/slave/:slaveAccountId', updateSlaveAccount);

// Delete accounts
router.delete('/master/:masterAccountId', deleteMasterAccount);
router.delete('/slave/:slaveAccountId', deleteSlaveAccount);

// Get supported platforms
router.get('/platforms', getSupportedPlatforms);

// Activity monitoring
router.get('/activity/stats', getAccountActivityStats);
router.post('/ping', authenticateAccount, pingAccount);

// Pending accounts management
router.get('/pending', getPendingAccounts);
router.post('/pending/:accountId/to-master', convertPendingToMaster);
router.post('/pending/:accountId/to-slave', convertPendingToSlave);
router.delete('/pending/:accountId', deletePendingAccount);

export default router;
