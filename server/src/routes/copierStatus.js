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
import { requireValidSubscription } from '../middleware/subscriptionAuth.js';

const router = express.Router();

/**
 * @swagger
 * /copier/global:
 *   get:
 *     summary: Get global copier status
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: Global copier status
 *   post:
 *     summary: Set global copier status
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: Global copier status set
 *   put:
 *     summary: Update global copier status
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: Global copier status updated
 */
router.get('/copier/global', requireValidSubscription, getGlobalStatus);
router.post('/copier/global', requireValidSubscription, setGlobalStatus);
router.put('/copier/global', requireValidSubscription, setGlobalStatus);

/**
 * @swagger
 * /copier/master/{masterAccountId}:
 *   get:
 *     summary: Get master copier status
 *     tags: [Copier]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master copier status
 *   delete:
 *     summary: Remove master copier status
 *     tags: [Copier]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master copier status removed
 */
router.get('/copier/master/:masterAccountId', requireValidSubscription, getMasterStatus);
router.delete('/copier/master/:masterAccountId', requireValidSubscription, removeMasterStatus);

/**
 * @swagger
 * /copier/master:
 *   post:
 *     summary: Set master copier status
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: Master copier status set
 *   put:
 *     summary: Update master copier status
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: Master copier status updated
 */
router.post('/copier/master', requireValidSubscription, setMasterStatus);
router.put('/copier/master', requireValidSubscription, setMasterStatus);

/**
 * @swagger
 * /copier/status:
 *   get:
 *     summary: Get all copier statuses
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: All copier statuses
 */
router.get('/copier/status', requireValidSubscription, getAllStatuses);

/**
 * @swagger
 * /copier/emergency-shutdown:
 *   post:
 *     summary: Emergency shutdown (turn off all copiers)
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: Emergency shutdown executed
 */
router.post('/copier/emergency-shutdown', requireValidSubscription, emergencyShutdown);

/**
 * @swagger
 * /copier/reset-all-on:
 *   post:
 *     summary: Reset all copiers to ON
 *     tags: [Copier]
 *     responses:
 *       200:
 *         description: All copiers reset to ON
 */
router.post('/copier/reset-all-on', requireValidSubscription, resetAllToOn);

export default router;
