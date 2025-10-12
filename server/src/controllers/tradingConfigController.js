import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Trading configuration file management
const configBaseDir = join(process.cwd(), 'config');
const tradingConfigFilePath = join(configBaseDir, 'trading_transformations.json');

// Initialize config directory if it doesn't exist
const initializeTradingConfig = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(tradingConfigFilePath)) {
    writeFileSync(tradingConfigFilePath, JSON.stringify({}, null, 2));
  }
};

// Load trading configurations
const loadTradingConfig = () => {
  initializeTradingConfig();
  try {
    const data = readFileSync(tradingConfigFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading trading config:', error);
    return {};
  }
};

// Save trading configurations
const saveTradingConfig = config => {
  try {
    writeFileSync(tradingConfigFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving trading config:', error);
    return false;
  }
};

// Default configuration for new accounts
const getDefaultConfig = () => ({
  lotMultiplier: 1.0,
  forceLot: null,
  reverseTrading: false,
  prefix: '',
  suffix: '',
  translations: {},
});

// Create default trading configuration for new master account
export const createDefaultTradingConfig = masterAccountId => {
  if (!masterAccountId) {
    console.error('❌ Cannot create trading configuration: masterAccountId is undefined');
    return false;
  }

  const configs = loadTradingConfig();

  // Only create if it doesn't exist
  if (!configs[masterAccountId]) {
    configs[masterAccountId] = getDefaultConfig();

    if (saveTradingConfig(configs)) {
      return true;
    } else {
      console.error(`❌ Failed to create trading configuration for master ${masterAccountId}`);
      return false;
    }
  }

  return true; // Already exists
};

// Reverse trading type mappings
const reverseTypeMapping = {
  BUY: 'SELL',
  SELL: 'BUY',
  'BUY STOP': 'SELL LIMIT',
  'SELL STOP': 'BUY LIMIT',
  'BUY LIMIT': 'SELL STOP',
  'SELL LIMIT': 'BUY STOP',
  BUYSTOP: 'SELLLIMIT',
  SELLSTOP: 'BUYLIMIT',
  BUYLIMIT: 'SELLSTOP',
  SELLLIMIT: 'BUYSTOP',
};

// Apply transformations to order data
export const applyTransformations = (orderData, masterAccountId) => {
  const configs = loadTradingConfig();
  const accountConfig = configs[masterAccountId] || getDefaultConfig();

  let transformedData = { ...orderData };

  // Apply lot transformations
  if (accountConfig.forceLot !== null && accountConfig.forceLot !== undefined) {
    // Force specific lot
    transformedData.lot = accountConfig.forceLot.toString();
  } else if (accountConfig.lotMultiplier !== 1.0) {
    // Apply lot multiplier
    const originalLot = parseFloat(orderData.lot) || 0;
    transformedData.lot = (originalLot * accountConfig.lotMultiplier).toFixed(2);
  }

  // Apply reverse trading
  if (accountConfig.reverseTrading) {
    const originalType = orderData.type.toUpperCase();
    const reversedType = reverseTypeMapping[originalType];

    if (reversedType) {
      transformedData.type = reversedType;

      // Swap TP and SL for reverse trading
      const originalSl = transformedData.sl;
      const originalTp = transformedData.tp;
      transformedData.sl = originalTp;
      transformedData.tp = originalSl;
    }
  }

  // Apply prefix and suffix to comment
  if (accountConfig.prefix || accountConfig.suffix) {
    const originalComment = transformedData.comment || '';
    transformedData.comment = `${accountConfig.prefix}${originalComment}${accountConfig.suffix}`;
  }

  return transformedData;
};

// Get trading configuration for specific master account
export const getTradingConfig = (req, res) => {
  const { masterAccountId } = req.params;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const configs = loadTradingConfig();
  const accountConfig = configs[masterAccountId] || getDefaultConfig();

  res.json({
    masterAccountId,
    config: accountConfig,
    status: 'success',
  });
};

// Set trading configuration for specific master account
export const setTradingConfig = async (req, res) => {
  const { masterAccountId, lotMultiplier, forceLot, reverseTrading, prefix, suffix, translations } = req.body;

  if (!masterAccountId) {
    return res.status(400).json({
      error: 'masterAccountId is required',
    });
  }

  const configs = loadTradingConfig();

  // Initialize account config if it doesn't exist
  if (!configs[masterAccountId]) {
    configs[masterAccountId] = getDefaultConfig();
  }

  // Update configuration
  if (lotMultiplier !== undefined) {
    const multiplier = parseFloat(lotMultiplier);
    if (isNaN(multiplier) || multiplier <= 0) {
      return res.status(400).json({ error: 'lotMultiplier must be a positive number' });
    }
    configs[masterAccountId].lotMultiplier = multiplier;
  }

  if (forceLot !== undefined) {
    if (forceLot === null || forceLot === '') {
      configs[masterAccountId].forceLot = null;
    } else {
      const lot = parseFloat(forceLot);
      if (isNaN(lot) || lot <= 0) {
        return res.status(400).json({ error: 'forceLot must be a positive number or null' });
      }
      configs[masterAccountId].forceLot = lot;
    }
  }

  if (reverseTrading !== undefined) {
    configs[masterAccountId].reverseTrading = Boolean(reverseTrading);
  }

  if (prefix !== undefined) {
    configs[masterAccountId].prefix = String(prefix || '');
  }

  if (suffix !== undefined) {
    configs[masterAccountId].suffix = String(suffix || '');
  }

  if (translations !== undefined) {
    configs[masterAccountId].translations = translations || {};
  }

  if (saveTradingConfig(configs)) {
    // Also update CSV file with the new configuration
    try {
      // Import csvManager dynamically to avoid circular imports
      const csvManager = (await import('../services/csvManager.js')).default;
      
      // Get current enabled state from CSV to preserve it
      const currentEnabled = csvManager.isMasterEnabled(masterAccountId);
      console.log(`📝 Trading Config: Updating CSV for master ${masterAccountId}, enabled: ${currentEnabled}`);

      const csvConfig = {
        type: 'master',
        enabled: currentEnabled !== undefined ? currentEnabled : true, // Default to true if undefined
        name: masterAccountId,
        prefix: configs[masterAccountId].prefix,
        suffix: configs[masterAccountId].suffix,
        translations: configs[masterAccountId].translations,
      };
      
      console.log(`📝 Trading Config: CSV Config to write:`, csvConfig);
      
      const result = csvManager.writeConfig(masterAccountId, csvConfig);
      console.log(`📝 Trading Config: writeConfig result: ${result}`);
      
    } catch (error) {
      console.error(`❌ Error updating CSV for master ${masterAccountId}:`, error);
      // Don't fail the response if CSV update fails
    }

    res.json({
      message: 'Trading configuration saved successfully',
      masterAccountId,
      config: configs[masterAccountId],
      status: 'success',
    });
  } else {
    res.status(500).json({ error: 'Failed to save trading configuration' });
  }
};

// Remove trading configuration for specific master account
export const removeTradingConfig = (req, res) => {
  const { masterAccountId } = req.params;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const configs = loadTradingConfig();

  if (!configs[masterAccountId]) {
    return res.status(404).json({
      error: `No trading configuration found for master account: ${masterAccountId}`,
    });
  }

  delete configs[masterAccountId];

  if (saveTradingConfig(configs)) {
    res.json({
      message: 'Trading configuration removed successfully',
      masterAccountId,
      status: 'removed',
    });
  } else {
    res.status(500).json({ error: 'Failed to remove trading configuration' });
  }
};

// Get all trading configurations
export const getAllTradingConfigs = (req, res) => {
  const configs = loadTradingConfig();

  res.json({
    configurations: configs,
    totalConfigurations: Object.keys(configs).length,
  });
};

// Reset trading configuration to defaults for specific master account
export const resetTradingConfig = (req, res) => {
  const { masterAccountId } = req.params;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const configs = loadTradingConfig();
  configs[masterAccountId] = getDefaultConfig();

  if (saveTradingConfig(configs)) {
    res.json({
      message: 'Trading configuration reset to defaults',
      masterAccountId,
      config: configs[masterAccountId],
      status: 'reset',
    });
  } else {
    res.status(500).json({ error: 'Failed to reset trading configuration' });
  }
};
