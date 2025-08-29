import express from 'express';
import fs from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { loadAccountsConfig, saveAccountsConfig } from '../controllers/configManager.js';
import { getStatus } from '../controllers/statusController.js';
import {
  ongoingValidations,
  subscriptionCache,
  validateSubscription,
} from '../middleware/subscriptionAuth.js';
import CtraderAuthServiceInstance from '../services/ctraderAuth.js';
import Mt5AuthServiceInstance from '../services/mt5Auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const AUTO_LINK_CACHE_FILE = join(__dirname, '../../config/auto_link_cache.json');

const router = express.Router();

// Endpoint de prueba simple
router.get('/test', (req, res) => {
  res.json({ message: 'Status routes are working', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Get server status
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Server status
 */
router.get('/status', getStatus);

/**
 * @swagger
 * /validate-subscription:
 *   get:
 *     summary: Validate subscription for frontend
 *     tags: [Status]
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription info
 *       400:
 *         description: API Key is required
 *       401:
 *         description: Invalid API Key
 */
router.get('/validate-subscription', async (req, res) => {
  const { apiKey } = req.query;
  const forceRefresh = req.query.force === 'true'; // Optional parameter to force cache refresh

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  try {
    // Check if we should use cache or force refresh
    if (!forceRefresh) {
      const cachedValidation = subscriptionCache.get(apiKey);
      const now = Date.now();
      const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

      if (cachedValidation && now - cachedValidation.timestamp < CACHE_DURATION) {
        return res.status(200).json(cachedValidation.userData);
      }
    }

    // This is the login/initial validation - always refresh cache on direct API calls
    const validation = await validateSubscription(apiKey);

    if (validation.valid && validation.userData) {
      return res.status(200).json(validation.userData);
    } else {
      return res.status(401).json({ error: validation.error || 'Invalid license key' });
    }
  } catch (error) {
    console.error('💥 Validation error:', error);
    console.error('💥 Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /clear-subscription-cache:
 *   post:
 *     summary: Clear subscription validation cache for an API key or all keys
 *     tags: [Status]
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional API key to clear specific cache entry
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/clear-subscription-cache', async (req, res) => {
  const { apiKey } = req.query;

  try {
    if (apiKey) {
      // Clear specific API key cache
      subscriptionCache.delete(apiKey);
      res.json({ message: 'Cache cleared for specific API key' });
    } else {
      // Clear all cache
      const cacheSize = subscriptionCache.size;
      subscriptionCache.clear();
      res.json({ message: `Cleared entire cache (${cacheSize} entries)` });
    }
  } catch (error) {
    console.error('Error clearing subscription cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * @swagger
 * /subscription-cache-status:
 *   get:
 *     summary: Get subscription cache status
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Cache status information
 */
router.get('/subscription-cache-status', async (req, res) => {
  try {
    const cacheEntries = Array.from(subscriptionCache.entries()).map(([key, value]) => ({
      apiKey: key.substring(0, 8) + '...',
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
      userData: {
        userId: value.userData.userId,
        email: value.userData.email,
        subscriptionType: value.userData.subscriptionType,
      },
    }));

    res.json({
      cacheSize: subscriptionCache.size,
      entries: cacheEntries,
      ongoingValidations: ongoingValidations.size,
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({ error: 'Failed to get cache status' });
  }
});

/**
 * @swagger
 * /clear-user-data:
 *   post:
 *     summary: Clear all user data on logout
 *     tags: [Status]
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         required: true
 *         schema:
 *           type: string
 *         description: API key of the user to clear data for
 *     responses:
 *       200:
 *         description: All user data cleared successfully
 *       400:
 *         description: API Key is required
 *       500:
 *         description: Error clearing user data
 */
router.post('/clear-user-data', async (req, res) => {
  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  try {
    let clearedData = {
      subscriptionCache: false,
      userAccounts: false,
      mt5Data: false,
      ctraderData: false,
      errors: [],
    };

    // 1. Clear subscription cache
    try {
      if (subscriptionCache.has(apiKey)) {
        subscriptionCache.delete(apiKey);
        clearedData.subscriptionCache = true;
      }
    } catch (error) {
      console.error('Error clearing subscription cache:', error);
      clearedData.errors.push('subscription_cache');
    }

    // 2. Clear user accounts and configurations
    try {
      const config = loadAccountsConfig();
      if (config.userAccounts && config.userAccounts[apiKey]) {
        delete config.userAccounts[apiKey];
        saveAccountsConfig(config);
        clearedData.userAccounts = true;
      }
    } catch (error) {
      console.error('Error clearing user accounts:', error);
      clearedData.errors.push('user_accounts');
    }

    // 3. Clear MT5 data (using userId - in many cases this is the same as apiKey)
    try {
      // Try to clear data using apiKey as userId (most common case)
      const mt5Cleared = Mt5AuthServiceInstance.clearUserData(apiKey);
      if (mt5Cleared) {
        clearedData.mt5Data = true;
      }
    } catch (error) {
      console.error('Error clearing MT5 data:', error);
      clearedData.errors.push('mt5_data');
    }

    // 4. Clear cTrader data
    try {
      // Try to clear cTrader tokens using apiKey as userId
      const ctraderCleared = CtraderAuthServiceInstance.revokeUserTokens(apiKey);
      if (ctraderCleared) {
        clearedData.ctraderData = true;
      }
    } catch (error) {
      console.error('Error clearing cTrader data:', error);
      clearedData.errors.push('ctrader_data');
    }

    return res.status(200).json({
      message: 'User data cleared successfully',
      cleared: clearedData,
      hasErrors: clearedData.errors.length > 0,
    });
  } catch (error) {
    console.error('💥 Error during user data cleanup:', error);
    return res.status(500).json({
      error: 'Failed to clear user data',
      details: error.message,
    });
  }
});

/**
 * @swagger
 * /clear-auto-link-cache:
 *   post:
 *     summary: Clear auto-link cache to allow auto-link process to run again
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Auto-link cache cleared successfully
 *       500:
 *         description: Error clearing auto-link cache
 */
router.post('/clear-auto-link-cache', async (req, res) => {
  try {
    if (fs.existsSync(AUTO_LINK_CACHE_FILE)) {
      fs.unlinkSync(AUTO_LINK_CACHE_FILE);
    }

    return res.status(200).json({
      message: 'Auto-link cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error clearing auto-link cache:', error);
    return res.status(500).json({
      error: 'Failed to clear auto-link cache',
      details: error.message,
    });
  }
});

// Endpoint GET para testing
router.get('/clear-auto-link-cache', async (req, res) => {
  return res.status(200).json({
    message: 'Auto-link cache clear endpoint is working',
    timestamp: new Date().toISOString(),
  });
});

export default router;
