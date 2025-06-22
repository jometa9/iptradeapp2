import express from 'express';

import {
  getAllConfigurations,
  getMasterForSlave,
  removeSlaveMasterMapping,
  setMasterForSlave,
} from '../controllers/configController.js';

const router = express.Router();

// GET all configurations
router.get('/config', getAllConfigurations);

// GET master for specific slave
router.get('/config/:slaveId', getMasterForSlave);

// POST/PUT to set master for slave
router.post('/config', setMasterForSlave);
router.put('/config', setMasterForSlave);

// DELETE slave-master mapping
router.delete('/config/:slaveId', removeSlaveMasterMapping);

export default router;
