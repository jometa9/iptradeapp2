import express from 'express';

import { createNewOrder, getOrders } from '../controllers/ordersController.js';
import { authenticateAccount, roleBasedAccess } from '../middleware/roleAuth.js';

const router = express.Router();

// Endpoint to check account type (no role restrictions - just authentication)
router.get('/account-type', authenticateAccount, (req, res) => {
  res.json({
    accountId: req.accountInfo.accountId,
    type: req.accountInfo.type,
    account: req.accountInfo.account,
    message: `Account is configured as ${req.accountInfo.type}`,
    permissions:
      req.accountInfo.type === 'master'
        ? ['POST /neworder (send trades)']
        : ['GET /neworder (receive trades)'],
    endpoints: {
      checkType: 'GET /api/orders/account-type',
      trading:
        req.accountInfo.type === 'master'
          ? 'POST /api/orders/neworder'
          : 'GET /api/orders/neworder',
    },
  });
});

// Admin endpoint to list all accounts and their status (no authentication required for admin purposes)
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
        connections: {},
        totalMasters: 0,
        totalSlaves: 0,
        message: 'No accounts configured yet',
      });
    }

    const config = JSON.parse(readFileSync(accountsFilePath, 'utf-8'));
    const masterCount = Object.keys(config.masterAccounts || {}).length;
    const slaveCount = Object.keys(config.slaveAccounts || {}).length;

    res.json({
      ...config,
      totalMasters: masterCount,
      totalSlaves: slaveCount,
      message: `System has ${masterCount} master(s) and ${slaveCount} slave(s) configured`,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load account status',
      message: error.message,
    });
  }
});

// Apply authentication and role-based access control to trading routes
router.use('/neworder', authenticateAccount, roleBasedAccess);

// POST endpoint for creating new orders (only masters can access)
router.post('/neworder', createNewOrder);

// GET endpoint for retrieving orders (only slaves can access)
router.get('/neworder', getOrders);

export default router;
