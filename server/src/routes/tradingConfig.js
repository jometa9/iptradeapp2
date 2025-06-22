import express from 'express';

import {
  getAllTradingConfigs,
  getTradingConfig,
  removeTradingConfig,
  resetTradingConfig,
  setTradingConfig,
} from '../controllers/tradingConfigController.js';

const router = express.Router();

// GET all trading configurations
router.get('/trading-config', getAllTradingConfigs);

// GET trading configuration for specific master account
router.get('/trading-config/:masterAccountId', getTradingConfig);

// POST/PUT to set trading configuration for master account
router.post('/trading-config', setTradingConfig);
router.put('/trading-config', setTradingConfig);

// POST to reset trading configuration to defaults
router.post('/trading-config/:masterAccountId/reset', resetTradingConfig);

// DELETE trading configuration for master account
router.delete('/trading-config/:masterAccountId', removeTradingConfig);

export default router;
