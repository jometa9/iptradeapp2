import express from 'express';

import {
  emergencyShutdown,
  getAllStatuses,
  getGlobalStatus,
  getMasterStatus,
  removeMasterStatus,
  resetAllToOn,
  setGlobalStatus,
  setMasterStatus,
} from '../controllers/copierStatusController.js';

const router = express.Router();

// Global copier status
router.get('/copier/global', getGlobalStatus);
router.post('/copier/global', setGlobalStatus);
router.put('/copier/global', setGlobalStatus);

// Master account specific copier status
router.get('/copier/master/:masterAccountId', getMasterStatus);
router.post('/copier/master', setMasterStatus);
router.put('/copier/master', setMasterStatus);
router.delete('/copier/master/:masterAccountId', removeMasterStatus);

// Get all statuses
router.get('/copier/status', getAllStatuses);

// Emergency controls
router.post('/copier/emergency-shutdown', emergencyShutdown);
router.post('/copier/reset-all-on', resetAllToOn);

export default router;
