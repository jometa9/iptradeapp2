import express from 'express';

import { loadAccountsConfig, saveAccountsConfig } from '../controllers/configManager.js';
import { getStatus } from '../controllers/statusController.js';
import { subscriptionCache, validateSubscription } from '../middleware/subscriptionAuth.js';
import CtraderAuthServiceInstance from '../services/ctraderAuth.js';
import Mt5AuthServiceInstance from '../services/mt5Auth.js';

const router = express.Router();

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
  console.log('🔍 === VALIDATE-SUBSCRIPTION ROUTE START ===');

  const { apiKey } = req.query;
  const forceRefresh = req.query.force === 'true'; // Optional parameter to force cache refresh

  console.log(
    '🔐 Frontend validating API Key:',
    apiKey ? apiKey.substring(0, 8) + '...' : 'undefined'
  );

  if (!apiKey) {
    console.log('❌ No API key provided');
    console.log('🔍 === VALIDATE-SUBSCRIPTION ROUTE END (NO API KEY) ===');
    return res.status(400).json({ error: 'API Key is required' });
  }

  try {
    // Check if we should use cache or force refresh
    if (!forceRefresh) {
      const cachedValidation = subscriptionCache.get(apiKey);
      const now = Date.now();
      const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

      if (cachedValidation && now - cachedValidation.timestamp < CACHE_DURATION) {
        console.log('📋 Using cached validation for frontend request');
        console.log('🔍 === VALIDATE-SUBSCRIPTION ROUTE END (CACHED) ===');
        return res.status(200).json(cachedValidation.userData);
      }
    }

    // This is the login/initial validation - always refresh cache on direct API calls
    console.log('🔄 Calling validateSubscription function...');
    const validation = await validateSubscription(apiKey);
    console.log('📦 Validation result:', JSON.stringify(validation, null, 2));

    if (validation.valid && validation.userData) {
      console.log('✅ Validation successful, returning user data');
      console.log('🔍 === VALIDATE-SUBSCRIPTION ROUTE END (SUCCESS) ===');
      return res.status(200).json(validation.userData);
    } else {
      console.log('❌ Validation failed:', validation.error);
      console.log('🔍 === VALIDATE-SUBSCRIPTION ROUTE END (FAILED) ===');
      return res.status(401).json({ error: validation.error || 'Invalid API Key' });
    }
  } catch (error) {
    console.error('💥 Validation error:', error);
    console.error('💥 Error stack:', error.stack);
    console.log('🔍 === VALIDATE-SUBSCRIPTION ROUTE END (ERROR) ===');
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
router.post('/clear-subscription-cache', (req, res) => {
  const { apiKey } = req.query;

  if (apiKey) {
    // Clear specific API key's cache
    if (subscriptionCache.has(apiKey)) {
      subscriptionCache.delete(apiKey);
      console.log(
        `🧹 Cleared subscription cache for key: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...`
      );
      return res.status(200).json({
        message: 'Cache cleared for specific API key',
        cleared: true,
      });
    } else {
      return res.status(404).json({
        message: 'No cache found for the specified API key',
        cleared: false,
      });
    }
  } else {
    // Clear all cache
    const cacheSize = subscriptionCache.size;
    subscriptionCache.clear();
    console.log(`🧹 Cleared entire subscription cache (${cacheSize} entries)`);
    return res.status(200).json({
      message: `Cleared entire subscription cache (${cacheSize} entries)`,
      cleared: true,
      entriesCleared: cacheSize,
    });
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
    console.log(`🧹 Starting complete data cleanup for user: ${apiKey.substring(0, 8)}...`);

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
        console.log(`🗑️ Cleared subscription cache for user`);
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
        console.log(`🗑️ Cleared user accounts configuration`);
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
        console.log(`🗑️ Cleared MT5 data for user`);
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
        console.log(`🗑️ Cleared cTrader data for user`);
      }
    } catch (error) {
      console.error('Error clearing cTrader data:', error);
      clearedData.errors.push('ctrader_data');
    }

    console.log(`✅ Data cleanup completed for user: ${apiKey.substring(0, 8)}...`);

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

export default router;
