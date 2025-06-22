import express from 'express';

import {
  getAllSlaveConfigs,
  getSlaveConfig,
  removeSlaveConfig,
  resetSlaveConfig,
  setSlaveConfig,
} from '../controllers/slaveConfigController.js';

const router = express.Router();

// Get slave configurations
router.get('/:slaveAccountId', getSlaveConfig);
router.get('/', getAllSlaveConfigs);

// Set/update slave configuration
router.post('/', setSlaveConfig);

// Reset slave configuration to defaults
router.post('/:slaveAccountId/reset', resetSlaveConfig);

// Remove slave configuration
router.delete('/:slaveAccountId', removeSlaveConfig);

export default router;
