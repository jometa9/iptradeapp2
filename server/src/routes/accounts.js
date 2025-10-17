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
  getConnectivityStats,
  getMasterAccount,
  // Pending accounts management
  getPendingAccounts,
  getPendingAccountsFromCache,
  getSlaveAccount,
  getSupportedPlatforms,
  getUnifiedAccountData,
  pingAccount,
  registerMasterAccount,
  registerSlaveAccount,
  updateMasterAccount,
  updateSlaveAccount,
} from '../controllers/accountsController.js';
import { getUserAccounts, saveUserAccounts } from '../controllers/configManager.js';
import linkPlatformsController from '../controllers/linkPlatformsController.js';
import { authenticateAccount } from '../middleware/roleAuth.js';
import {
  allowPendingConversions,
  checkAccountLimits,
  requireValidSubscription,
} from '../middleware/subscriptionAuth.js';

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
/*
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
// router.put('/master/:masterAccountId', requireValidSubscription, updateMasterAccount);
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
router.get('/pending', requireValidSubscription, getPendingAccounts);
router.get('/pending/cache', requireValidSubscription, getPendingAccountsFromCache);

/**
 * @swagger
 * /accounts/register-pending:
 *   post:
 *     summary: Register a new pending account (internal API)
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Account ID to register
 *     responses:
 *       200:
 *         description: Account registered as pending
 */
router.post('/register-pending', (req, res) => {
  const { accountId } = req.body;
  const apiKey = req.headers['x-api-key'];

  // Validate IPTRADE_APIKEY
  if (apiKey !== 'IPTRADE_APIKEY') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key for account registration',
    });
  }

  if (!accountId) {
    return res.status(400).json({
      error: 'Account ID is required',
      message: 'Please provide accountId in request body',
    });
  }

  try {
    // Use the same logic as authenticateAccount middleware
    const userAccounts = getUserAccounts('iptrade_89536f5b9e643c043sa31'); // Default user API key

    // Check if account already exists
    const isMaster = userAccounts.masterAccounts && userAccounts.masterAccounts[accountId];
    const isSlave = userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId];
    const isPending = userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId];

    if (isMaster || isSlave || isPending) {
      return res.status(409).json({
        error: 'Account already exists',
        message: `Account ${accountId} is already registered`,
      });
    }

    // Register as pending
    const newPendingAccount = {
      id: accountId,
      name: `Account ${accountId}`,
      description: 'Automatically detected account - awaiting configuration',
      firstSeen: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      apiKey: 'iptrade_89536f5b9e643c043sa31',
    };

    if (!userAccounts.pendingAccounts) {
      userAccounts.pendingAccounts = {};
    }
    userAccounts.pendingAccounts[accountId] = newPendingAccount;
    saveUserAccounts('iptrade_89536f5b9e643c043sa31', userAccounts);

    res.json({
      message: 'Account successfully registered as pending',
      accountId,
      status: 'pending',
    });
  } catch (error) {
    console.error('Error registering pending account:', error);
    res.status(500).json({
      error: 'Failed to register pending account',
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /accounts/register-pending-user:
 *   post:
 *   summary: Register a new pending account for authenticated user
 *   tags: [Accounts]
 *   requestBody:
 *     required: true
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             accountId:
 *               type: string
 *               description: Account ID to register
 *             platform:
 *               type: string
 *               description: Platform of the account
 *             broker:
 *               type: string
 *               description: Broker of the account
 *   responses:
 *     200:
 *       description: Account registered as pending
 */
router.post('/register-pending-user', requireValidSubscription, (req, res) => {
  const { accountId, platform, broker } = req.body;
  const apiKey = req.apiKey; // Set by requireValidSubscription middleware

  if (!accountId) {
    return res.status(400).json({
      error: 'Account ID is required',
      message: 'Please provide accountId in request body',
    });
  }

  try {
    const userAccounts = getUserAccounts(apiKey);

    // Check if account already exists
    const isMaster = userAccounts.masterAccounts && userAccounts.masterAccounts[accountId];
    const isSlave = userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId];
    const isPending = userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId];

    if (isMaster || isSlave || isPending) {
      return res.status(409).json({
        error: 'Account already exists',
        message: `Account ${accountId} is already registered`,
      });
    }

    // Register as pending
    const newPendingAccount = {
      id: accountId,
      name: `Account ${accountId}`,
      description: 'Automatically detected account - awaiting configuration',
      firstSeen: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: platform || 'Unknown',
      broker: broker || 'Unknown',
    };

    if (!userAccounts.pendingAccounts) {
      userAccounts.pendingAccounts = {};
    }
    userAccounts.pendingAccounts[accountId] = newPendingAccount;
    saveUserAccounts(apiKey, userAccounts);

    res.json({
      message: 'Account successfully registered as pending',
      accountId,
      status: 'pending',
    });
    // Auto-link deshabilitado - solo se ejecuta manualmente cuando el usuario presiona el botón
    // try {
    //   if (!linkPlatformsController.isLinking) {
    //     linkPlatformsController.findAndSyncMQLFolders();
    //   }
    // } catch {}
  } catch (error) {
    console.error('Error registering pending account:', error);
    res.status(500).json({
      error: 'Failed to register pending account',
      message: error.message,
    });
  }
});
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
  allowPendingConversions,
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
  allowPendingConversions,
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

// Get account activity statistics
/**
 * @swagger
 * /accounts/stats:
 *   get:
 *     summary: Get account activity statistics
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Account activity statistics
 */
router.get('/stats', requireValidSubscription, getAccountActivityStats);

// Unified endpoint that returns all account data in one call
/**
 * @swagger
 * /accounts/unified:
 *   get:
 *     summary: Get all account data (pending, configured, copier status, server stats) in one call
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Unified account data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     pendingAccounts:
 *                       type: array
 *                       description: Pending accounts with timestamp validation
 *                     configuredAccounts:
 *                       type: object
 *                       description: Master and slave accounts
 *                     copierStatus:
 *                       type: object
 *                       description: Global copier status and configuration
 *                     serverStats:
 *                       type: object
 *                       description: Server statistics and counts
 *                 timestamp:
 *                   type: string
 *                 processingTimeMs:
 *                   type: number
 *                 csvFilesAccessed:
 *                   type: number
 */
router.get('/unified', getUnifiedAccountData);

// Get connectivity statistics (real synchronization status)
/**
 * @swagger
 * /accounts/connectivity:
 *   get:
 *     summary: Get connectivity statistics based on real connections
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Connectivity statistics
 */
router.get('/connectivity', requireValidSubscription, getConnectivityStats);

export default router;
