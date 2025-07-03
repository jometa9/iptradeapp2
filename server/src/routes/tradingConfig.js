import express from 'express';

import {
  getAllTradingConfigs,
  getTradingConfig,
  removeTradingConfig,
  resetTradingConfig,
  setTradingConfig,
} from '../controllers/tradingConfigController.js';

const router = express.Router();

/**
 * @swagger
 * /trading-config:
 *   get:
 *     summary: Get all trading configurations
 *     tags: [TradingConfig]
 *     responses:
 *       200:
 *         description: All trading configurations
 *   post:
 *     summary: Set trading configuration for master account
 *     tags: [TradingConfig]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               masterAccountId:
 *                 type: string
 *                 example: master_123
 *               config:
 *                 type: object
 *                 example:
 *                   risk: conservative
 *                   maxLots: 2
 *           example:
 *             masterAccountId: master_123
 *             config:
 *               risk: conservative
 *               maxLots: 2
 *     responses:
 *       200:
 *         description: Trading configuration set
 *         content:
 *           application/json:
 *             example:
 *               message: Trading config set
 *   put:
 *     summary: Update trading configuration for master account
 *     tags: [TradingConfig]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               masterAccountId:
 *                 type: string
 *                 example: master_123
 *               config:
 *                 type: object
 *                 example:
 *                   risk: aggressive
 *                   maxLots: 5
 *           example:
 *             masterAccountId: master_123
 *             config:
 *               risk: aggressive
 *               maxLots: 5
 *     responses:
 *       200:
 *         description: Trading configuration updated
 *         content:
 *           application/json:
 *             example:
 *               message: Trading config updated
 */
router.get('/trading-config', getAllTradingConfigs);
router.post('/trading-config', setTradingConfig);
router.put('/trading-config', setTradingConfig);

/**
 * @swagger
 * /trading-config/{masterAccountId}:
 *   get:
 *     summary: Get trading configuration for specific master account
 *     tags: [TradingConfig]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trading configuration for master
 *   delete:
 *     summary: Remove trading configuration for master account
 *     tags: [TradingConfig]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trading configuration removed
 */
router.get('/trading-config/:masterAccountId', getTradingConfig);
router.delete('/trading-config/:masterAccountId', removeTradingConfig);

/**
 * @swagger
 * /trading-config/{masterAccountId}/reset:
 *   post:
 *     summary: Reset trading configuration to defaults
 *     tags: [TradingConfig]
 *     parameters:
 *       - in: path
 *         name: masterAccountId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trading configuration reset
 */
router.post('/trading-config/:masterAccountId/reset', resetTradingConfig);

export default router;
