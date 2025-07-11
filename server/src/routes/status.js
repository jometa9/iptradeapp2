import express from 'express';

import { getStatus } from '../controllers/statusController.js';
import { validateSubscription } from '../middleware/subscriptionAuth.js';

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
  console.log('📝 Request details:');
  console.log('  - Method:', req.method);
  console.log('  - URL:', req.url);
  console.log('  - Headers:', req.headers);
  console.log('  - Query params:', req.query);
  
  const { apiKey } = req.query;

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

export default router;
