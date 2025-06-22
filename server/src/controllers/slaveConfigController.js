import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Slave configurations file management
const configBaseDir = join(process.cwd(), 'server', 'config');
const slaveConfigFilePath = join(configBaseDir, 'slave_configurations.json');

// Initialize slave configurations
const initializeSlaveConfig = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(slaveConfigFilePath)) {
    writeFileSync(slaveConfigFilePath, JSON.stringify({}, null, 2));
  }
};

// Load slave configurations
const loadSlaveConfigs = () => {
  initializeSlaveConfig();
  try {
    const data = readFileSync(slaveConfigFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading slave configs:', error);
    return {};
  }
};

// Save slave configurations
const saveSlaveConfigs = config => {
  try {
    writeFileSync(slaveConfigFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving slave configs:', error);
    return false;
  }
};

// Default slave configuration
const getDefaultSlaveConfig = () => ({
  // Trading transformations (applied after master transformations)
  lotMultiplier: 1.0,
  forceLot: null,
  reverseTrading: false,

  // Risk management
  maxLotSize: null,
  minLotSize: null,

  // Symbol filtering
  allowedSymbols: [], // Empty array means all symbols allowed
  blockedSymbols: [],

  // Order type filtering
  allowedOrderTypes: [], // Empty array means all types allowed
  blockedOrderTypes: [],

  // Time-based filtering
  tradingHours: {
    enabled: false,
    startTime: '00:00',
    endTime: '23:59',
    timezone: 'UTC',
  },

  // Additional settings
  enabled: true,
  description: '',
  lastUpdated: null,
});

// Reverse trading type mappings (same as master)
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

// Apply slave-specific transformations to order data
export const applySlaveTransformations = (orderData, slaveAccountId) => {
  const configs = loadSlaveConfigs();
  const slaveConfig = configs[slaveAccountId] || getDefaultSlaveConfig();

  // Check if slave is enabled
  if (!slaveConfig.enabled) {
    return null; // Slave is disabled, don't process order
  }

  let transformedData = { ...orderData };

  // Symbol filtering
  if (slaveConfig.allowedSymbols.length > 0) {
    if (!slaveConfig.allowedSymbols.includes(transformedData.symbol)) {
      console.log(`Symbol ${transformedData.symbol} not allowed for slave ${slaveAccountId}`);
      return null;
    }
  }

  if (slaveConfig.blockedSymbols.includes(transformedData.symbol)) {
    console.log(`Symbol ${transformedData.symbol} is blocked for slave ${slaveAccountId}`);
    return null;
  }

  // Order type filtering
  const orderType = transformedData.type.toUpperCase();
  if (slaveConfig.allowedOrderTypes.length > 0) {
    if (!slaveConfig.allowedOrderTypes.includes(orderType)) {
      console.log(`Order type ${orderType} not allowed for slave ${slaveAccountId}`);
      return null;
    }
  }

  if (slaveConfig.blockedOrderTypes.includes(orderType)) {
    console.log(`Order type ${orderType} is blocked for slave ${slaveAccountId}`);
    return null;
  }

  // Apply lot transformations
  if (slaveConfig.forceLot !== null && slaveConfig.forceLot !== undefined) {
    // Force specific lot (overrides master transformations)
    transformedData.lot = slaveConfig.forceLot.toString();
  } else if (slaveConfig.lotMultiplier !== 1.0) {
    // Apply additional lot multiplier
    const currentLot = parseFloat(transformedData.lot) || 0;
    transformedData.lot = (currentLot * slaveConfig.lotMultiplier).toFixed(2);
  }

  // Apply lot size limits
  const finalLot = parseFloat(transformedData.lot);
  if (slaveConfig.maxLotSize !== null && finalLot > slaveConfig.maxLotSize) {
    transformedData.lot = slaveConfig.maxLotSize.toString();
    console.log(`Lot size capped at ${slaveConfig.maxLotSize} for slave ${slaveAccountId}`);
  }
  if (slaveConfig.minLotSize !== null && finalLot < slaveConfig.minLotSize) {
    transformedData.lot = slaveConfig.minLotSize.toString();
    console.log(
      `Lot size increased to minimum ${slaveConfig.minLotSize} for slave ${slaveAccountId}`
    );
  }

  // Apply reverse trading (after master reverse trading)
  if (slaveConfig.reverseTrading) {
    const currentType = transformedData.type.toUpperCase();
    const reversedType = reverseTypeMapping[currentType];

    if (reversedType) {
      transformedData.type = reversedType;

      // Swap TP and SL for reverse trading
      const originalSl = transformedData.sl;
      const originalTp = transformedData.tp;
      transformedData.sl = originalTp;
      transformedData.tp = originalSl;

      console.log(
        `Applied slave reverse trading for ${slaveAccountId}: ${currentType} → ${reversedType}, SL/TP swapped`
      );
    }
  }

  return transformedData;
};

// Get slave configuration
export const getSlaveConfig = (req, res) => {
  const { slaveAccountId } = req.params;

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const configs = loadSlaveConfigs();
  const slaveConfig = configs[slaveAccountId] || getDefaultSlaveConfig();

  res.json({
    slaveAccountId,
    config: slaveConfig,
    status: 'success',
  });
};

// Set slave configuration
export const setSlaveConfig = (req, res) => {
  const {
    slaveAccountId,
    lotMultiplier,
    forceLot,
    reverseTrading,
    maxLotSize,
    minLotSize,
    allowedSymbols,
    blockedSymbols,
    allowedOrderTypes,
    blockedOrderTypes,
    tradingHours,
    enabled,
    description,
  } = req.body;

  if (!slaveAccountId) {
    return res.status(400).json({
      error: 'slaveAccountId is required',
    });
  }

  const configs = loadSlaveConfigs();

  // Initialize slave config if it doesn't exist
  if (!configs[slaveAccountId]) {
    configs[slaveAccountId] = getDefaultSlaveConfig();
  }

  // Update configuration
  if (lotMultiplier !== undefined) {
    const multiplier = parseFloat(lotMultiplier);
    if (isNaN(multiplier) || multiplier <= 0) {
      return res.status(400).json({ error: 'lotMultiplier must be a positive number' });
    }
    configs[slaveAccountId].lotMultiplier = multiplier;
  }

  if (forceLot !== undefined) {
    if (forceLot === null || forceLot === '') {
      configs[slaveAccountId].forceLot = null;
    } else {
      const lot = parseFloat(forceLot);
      if (isNaN(lot) || lot <= 0) {
        return res.status(400).json({ error: 'forceLot must be a positive number or null' });
      }
      configs[slaveAccountId].forceLot = lot;
    }
  }

  if (reverseTrading !== undefined) {
    configs[slaveAccountId].reverseTrading = Boolean(reverseTrading);
  }

  if (maxLotSize !== undefined) {
    if (maxLotSize === null || maxLotSize === '') {
      configs[slaveAccountId].maxLotSize = null;
    } else {
      const lot = parseFloat(maxLotSize);
      if (isNaN(lot) || lot <= 0) {
        return res.status(400).json({ error: 'maxLotSize must be a positive number or null' });
      }
      configs[slaveAccountId].maxLotSize = lot;
    }
  }

  if (minLotSize !== undefined) {
    if (minLotSize === null || minLotSize === '') {
      configs[slaveAccountId].minLotSize = null;
    } else {
      const lot = parseFloat(minLotSize);
      if (isNaN(lot) || lot <= 0) {
        return res.status(400).json({ error: 'minLotSize must be a positive number or null' });
      }
      configs[slaveAccountId].minLotSize = lot;
    }
  }

  if (allowedSymbols !== undefined) {
    configs[slaveAccountId].allowedSymbols = Array.isArray(allowedSymbols) ? allowedSymbols : [];
  }

  if (blockedSymbols !== undefined) {
    configs[slaveAccountId].blockedSymbols = Array.isArray(blockedSymbols) ? blockedSymbols : [];
  }

  if (allowedOrderTypes !== undefined) {
    configs[slaveAccountId].allowedOrderTypes = Array.isArray(allowedOrderTypes)
      ? allowedOrderTypes
      : [];
  }

  if (blockedOrderTypes !== undefined) {
    configs[slaveAccountId].blockedOrderTypes = Array.isArray(blockedOrderTypes)
      ? blockedOrderTypes
      : [];
  }

  if (tradingHours !== undefined) {
    configs[slaveAccountId].tradingHours = {
      ...configs[slaveAccountId].tradingHours,
      ...tradingHours,
    };
  }

  if (enabled !== undefined) {
    configs[slaveAccountId].enabled = Boolean(enabled);
  }

  if (description !== undefined) {
    configs[slaveAccountId].description = description;
  }

  configs[slaveAccountId].lastUpdated = new Date().toISOString();

  if (saveSlaveConfigs(configs)) {
    console.log(`Slave configuration updated for ${slaveAccountId}:`, configs[slaveAccountId]);
    res.json({
      message: 'Slave configuration saved successfully',
      slaveAccountId,
      config: configs[slaveAccountId],
      status: 'success',
    });
  } else {
    res.status(500).json({ error: 'Failed to save slave configuration' });
  }
};

// Remove slave configuration
export const removeSlaveConfig = (req, res) => {
  const { slaveAccountId } = req.params;

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const configs = loadSlaveConfigs();

  if (!configs[slaveAccountId]) {
    return res.status(404).json({
      error: `No configuration found for slave account: ${slaveAccountId}`,
    });
  }

  delete configs[slaveAccountId];

  if (saveSlaveConfigs(configs)) {
    console.log(`Slave configuration removed for: ${slaveAccountId}`);
    res.json({
      message: 'Slave configuration removed successfully',
      slaveAccountId,
      status: 'removed',
    });
  } else {
    res.status(500).json({ error: 'Failed to remove slave configuration' });
  }
};

// Get all slave configurations
export const getAllSlaveConfigs = (req, res) => {
  const configs = loadSlaveConfigs();

  res.json({
    configurations: configs,
    totalConfigurations: Object.keys(configs).length,
  });
};

// Reset slave configuration to defaults
export const resetSlaveConfig = (req, res) => {
  const { slaveAccountId } = req.params;

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const configs = loadSlaveConfigs();
  configs[slaveAccountId] = getDefaultSlaveConfig();

  if (saveSlaveConfigs(configs)) {
    console.log(`Slave configuration reset to defaults for ${slaveAccountId}`);
    res.json({
      message: 'Slave configuration reset to defaults',
      slaveAccountId,
      config: configs[slaveAccountId],
      status: 'reset',
    });
  } else {
    res.status(500).json({ error: 'Failed to reset slave configuration' });
  }
};
