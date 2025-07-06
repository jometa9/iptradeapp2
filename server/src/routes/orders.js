import express from 'express';

import { createNewOrder, getOrders } from '../controllers/ordersController.js';
import { authenticateAccount, roleBasedAccess } from '../middleware/roleAuth.js';
import {
  enforceLotSizeRestrictions,
  requireValidSubscription,
} from '../middleware/subscriptionAuth.js';

const router = express.Router();

// Endpoint to check account type (no role restrictions - just authentication)
/**
 * @swagger
 * /orders/account-type:
 *   get:
 *     summary: Check account type (pending, master, slave)
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Account type information
 */
router.get('/account-type', authenticateAccount, (req, res) => {
  const { accountId, type, account } = req.accountInfo;

  if (type === 'pending') {
    return res.json({
      accountId,
      type: 'pending',
      account,
      message: 'Account detected and registered as pending - awaiting configuration',
      status: 'awaiting_configuration',
      permissions: [],
      nextSteps: [
        'Account has been automatically registered as pending',
        'Administrator must configure this account as master or slave',
        'Contact administrator to complete setup',
        'EA will remain in standby mode until configured',
      ],
      adminEndpoints: {
        viewPending: 'GET /api/accounts/pending',
        convertToMaster: 'POST /api/accounts/pending/{accountId}/to-master',
        convertToSlave: 'POST /api/accounts/pending/{accountId}/to-slave',
      },
    });
  }

  res.json({
    accountId,
    type,
    account,
    message: `Account is configured as ${type}`,
    status: 'active',
    permissions:
      type === 'master' ? ['POST /neworder (send trades)'] : ['GET /neworder (receive trades)'],
    endpoints: {
      checkType: 'GET /api/orders/account-type',
      trading: type === 'master' ? 'POST /api/orders/neworder' : 'GET /api/orders/neworder',
    },
  });
});

// Admin endpoint to list all accounts and their status (no authentication required for admin purposes)
/**
 * @swagger
 * /orders/status:
 *   get:
 *     summary: List all accounts and their status (admin)
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: All accounts and their status
 */
router.get('/status', (req, res) => {
  try {
    const { existsSync, readFileSync } = require('fs');
    const { join } = require('path');

    const configBaseDir = join(process.cwd(), 'server', 'config');
    const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

    if (!existsSync(accountsFilePath)) {
      return res.json({
        masterAccounts: {},
        slaveAccounts: {},
        pendingAccounts: {},
        connections: {},
        totalMasters: 0,
        totalSlaves: 0,
        totalPending: 0,
        message: 'No accounts configured yet',
      });
    }

    const config = JSON.parse(readFileSync(accountsFilePath, 'utf-8'));
    const masterCount = Object.keys(config.masterAccounts || {}).length;
    const slaveCount = Object.keys(config.slaveAccounts || {}).length;
    const pendingCount = Object.keys(config.pendingAccounts || {}).length;

    res.json({
      ...config,
      totalMasters: masterCount,
      totalSlaves: slaveCount,
      totalPending: pendingCount,
      message: `System has ${masterCount} master(s), ${slaveCount} slave(s)${pendingCount > 0 ? ` and ${pendingCount} pending` : ''} configured`,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load account status',
      message: error.message,
    });
  }
});

// Apply authentication and role-based access control to trading routes
/**
 * @swagger
 * /orders/neworder:
 *   post:
 *     summary: Create a new order (master only)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: EURUSD
 *               volume:
 *                 type: number
 *                 example: 0.1
 *               type:
 *                 type: string
 *                 example: buy
 *               price:
 *                 type: number
 *                 example: 1.12345
 *           example:
 *             symbol: EURUSD
 *             volume: 0.1
 *             type: buy
 *             price: 1.12345
 *     responses:
 *       200:
 *         description: Order created
 *         content:
 *           application/json:
 *             example:
 *               orderId: 12345
 *               status: success
 *               message: Order placed successfully
 *   get:
 *     summary: Retrieve orders (slave only)
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Orders retrieved
 *         content:
 *           application/json:
 *             example:
 *               - orderId: 12345
 *                 symbol: EURUSD
 *                 volume: 0.1
 *                 type: buy
 *                 price: 1.12345
 *                 status: filled
 */
router.use('/neworder', authenticateAccount, roleBasedAccess);

// POST endpoint for creating new orders (only masters can access)
router.post('/neworder', requireValidSubscription, enforceLotSizeRestrictions, createNewOrder);

// GET endpoint for retrieving orders (only slaves can access)
router.get('/neworder', getOrders);

export default router;
