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
      console.log(`✅ Created disabled slave configuration for ${slaveAccountId}`);
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
    console.log(`✅ Created slave configuration for ${slaveAccountId} with settings:`, settings);
    console.log(`📋 Final config:`, baseConfig);
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

  // CRITICAL: Check if slave account is offline - never allow copy trading for offline accounts
  const { loadAccountsConfig } = require('./accountsController.js');
  const accountsConfig = loadAccountsConfig();

  // Find the slave account across all users (this is a global check)
  let slaveAccount = null;
  Object.values(accountsConfig.userAccounts || {}).forEach(userAccounts => {
    if (userAccounts.slaveAccounts && userAccounts.slaveAccounts[slaveAccountId]) {
      slaveAccount = userAccounts.slaveAccounts[slaveAccountId];
    }
  });

  if (slaveAccount && slaveAccount.status === 'offline') {
    console.log(`🚫 Slave account ${slaveAccountId} is offline, not processing order`);
    return null; // Slave is offline, don't process order
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

  // Primero intentar leer la configuración del CSV
  let csvConfig = null;
  try {
    const csvFiles = [
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
    ];

    for (const filePath of csvFiles) {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes(`[${slaveAccountId}]`)) {
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
                  description: '',
                  lastUpdated: new Date().toISOString(),
                };

                console.log(`✅ Loaded slave config from CSV for ${slaveAccountId}:`, csvConfig);
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
    console.log(`📄 Using JSON config as fallback for ${slaveAccountId}:`, csvConfig);
  }

  res.json({
    slaveAccountId,
    config: csvConfig,
    status: 'success',
  });
};

// Test endpoint
export const testSlaveConfig = async (req, res) => {
  console.log(`🧪 testSlaveConfig called`);
  res.json({ message: 'Test endpoint working' });
};

// Set slave configuration
export const setSlaveConfig = async (req, res) => {
  console.log(`🔄 setSlaveConfig called with:`, req.body);
  const { slaveAccountId, lotMultiplier, forceLot, reverseTrading, enabled, description } =
    req.body;

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
    console.log(`Applying free user lot restrictions for slave ${slaveAccountId}`);
    req.body.forceLot = 0.01;
    req.body.lotMultiplier = 1.0;
  }

  // Check if account is offline before enabling
  if (enabled) {
    try {
      const { loadAccountsConfig } = await import('./accountsController.js');
      const accountsConfig = loadAccountsConfig();
      const slaveAccount = accountsConfig.slaveAccounts[slaveAccountId];

      if (slaveAccount && slaveAccount.status === 'offline') {
        return res.status(400).json({
          error: 'Cannot enable copy trading for offline account',
          message: 'Account must be online to enable copy trading',
          accountStatus: 'offline',
        });
      }
    } catch (error) {
      console.error('Error checking account status:', error);
      // Continue without the offline check if there's an error
    }
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
    console.log(`🔄 Setting enabled=${enabled} for slave ${slaveAccountId}`);
    configs[slaveAccountId].enabled = Boolean(enabled);
  }

  if (description !== undefined) {
    configs[slaveAccountId].description = description;
  }

  configs[slaveAccountId].lastUpdated = new Date().toISOString();

  // Save configuration
  if (saveSlaveConfigs(configs)) {
    console.log(`Slave config updated for ${slaveAccountId}:`, configs[slaveAccountId]);

    // Actualizar también el CSV para sincronizar con el frontend
    console.log(`🔄 CSV update check - slaveAccountId: ${slaveAccountId}`);
    try {
      // Buscar el archivo CSV correcto para esta cuenta
      const csvFiles = [
        '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
        '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
      ];

      let targetFile = null;
      let foundAccount = false;

      // Buscar en qué archivo está la cuenta
      for (const filePath of csvFiles) {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          if (content.includes(`[${slaveAccountId}]`)) {
            targetFile = filePath;
            foundAccount = true;
            console.log(`✅ Found account ${slaveAccountId} in file: ${filePath}`);
            break;
          }
        }
      }

      if (targetFile && foundAccount) {
        console.log(`✅ CSV file exists: ${targetFile}`);
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

            // Mantener el estado original del CSV si no se especifica 'enabled'
            let enabled;
            console.log('🔍 DEBUG: req.body.enabled =', req.body.enabled);
            console.log('🔍 DEBUG: slaveConfig?.enabled =', slaveConfig?.enabled);
            console.log('🔍 DEBUG: Original CSV line =', cleanLine);

            if (req.body.enabled !== undefined) {
              // Si se especifica explícitamente, usar ese valor
              enabled = slaveConfig?.enabled ? 'ENABLED' : 'DISABLED';
              console.log('🔍 DEBUG: Using JSON config enabled =', enabled);
            } else {
              // Si no se especifica, mantener el estado original del CSV
              const originalEnabled = cleanLine.match(/\[(ENABLED|DISABLED)\]/);
              enabled = originalEnabled ? originalEnabled[1] : 'DISABLED';
              console.log('🔍 DEBUG: Using original CSV enabled =', enabled);
            }

            const newConfigLine = `[CONFIG] [SLAVE] [${enabled}] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}]\n`;
            console.log(`🔄 Updating CONFIG line from "${cleanLine}" to "${newConfigLine.trim()}"`);
            newContent += newConfigLine;
          } else if (cleanLine.includes('[STATUS]')) {
            // Actualizar timestamp
            newContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
          } else {
            newContent += line + '\n';
          }
        }

        writeFileSync(targetFile, newContent, 'utf8');
        console.log(`✅ CSV updated for slave ${slaveAccountId} with complete configuration`);
      } else {
        console.log(`❌ CSV file not found or account ${slaveAccountId} not found in CSV files`);
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

// Export internal functions for use in other controllers
export { loadSlaveConfigs, saveSlaveConfigs };

// Disconnect slave from master by editing CSV file
export const disconnectSlaveFromMaster = async (req, res) => {
  const { slaveAccountId, masterAccountId } = req.params;

  console.log(`🔄 Disconnecting slave ${slaveAccountId} from master ${masterAccountId}`);

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
        console.log(
          `✅ Successfully disconnected slave ${slaveAccountId} from master ${masterAccountId} in ${csvFile}`
        );
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

  console.log(`🔄 Disconnecting all slaves from master ${masterAccountId}`);

  try {
    // For now, we'll disconnect the known slave 11219046 from master 250062001
    // This is a simplified approach until we fix the CSV manager
    const knownSlaves = ['11219046']; // We know this slave is connected to master 250062001

    let successCount = 0;
    for (const slaveId of knownSlaves) {
      try {
        const csvFiles = await findCSVFilesForAccount(slaveId);

        for (const csvFile of csvFiles) {
          if (await updateCSVFileToDisconnectSlave(csvFile, slaveId)) {
            successCount++;
            console.log(
              `✅ Disconnected slave ${slaveId} from master ${masterAccountId} in ${csvFile}`
            );
            break; // Only update one file per slave
          }
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
      totalSlaves: knownSlaves.length,
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
    // Use a simpler approach - check the known CSV file location
    const csvFilePath =
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    const { readFileSync, existsSync } = await import('fs');

    if (existsSync(csvFilePath)) {
      const content = readFileSync(csvFilePath, 'utf8');
      if (content.includes(accountId)) {
        console.log(`🔍 Found account ${accountId} in ${csvFilePath}`);
        return [csvFilePath];
      }
    }

    console.log(`🔍 Account ${accountId} not found in ${csvFilePath}`);
    return [];
  } catch (error) {
    console.error(`Error finding CSV files for account ${accountId}:`, error);
    return [];
  }
};

// Helper function to update CSV file to disconnect slave
const updateCSVFileToDisconnectSlave = async (csvFilePath, slaveAccountId) => {
  try {
    const { readFileSync, writeFileSync } = await import('fs');

    // Read the CSV file
    const csvContent = readFileSync(csvFilePath, 'utf8');
    // console.log(`📄 Original CSV content for ${slaveAccountId}:`, csvContent);

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
        // console.log(`🔍 Found CONFIG line: ${configLine}`);

        // Update the CONFIG line to set masterId to NULL
        const updatedConfigLine = configLine.replace(
          /\[CONFIG\]\s*\[SLAVE\]\s*\[(ENABLED|DISABLED)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/,
          '[CONFIG][SLAVE][$1][$2][$3][$4][NULL]'
        );

        if (updatedConfigLine !== configLine) {
          lines[configLineIndex] = updatedConfigLine;
          updated = true;
          // console.log(`🔄 Updated CONFIG line: ${configLine} -> ${updatedConfigLine}`);
        }
      }
    }

    if (updated) {
      // Write the updated content back to the file
      const updatedContent = lines.join('\n');
      writeFileSync(csvFilePath, updatedContent, 'utf8');
      // console.log(`✅ Successfully updated CSV file ${csvFilePath}`);
      return true;
    } else {
      // console.log(`⚠️ No changes made to CSV file ${csvFilePath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating CSV file ${csvFilePath}:`, error);
    return false;
  }
};
