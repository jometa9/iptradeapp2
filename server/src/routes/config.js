import express from 'express';

import {
  getAllConfigurations,
  getMasterForSlave,
  removeSlaveMasterMapping,
  setMasterForSlave,
} from '../controllers/configController.js';

const router = express.Router();

/**
 * @swagger
 * /config:
 *   get:
 *     summary: Get all configurations
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: All configurations
 *   post:
 *     summary: Set master for slave
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slaveId:
 *                 type: string
 *                 example: slave_456
 *               masterId:
 *                 type: string
 *                 example: master_123
 *           example:
 *             slaveId: slave_456
 *             masterId: master_123
 *     responses:
 *       200:
 *         description: Master set for slave
 *         content:
 *           application/json:
 *             example:
 *               message: Mapping set
 *   put:
 *     summary: Update master for slave
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slaveId:
 *                 type: string
 *                 example: slave_456
 *               masterId:
 *                 type: string
 *                 example: master_123
 *           example:
 *             slaveId: slave_456
 *             masterId: master_123
 *     responses:
 *       200:
 *         description: Master updated for slave
 *         content:
 *           application/json:
 *             example:
 *               message: Mapping updated
 */
router.get('/config', getAllConfigurations);
router.post('/config', setMasterForSlave);
router.put('/config', setMasterForSlave);

/**
 * @swagger
 * /config/{slaveId}:
 *   get:
 *     summary: Get master for specific slave
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: slaveId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master for slave
 *   delete:
 *     summary: Remove slave-master mapping
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: slaveId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mapping removed
 */
router.get('/config/:slaveId', getMasterForSlave);
router.delete('/config/:slaveId', removeSlaveMasterMapping);

export default router;
