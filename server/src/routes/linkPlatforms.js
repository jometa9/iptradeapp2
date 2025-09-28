import express from 'express';

import linkPlatformsController from '../controllers/linkPlatformsController.js';
import { requireValidSubscription } from '../middleware/subscriptionAuth.js';

const router = express.Router();
console.log('🚀 ROUTES: linkPlatforms router created, registering routes...');

// POST /api/link-platforms - Buscar carpetas e instalar bots
router.post('/', requireValidSubscription, (req, res) =>
  linkPlatformsController.linkPlatforms(req, res)
);

// POST /api/link-platforms/find-bots - Solo buscar archivos CSV
console.log('🚀 ROUTES: Registering POST /find-bots route');
router.post('/find-bots', requireValidSubscription, (req, res) => {
  console.log('🔍 ROUTE HANDLER: /find-bots route called');
  return linkPlatformsController.findBotsEndpoint(req, res);
});

// GET /api/link-platforms/status
router.get('/status', requireValidSubscription, (req, res) => {
  try {
    const status = linkPlatformsController.getLinkingStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting link platforms status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

console.log('🚀 ROUTES: linkPlatforms routes registered successfully');
export default router;
