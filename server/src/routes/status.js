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
  const { apiKey } = req.query;

  console.log(
    '🔐 Frontend validating API Key:',
    apiKey ? apiKey.substring(0, 8) + '...' : 'undefined'
  );

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  try {
    const validation = await validateSubscription(apiKey);

    if (validation.valid && validation.userData) {
      return res.status(200).json(validation.userData);
    } else {
      return res.status(401).json({ error: validation.error || 'Invalid API Key' });
    }
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
