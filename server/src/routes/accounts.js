import express from 'express';

import {
  connectSlaveToMaster,
  convertPendingToMaster,
  convertPendingToSlave,
  deleteMasterAccount,
  deletePendingAccount,
  deleteSlaveAccount,
  disconnectSlave,
  getAllAccounts,
  getMasterAccount,
  // Pending accounts management
  getPendingAccounts,
  getSlaveAccount,
  getSupportedPlatforms,
  registerMasterAccount,
  registerSlaveAccount,
  updateMasterAccount,
  updateSlaveAccount,
} from '../controllers/accountsController.js';

const router = express.Router();

// Register accounts
router.post('/master', registerMasterAccount);
router.post('/slave', registerSlaveAccount);

// Connection management
router.post('/connect', connectSlaveToMaster);
router.delete('/disconnect/:slaveAccountId', disconnectSlave);

// Get account information
router.get('/master/:masterAccountId', getMasterAccount);
router.get('/slave/:slaveAccountId', getSlaveAccount);
router.get('/all', getAllAccounts);

// Update accounts
router.put('/master/:masterAccountId', updateMasterAccount);
router.put('/slave/:slaveAccountId', updateSlaveAccount);

// Delete accounts
router.delete('/master/:masterAccountId', deleteMasterAccount);
router.delete('/slave/:slaveAccountId', deleteSlaveAccount);

// Get supported platforms
router.get('/platforms', getSupportedPlatforms);

// Pending accounts management
router.get('/pending', getPendingAccounts);
router.post('/pending/:accountId/to-master', convertPendingToMaster);
router.post('/pending/:accountId/to-slave', convertPendingToSlave);
router.delete('/pending/:accountId', deletePendingAccount);

export default router;
