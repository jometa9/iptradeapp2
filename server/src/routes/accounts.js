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
import { checkAccountLimits, requireValidSubscription } from '../middleware/subscriptionAuth.js';

const router = express.Router();

// Register accounts
/**
 * @swagger
 * /accounts/master:
 *   post:
 *     summary: Register a new master account
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Master1
 *               platform:
 *                 type: string
 *                 example: MT5
 *           example:
 *             name: Master1
 *             platform: MT5
 *     responses:
 *       201:
 *         description: Master account created
 *         content:
 *           application/json:
 *             example:
 *               id: master_123
 *               name: Master1
 *               platform: MT5
 *               status: active
 */
router.post('/master', requireValidSubscription, checkAccountLimits, registerMasterAccount);
/**
 * @swagger
 * /accounts/slave:
 *   post:
 *     summary: Register a new slave account
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Slave1
 *               platform:
 *                 type: string
 *                 example: MT5
 *           example:
 *             name: Slave1
 *             platform: MT5
 *     responses:
 *       201:
 *         description: Slave account created
 *         content:
 *           application/json:
 *             example:
 *               id: slave_456
 *               name: Slave1
 *               platform: MT5
 *               status: active
 */
router.post('/slave', requireValidSubscription, checkAccountLimits, registerSlaveAccount);

// Connection management
/**
 * @swagger
 * /accounts/connect:
 *   post:
 *     summary: Connect a slave account to a master account
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Slave connected to master
 */
router.post('/connect', requireValidSubscription, connectSlaveToMaster);
/**
 * @swagger
 * /accounts/disconnect/{slaveAccountId}:
 *   delete:
 *     summary: Disconnect a slave account from its master
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: slaveAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slave disconnected
 */
router.delete('/disconnect/:slaveAccountId', requireValidSubscription, disconnectSlave);

// Get account information (with activity tracking)
/**
 * @swagger
 * /accounts/master/{masterAccountId}:
 *   get:
 *     summary: Get master account information
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master account info
 */
router.get('/master/:masterAccountId', requireValidSubscription, getMasterAccount);
/**
 * @swagger
 * /accounts/slave/{slaveAccountId}:
 *   get:
 *     summary: Get slave account information
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: slaveAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slave account info
 */
router.get('/slave/:slaveAccountId', requireValidSubscription, getSlaveAccount);
/**
 * @swagger
 * /accounts/all:
 *   get:
 *     summary: Retrieve a list of all accounts
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: A list of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   platform:
 *                     type: string
 */
router.get('/all', requireValidSubscription, getAllAccounts);

// Admin UI endpoint - Apply authentication for user isolation
/**
 * @swagger
 * /accounts/admin/all:
 *   get:
 *     summary: Retrieve all accounts for admin UI
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: All accounts for admin
 */
router.get('/admin/all', requireValidSubscription, getAllAccountsForAdmin);

// Update accounts
/**
 * @swagger
 * /accounts/master/{masterAccountId}:
 *   put:
 *     summary: Update a master account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master account updated
 */
router.put('/master/:masterAccountId', requireValidSubscription, updateMasterAccount);
/**
 * @swagger
 * /accounts/slave/{slaveAccountId}:
 *   put:
 *     summary: Update a slave account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: slaveAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slave account updated
 */
router.put('/slave/:slaveAccountId', requireValidSubscription, updateSlaveAccount);

// Delete accounts
/**
 * @swagger
 * /accounts/master/{masterAccountId}:
 *   delete:
 *     summary: Delete a master account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master account deleted
 */
router.delete('/master/:masterAccountId', requireValidSubscription, deleteMasterAccount);
/**
 * @swagger
 * /accounts/slave/{slaveAccountId}:
 *   delete:
 *     summary: Delete a slave account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: slaveAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slave account deleted
 */
router.delete('/slave/:slaveAccountId', requireValidSubscription, deleteSlaveAccount);

// Get supported platforms
/**
 * @swagger
 * /accounts/platforms:
 *   get:
 *     summary: Get supported trading platforms
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Supported platforms
 */
router.get('/platforms', getSupportedPlatforms);

// Activity monitoring
/**
 * @swagger
 * /accounts/activity/stats:
 *   get:
 *     summary: Get account activity statistics
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Account activity stats
 */
router.get('/activity/stats', getAccountActivityStats);
/**
 * @swagger
 * /accounts/ping:
 *   post:
 *     summary: Ping an account
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Ping successful
 */
router.post('/ping', authenticateAccount, pingAccount);

// Pending accounts management
/**
 * @swagger
 * /accounts/pending:
 *   get:
 *     summary: Get all pending accounts
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: List of pending accounts
 */
router.get('/pending', getPendingAccounts);
/**
 * @swagger
 * /accounts/pending/{accountId}/to-master:
 *   post:
 *     summary: Convert a pending account to master
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account converted to master
 */
router.post(
  '/pending/:accountId/to-master',
  requireValidSubscription,
  checkAccountLimits,
  convertPendingToMaster
);
/**
 * @swagger
 * /accounts/pending/{accountId}/to-slave:
 *   post:
 *     summary: Convert a pending account to slave
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account converted to slave
 */
router.post(
  '/pending/:accountId/to-slave',
  requireValidSubscription,
  checkAccountLimits,
  convertPendingToSlave
);
/**
 * @swagger
 * /accounts/pending/{accountId}:
 *   delete:
 *     summary: Delete a pending account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending account deleted
 */
router.delete('/pending/:accountId', deletePendingAccount);

export default router;
