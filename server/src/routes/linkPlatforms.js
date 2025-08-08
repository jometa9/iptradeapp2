import express from 'express';
const router = express.Router();
import linkPlatformsController from '../controllers/linkPlatformsController.js';
import { requireValidSubscription } from '../middleware/subscriptionAuth.js';

// POST /api/link-platforms
router.post('/', requireValidSubscription, (req, res) => linkPlatformsController.linkPlatforms(req, res));

export default router;
