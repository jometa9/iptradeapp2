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

  // Master connection
  masterId: null,
  masterCsvPath: null, // Path to master's CSV file for direct reading (Windows only)

  // Additional settings
  enabled: true,
  description: '',
  lastUpdated: null,
});

// Default slave configuration for new accounts converted from pending
// These accounts should be disabled by default as per requirement
const getDisabledSlaveConfig = () => ({
  // Trading transformations (applied after master transformations)
  lotMultiplier: 1.0,
  forceLot: null,
  reverseTrading: false,

  // Master connection
  masterId: null,

  // Additional settings
  enabled: false, // Disabled by default for new accounts from pending
  description: 'Account converted from pending - disabled by default',
  lastUpdated: new Date().toISOString(),
});

// Create disabled slave configuration for new account
export const createDisabledSlaveConfig = slaveAccountId => {
  const configs = loadSlaveConfigs();

  // Only create if it doesn't exist
  if (!configs[slaveAccountId]) {
    configs[slaveAccountId] = getDisabledSlaveConfig();

    if (saveSlaveConfigs(configs)) {
      return true;
    } else {
      console.error(`❌ Failed to create slave configuration for ${slaveAccountId}`);
      return false;
    }
  }

  return true; // Already exists
};

// Create slave configuration with specific settings from pending conversion
export const createSlaveConfigWithSettings = (slaveAccountId, settings) => {
  const configs = loadSlaveConfigs();

  // Create base config
  const baseConfig = getDisabledSlaveConfig();

  // Apply provided settings
  if (settings.masterAccountId) {
    baseConfig.masterAccountId = settings.masterAccountId;
  }

  if (settings.lotCoefficient !== undefined) {
    baseConfig.lotMultiplier = settings.lotCoefficient;
  }

  if (settings.forceLot !== undefined && settings.forceLot !== null) {
    baseConfig.forceLot = settings.forceLot;
  }

  if (settings.reverseTrade !== undefined) {
    baseConfig.reverseTrading = settings.reverseTrade;
  }

  // Update description to indicate it was converted from pending
  baseConfig.description = 'Account converted from pending with custom settings';
  baseConfig.lastUpdated = new Date().toISOString();

  // Save the configuration
  configs[slaveAccountId] = baseConfig;

  if (saveSlaveConfigs(configs)) {
    return true;
  } else {
    console.error(`❌ Failed to create slave configuration for ${slaveAccountId}`);
    return false;
  }
};

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
      return null;
    }
  }

  if (slaveConfig.blockedSymbols.includes(transformedData.symbol)) {
    return null;
  }

  // Order type filtering
  const orderType = transformedData.type.toUpperCase();
  if (slaveConfig.allowedOrderTypes.length > 0) {
    if (!slaveConfig.allowedOrderTypes.includes(orderType)) {
      return null;
    }
  }

  if (slaveConfig.blockedOrderTypes.includes(orderType)) {
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
  }
  if (slaveConfig.minLotSize !== null && finalLot < slaveConfig.minLotSize) {
    transformedData.lot = slaveConfig.minLotSize.toString();
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
    }
  }

  return transformedData;
};

// Get slave configuration
export const getSlaveConfig = async (req, res) => {
  const { slaveAccountId } = req.params;

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  // Primero intentar leer la configuración del CSV usando datos del scan
  let csvConfig = null;
  try {
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);

    if (csvManager && csvManager.csvFiles) {
      // Buscar en archivos CSV escaneados
      for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
        // Primero verificar en datos parseados
        const accountExists = fileData.data.some(account => account.account_id === slaveAccountId);

        if (
          accountExists ||
          (existsSync(filePath) && readFileSync(filePath, 'utf8').includes(`[${slaveAccountId}]`))
        ) {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n');

          for (const line of lines) {
            const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

            if (cleanLine.includes('[CONFIG]') && cleanLine.includes('[SLAVE]')) {
              const matches = cleanLine.match(/\[([^\]]*)\]/g);
              if (matches && matches.length >= 7) {
                const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());

                csvConfig = {
                  enabled: values[2] === 'ENABLED',
                  lotMultiplier: parseFloat(values[3]) || 1.0,
                  forceLot: values[4] !== 'NULL' ? parseFloat(values[4]) : null,
                  reverseTrading: values[5] === 'TRUE',
                  masterId: values[6] !== 'NULL' ? values[6] : null,
                  masterCsvPath: values.length >= 8 && values[7] !== 'NULL' ? values[7] : null, // Include master CSV path if available
                  description: '',
                  lastUpdated: new Date().toISOString(),
                };

                break;
              }
            }
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error(`Error reading CSV config for ${slaveAccountId}:`, error);
  }

  // Si no se encontró en CSV, usar la configuración del JSON como fallback
  if (!csvConfig) {
    const configs = loadSlaveConfigs();
    csvConfig = configs[slaveAccountId] || getDefaultSlaveConfig();
  }

  res.json({
    slaveAccountId,
    config: csvConfig,
    status: 'success',
  });
};

// Test endpoint
export const testSlaveConfig = async (req, res) => {
  res.json({ message: 'Test endpoint working' });
};

// Set slave configuration
export const setSlaveConfig = async (req, res) => {
  const {
    slaveAccountId,
    lotMultiplier,
    forceLot,
    reverseTrading,
    enabled,
    description,
    masterId,
    masterCsvPath,
  } = req.body;

  if (!slaveAccountId) {
    return res.status(400).json({
      error: 'slaveAccountId is required',
    });
  }

  // Apply subscription-based restrictions
  const userPlan = req.user?.planName;
  const subscriptionLimits = req.subscriptionLimits;

  // Check if this is a free user (null plan)
  if (userPlan === null && subscriptionLimits?.maxLotSize === 0.01) {
    // For free users, override lot configurations to force 0.01
    req.body.forceLot = 0.01;
    req.body.lotMultiplier = 1.0;
  }

  const configs = loadSlaveConfigs();

  // Initialize slave config if it doesn't exist
  if (!configs[slaveAccountId]) {
    configs[slaveAccountId] = getDefaultSlaveConfig();
  }

  // Update configuration with subscription-enforced values
  const finalLotMultiplier =
    req.body.lotMultiplier !== undefined ? req.body.lotMultiplier : lotMultiplier;
  const finalForceLot = req.body.forceLot !== undefined ? req.body.forceLot : forceLot;

  // Update configuration
  if (finalLotMultiplier !== undefined) {
    const multiplier = parseFloat(finalLotMultiplier);
    if (isNaN(multiplier) || multiplier <= 0) {
      return res.status(400).json({ error: 'lotMultiplier must be a positive number' });
    }
    configs[slaveAccountId].lotMultiplier = multiplier;
  }

  if (finalForceLot !== undefined) {
    if (finalForceLot === null || finalForceLot === '') {
      configs[slaveAccountId].forceLot = null;
    } else {
      const lot = parseFloat(finalForceLot);
      if (isNaN(lot) || lot <= 0) {
        return res.status(400).json({ error: 'forceLot must be a positive number or null' });
      }
      configs[slaveAccountId].forceLot = lot;
    }
  }

  if (reverseTrading !== undefined) {
    configs[slaveAccountId].reverseTrading = Boolean(reverseTrading);
  }

  if (enabled !== undefined) {
    configs[slaveAccountId].enabled = Boolean(enabled);
  }

  if (description !== undefined) {
    configs[slaveAccountId].description = description;
  }

  // Handle masterId update
  if (masterId !== undefined) {
    configs[slaveAccountId].masterId = masterId === 'none' || masterId === '' ? null : masterId;
  }

  // Handle masterCsvPath update (for direct reading in Windows)
  if (masterCsvPath !== undefined) {
    configs[slaveAccountId].masterCsvPath =
      masterCsvPath === 'none' || masterCsvPath === '' ? null : masterCsvPath;
  }

  configs[slaveAccountId].lastUpdated = new Date().toISOString();

  // Save configuration
  if (saveSlaveConfigs(configs)) {
    // Actualizar también el CSV para sincronizar con el frontend

    try {
      // Buscar el archivo CSV correcto para esta cuenta usando datos del scan
      const csvManager = await import('../services/csvManager.js')
        .then(m => m.default)
        .catch(() => null);

      let targetFile = null;
      let foundAccount = false;

      if (csvManager && csvManager.csvFiles) {
        // Buscar en archivos CSV escaneados
        for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
          // Primero verificar en datos parseados
          const accountExists = fileData.data.some(
            account => account.account_id === slaveAccountId
          );

          if (accountExists) {
            targetFile = filePath;
            foundAccount = true;
            break;
          }

          // Fallback: verificar contenido crudo del archivo
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            if (content.includes(`[${slaveAccountId}]`)) {
              targetFile = filePath;
              foundAccount = true;
              break;
            }
          }
        }
      }

      if (targetFile && foundAccount) {
        const content = readFileSync(targetFile, 'utf8');
        const lines = content.split('\n');
        const currentTimestamp = Math.floor(Date.now() / 1000);

        let newContent = '';
        for (const line of lines) {
          const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

          if (cleanLine.includes('[CONFIG]') && cleanLine.includes('[SLAVE]')) {
            // Generar la configuración completa del slave
            const slaveConfig = configs[slaveAccountId];
            const lotMultiplier = slaveConfig?.lotMultiplier || 1.0;
            const forceLot = slaveConfig?.forceLot ? slaveConfig.forceLot : 'NULL';
            const reverseTrade = slaveConfig?.reverseTrading ? 'TRUE' : 'FALSE';
            const masterId = slaveConfig?.masterId || 'NULL';

            // SIEMPRE preservar el estado original del CSV al editar
            const originalEnabled = cleanLine.match(/\[(ENABLED|DISABLED)\]/);
            const enabled = originalEnabled ? originalEnabled[1] : 'ENABLED';

            // Get master CSV path if masterId is available
            let masterCsvPath = 'NULL';
            if (masterId && masterId !== 'NULL') {
              try {
                masterCsvPath = (await findMasterCSVPath(masterId)) || 'NULL';
              } catch (error) {
                console.error(`Error finding master CSV path for ${masterId}:`, error);
                masterCsvPath = 'NULL';
              }
            }

            const newConfigLine = `[CONFIG] [SLAVE] [${enabled}] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}] [${masterCsvPath}]\n`;
            newContent += newConfigLine;
          } else if (cleanLine.includes('[STATUS]')) {
            // Actualizar timestamp
            newContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
          } else {
            newContent += line + '\n';
          }
        }

        writeFileSync(targetFile, newContent, 'utf8');
      }
    } catch (error) {
      console.error(`❌ Error updating CSV for slave ${slaveAccountId}:`, error);
      // No fallar la respuesta si el CSV no se puede actualizar
    }

    // Include subscription info in response
    const responseData = {
      message: 'Slave configuration saved successfully',
      slaveAccountId,
      config: configs[slaveAccountId],
      status: 'success',
    };

    // Add subscription-related info if user is on a restricted plan
    if (userPlan === null && subscriptionLimits?.maxLotSize === 0.01) {
      responseData.subscriptionInfo = {
        planName: 'Free',
        restrictions: {
          lotSize: 0.01,
          message: 'Free plan users are limited to 0.01 lot size',
        },
      };
    }

    res.json(responseData);
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

// Export internal functions for use in other controllers
export { loadSlaveConfigs, saveSlaveConfigs };

// Disconnect slave from master by editing CSV file
export const disconnectSlaveFromMaster = async (req, res) => {
  const { slaveAccountId, masterAccountId } = req.params;

  try {
    // Find the CSV file for the slave account
    const csvFiles = await findCSVFilesForAccount(slaveAccountId);

    if (csvFiles.length === 0) {
      return res.status(404).json({
        error: 'CSV file not found for slave account',
        slaveAccountId,
      });
    }

    let success = false;
    for (const csvFile of csvFiles) {
      if (await updateCSVFileToDisconnectSlave(csvFile, slaveAccountId)) {
        success = true;
      }
    }

    if (success) {
      res.json({
        success: true,
        message: `Slave ${slaveAccountId} disconnected from master ${masterAccountId}`,
        slaveAccountId,
        masterAccountId,
      });
    } else {
      res.status(500).json({
        error: 'Failed to disconnect slave from master',
        slaveAccountId,
        masterAccountId,
      });
    }
  } catch (error) {
    console.error(`Error disconnecting slave ${slaveAccountId}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Disconnect all slaves from a master
export const disconnectAllSlavesFromMaster = async (req, res) => {
  const { masterAccountId } = req.params;

  try {
    // Import csvManager to find slaves connected to this master
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);

    if (!csvManager || !csvManager.csvFiles) {
      return res.status(500).json({
        error: 'CSV manager not available',
        message: 'No CSV files have been scanned yet',
      });
    }

    // Find all slaves connected to this master
    const connectedSlaves = [];

    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      fileData.data.forEach(account => {
        if (
          account.account_type === 'slave' &&
          account.config &&
          account.config.masterId === masterAccountId
        ) {
          connectedSlaves.push({
            slaveId: account.account_id,
            filePath: filePath,
          });
        }
      });
    }

    if (connectedSlaves.length === 0) {
      return res.json({
        success: true,
        message: `No slaves found connected to master ${masterAccountId}`,
        masterAccountId,
        disconnectedCount: 0,
        totalSlaves: 0,
      });
    }

    let successCount = 0;
    for (const { slaveId, filePath } of connectedSlaves) {
      try {
        if (await updateCSVFileToDisconnectSlave(filePath, slaveId)) {
          successCount++;
        }
      } catch (error) {
        console.error(`Error disconnecting slave ${slaveId}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Disconnected ${successCount} slaves from master ${masterAccountId}`,
      masterAccountId,
      disconnectedCount: successCount,
      totalSlaves: connectedSlaves.length,
    });
  } catch (error) {
    console.error(`Error disconnecting all slaves from master ${masterAccountId}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Helper function to find CSV files for an account
const findCSVFilesForAccount = async accountId => {
  try {
    // Import csvManager to use scanned CSV files
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);

    if (!csvManager || !csvManager.csvFiles) {
      return [];
    }

    const foundFiles = [];

    // Search through scanned CSV files
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      // First check if the account exists in parsed data
      const accountExists = fileData.data.some(account => account.account_id === accountId);

      if (accountExists) {
        foundFiles.push(filePath);
      }

      // Fallback: check raw file content if parsed data doesn't contain it
      const { existsSync, readFileSync } = await import('fs');
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes(`[${accountId}]`)) {
          if (!foundFiles.includes(filePath)) {
            foundFiles.push(filePath);
          }
        }
      }
    }

    return foundFiles;
  } catch (error) {
    console.error(`Error finding CSV files for account ${accountId}:`, error);
    return [];
  }
};

// Helper function to find CSV file path for a master account
const findMasterCSVPath = async masterId => {
  try {
    // Import csvManager to use scanned CSV files
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);
    if (!csvManager || !csvManager.csvFiles) {
      return null;
    }

    // Search through scanned CSV files
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      // First check if the account exists in parsed data
      const accountExists = fileData.data.some(account => account.account_id === masterId);

      if (accountExists) {
        return filePath;
      }

      // Fallback: check raw file content if parsed data doesn't contain it
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes(`[${masterId}]`)) {
          return filePath;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error finding CSV path for master account ${masterId}:`, error);
    return null;
  }
};

// Helper function to update CSV file to disconnect slave
export const updateCSVFileToDisconnectSlave = async (csvFilePath, slaveAccountId) => {
  try {
    const { readFile, writeFileSync } = await import('fs');

    // Read the CSV file asynchronously to avoid EBUSY errors
    const csvContent = await new Promise((resolve, reject) => {
      readFile(csvFilePath, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'EBUSY' || err.code === 'EACCES') {
            // Retry after a short delay
            setTimeout(() => {
              readFile(csvFilePath, 'utf8', (err2, data2) => {
                if (err2) reject(err2);
                else resolve(data2);
              });
            }, 1000);
          } else {
            reject(err);
          }
        } else {
          resolve(data);
        }
      });
    });

    const lines = csvContent.split('\n');
    let updated = false;

    // Find the TYPE line for the slave account
    const typeLineIndex = lines.findIndex(
      line =>
        line.includes('[TYPE]') && line.includes('[SLAVE]') && line.includes(`[${slaveAccountId}]`)
    );

    if (typeLineIndex !== -1) {
      // Find the corresponding CONFIG line (should be 2 lines after TYPE)
      const configLineIndex = typeLineIndex + 2;

      if (
        configLineIndex < lines.length &&
        lines[configLineIndex].includes('[CONFIG]') &&
        lines[configLineIndex].includes('[SLAVE]')
      ) {
        const configLine = lines[configLineIndex];

        // Update the CONFIG line to set masterId to NULL (handle both 7 and 8 parameter formats)
        let updatedConfigLine = configLine;

        // Try 8-parameter format first (new format with masterCsvPath)
        if (
          configLine.match(
            /\[CONFIG\]\s*\[SLAVE\]\s*\[(ENABLED|DISABLED)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/
          )
        ) {
          updatedConfigLine = configLine.replace(
            /\[CONFIG\]\s*\[SLAVE\]\s*\[(ENABLED|DISABLED)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/,
            '[CONFIG] [SLAVE] [$1] [$2] [$3] [$4] [NULL] [NULL]'
          );
        }
        // Fallback to 7-parameter format (old format)
        else if (
          configLine.match(
            /\[CONFIG\]\s*\[SLAVE\]\s*\[(ENABLED|DISABLED)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/
          )
        ) {
          updatedConfigLine = configLine.replace(
            /\[CONFIG\]\s*\[SLAVE\]\s*\[(ENABLED|DISABLED)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/,
            '[CONFIG] [SLAVE] [$1] [$2] [$3] [$4] [NULL]'
          );
        }

        if (updatedConfigLine !== configLine) {
          lines[configLineIndex] = updatedConfigLine;
          updated = true;
        }
      }
    }

    if (updated) {
      // Write the updated content back to the file
      const updatedContent = lines.join('\n');
      // Ensure we're writing to .csv not .cssv
      const correctPath = csvFilePath.replace(/\.cssv$/, '.csv');
      writeFileSync(correctPath, updatedContent, 'utf8');
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Error updating CSV file ${csvFilePath}:`, error);
    return false;
  }
};
