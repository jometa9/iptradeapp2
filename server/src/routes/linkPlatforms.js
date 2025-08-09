import express from 'express';

import linkPlatformsController from '../controllers/linkPlatformsController.js';
import { requireValidSubscription } from '../middleware/subscriptionAuth.js';

const router = express.Router();

// POST /api/link-platforms
router.post('/', requireValidSubscription, (req, res) =>
  linkPlatformsController.linkPlatforms(req, res)
);

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

export default router;
