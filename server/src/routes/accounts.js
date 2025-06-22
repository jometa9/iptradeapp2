import express from 'express';

import {
  connectSlaveToMaster,
  deleteMasterAccount,
  deleteSlaveAccount,
  disconnectSlave,
  getAllAccounts,
  getMasterAccount,
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

export default router;
