import express from 'express';

import {
  getAllSlaveConfigs,
  getSlaveConfig,
  removeSlaveConfig,
  resetSlaveConfig,
  setSlaveConfig,
} from '../controllers/slaveConfigController.js';
import {
  enforceLotSizeRestrictions,
  requireValidSubscription,
} from '../middleware/subscriptionAuth.js';

const router = express.Router();

/**
 * @swagger
 * /slave-config:
 *   get:
 *     summary: Get all slave configurations
 *     tags: [SlaveConfig]
 *     responses:
 *       200:
 *         description: All slave configurations
 *   post:
 *     summary: Set or update slave configuration
 *     tags: [SlaveConfig]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slaveAccountId:
 *                 type: string
 *                 example: slave_456
 *               config:
 *                 type: object
 *                 example:
 *                   enabled: true
 *                   description: Demo slave
 *           example:
 *             slaveAccountId: slave_456
 *             config:
 *               enabled: true
 *               description: Demo slave
 *     responses:
 *       200:
 *         description: Slave configuration set/updated
 *         content:
 *           application/json:
 *             example:
 *               message: Slave config set
 */
router.get('/', getAllSlaveConfigs);
router.post('/', requireValidSubscription, enforceLotSizeRestrictions, setSlaveConfig);

/**
 * @swagger
 * /slave-config/{slaveAccountId}:
 *   get:
 *     summary: Get slave configuration by account ID
 *     tags: [SlaveConfig]
 *     parameters:
 *       - in: path
 *         name: slaveAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slave configuration
 *   post:
 *     summary: Reset slave configuration to defaults
 *     tags: [SlaveConfig]
 *     responses:
 *       200:
 *         description: Slave configuration reset
 *   delete:
 *     summary: Remove slave configuration
 *     tags: [SlaveConfig]
 *     responses:
 *       200:
 *         description: Slave configuration removed
 */
router.get('/:slaveAccountId', getSlaveConfig);
router.post('/:slaveAccountId/reset', resetSlaveConfig);
router.delete('/:slaveAccountId', removeSlaveConfig);

export default router;
