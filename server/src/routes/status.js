import express from 'express';

import { getStatus } from '../controllers/statusController.js';

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

// Endpoint para validar suscripción
/**
 * @swagger
 * /validate-subscription:
 *   get:
 *     summary: Validate subscription by API key
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
router.get('/validate-subscription', (req, res) => {
  const { apiKey } = req.query;

  // Only log first few characters of API key for security
  console.log('🔐 Validating API Key:', apiKey.substring(0, 8) + '...');

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  // Mock data para testing - en producción conectar con base de datos real
  const mockUsers = {
    'test-key-active': {
      userId: 'user_123',
      email: 'user@example.com',
      name: 'Test User',
      subscriptionStatus: 'active',
      planName: 'Pro Plan',
      isActive: true,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
      daysRemaining: 30,
      statusChanged: false,
      subscriptionType: 'paid',
    },
    'test-key-trial': {
      userId: 'user_456',
      email: 'trial@example.com',
      name: 'Trial User',
      subscriptionStatus: 'trialing',
      planName: 'Trial Plan',
      isActive: true,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
      daysRemaining: 7,
      statusChanged: false,
      subscriptionType: 'paid',
    },
    'test-key-admin': {
      userId: 'user_789',
      email: 'admin@example.com',
      name: 'Admin User',
      subscriptionStatus: 'admin_assigned',
      planName: 'Admin Plan',
      isActive: true,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 año
      daysRemaining: 365,
      statusChanged: false,
      subscriptionType: 'admin_assigned',
    },
    'test-key-free': {
      userId: 'user_999',
      email: 'free@example.com',
      name: 'Free User',
      subscriptionStatus: 'active',
      planName: 'Free Plan',
      isActive: true,
      expiryDate: null,
      daysRemaining: -1, // Sin límite
      statusChanged: false,
      subscriptionType: 'free',
    },
  };

  const userData = mockUsers[apiKey];

  if (!userData) {
    return res.status(401).json({ error: 'Invalid API Key' });
  }

  // Calcular si la suscripción está activa
  const now = new Date();
  const expiry = userData.expiryDate ? new Date(userData.expiryDate) : null;

  if (expiry && now > expiry) {
    userData.isActive = false;
    userData.subscriptionStatus = 'expired';
    userData.daysRemaining = 0;
  }

  return res.status(200).json(userData);
});

export default router;
