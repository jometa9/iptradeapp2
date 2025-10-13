import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Helper functions para encoding por plataforma
function detectPlatformFromContent(content) {
  if (content.includes('[CTRADER]')) return 'CTRADER';
  if (content.includes('[MT4]')) return 'MT4';
  if (content.includes('[MT5]')) return 'MT5';
  return 'MT5'; // Default
}

function getEncodingForPlatform(platform) {
  if (platform === 'CTRADER') {
    return { encoding: 'utf8', lineEnding: '\r\n' };
  } else {
    return { encoding: 'latin1', lineEnding: '\r\n' };
  }
}

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
  prefix: '',
  suffix: '',

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

  if (settings.prefix !== undefined) {
    baseConfig.prefix = String(settings.prefix || '');
  }

  if (settings.suffix !== undefined) {
    baseConfig.suffix = String(settings.suffix || '');
  }

  if (settings.translations !== undefined) {
    baseConfig.translations = settings.translations || {};
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

  // Apply slave-specific prefix and suffix to comment (after master transformations)
  if (slaveConfig.prefix || slaveConfig.suffix) {
    const originalComment = transformedData.comment || '';
    transformedData.comment = `${slaveConfig.prefix}${originalComment}${slaveConfig.suffix}`;
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
  let accountFound = false;

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
          accountFound = true;
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n');

          let translations = {};
          
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
                  masterCsvPath: values.length >= 8 && values[7] !== 'NULL' ? values[7] : null,
                  prefix: values.length >= 9 ? values[8] : '',
                  suffix: values.length >= 10 ? values[9] : '',
                  description: '',
                  lastUpdated: new Date().toISOString(),
                };
              }
            } else if (cleanLine.includes('[TRANSLATE]')) {
              // Parse translation mappings
              const matches = cleanLine.match(/\[([^\]]*)\]/g);
              if (matches && matches.length > 1) {
                translations = {};
                for (let i = 1; i < matches.length; i++) {
                  const value = matches[i].replace(/[\[\]]/g, '');
                  if (value !== 'NULL' && value.includes(':')) {
                    const [from, to] = value.split(':');
                    translations[from] = to;
                  }
                }
              }
            }
          }
          
          // Add translations to csvConfig if found
          if (csvConfig) {
            csvConfig.translations = translations;
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

  // Si la cuenta no se encontró en ningún lado, devolver error
  if (!accountFound && !csvConfig) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found in your accounts`,
    });
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
    prefix,
    suffix,
    translations,
  } = req.body;

  if (!slaveAccountId) {
    return res.status(400).json({
      error: 'slaveAccountId is required',
    });
  }

  // Verificar que la cuenta esclava existe (en CSV o en registered_accounts.json)
  let accountExists = false;
  try {
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);

    if (csvManager && csvManager.csvFiles) {
      // Buscar en archivos CSV escaneados
      for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
        const accountFound = fileData.data.some(account => account.account_id === slaveAccountId);
        if (
          accountFound ||
          (existsSync(filePath) && readFileSync(filePath, 'utf8').includes(`[${slaveAccountId}]`))
        ) {
          accountExists = true;
          break;
        }
      }
    }
  } catch (error) {
    console.error(`Error checking if slave account ${slaveAccountId} exists:`, error);
  }

  // Si no se encontró en CSV, verificar en registered_accounts.json
  if (!accountExists) {
    const configs = loadSlaveConfigs();
    accountExists = configs[slaveAccountId] !== undefined;
  }

  if (!accountExists) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found in your accounts`,
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

  if (prefix !== undefined) {
    configs[slaveAccountId].prefix = String(prefix || '');
  }

  if (suffix !== undefined) {
    configs[slaveAccountId].suffix = String(suffix || '');
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

  if (translations !== undefined) {
    configs[slaveAccountId].translations = translations || {};
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
            const prefix = slaveConfig?.prefix ? slaveConfig.prefix : 'NULL';
            const suffix = slaveConfig?.suffix ? slaveConfig.suffix : 'NULL';

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

            const newConfigLine = `[CONFIG] [SLAVE] [${enabled}] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}] [${masterCsvPath}] [${prefix}] [${suffix}]\n`;
            newContent += newConfigLine;

            // Always add TRANSLATE line after CONFIG line
            const translationPairs = Object.entries(slaveConfig?.translations || {})
              .map(([from, to]) => `[${from}:${to}]`)
              .join(' ');
            
            if (translationPairs.length > 0) {
              newContent += `[TRANSLATE] ${translationPairs}\n`;
            } else {
              newContent += `[TRANSLATE] [NULL]\n`;
            }
          } else if (cleanLine.includes('[TRANSLATE]')) {
            // Skip existing TRANSLATE line as we already added it after CONFIG
            continue;
          } else {
            newContent += line + '\n';
          }
        }

        // Detectar plataforma para usar encoding correcto
        const platform = detectPlatformFromContent(newContent);
        const { encoding, lineEnding } = getEncodingForPlatform(platform);
        const formattedContent = newContent.replace(/\n/g, lineEnding);
        // Escribir con encoding específico por plataforma
        writeFileSync(targetFile, formattedContent, encoding);
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
    console.log(`📝 [disconnectAllSlavesFromMaster] Disconnecting all slaves from master ${masterAccountId}`);
    
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

    // Find all slaves connected to this master - usando el enfoque mejorado
    const connectedSlaves = [];

    // Primero escanear los CSV para encontrar todas las conexiones
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      console.log(`📝 [disconnectAllSlavesFromMaster] Scanning file: ${filePath}`);
      
      // Buscar en los datos parseados
      fileData.data.forEach(account => {
        if (account.account_type === 'slave') {
          // Verificar si está conectado a nuestro master en diferentes formatos de configuración
          let isConnectedToMaster = false;
          
          // Verificar en account.config.masterId (formato estándar)
          if (account.config && account.config.masterId === masterAccountId) {
            isConnectedToMaster = true;
          }
          
          // También verificar en las líneas de config sin parsear
          if (!isConnectedToMaster) {
            // Leer el archivo y buscar la conexión
            try {
              const { existsSync, readFileSync } = require('fs');
              if (existsSync(filePath)) {
                const fileContent = readFileSync(filePath, 'utf8');
                const lines = fileContent.split('\n');
                
                // Primero encontrar línea TYPE para esta cuenta
                let foundAccountInFile = false;
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  if (line.includes('[TYPE]') && line.includes(`[${account.account_id}]`)) {
                    foundAccountInFile = true;
                    
                    // Buscar la línea CONFIG cercana
                    if (i + 2 < lines.length) {
                      const configLine = lines[i + 2]; // Típicamente 2 líneas después de TYPE
                      if (configLine.includes('[CONFIG]') && configLine.includes('[SLAVE]') && 
                          configLine.includes(`[${masterAccountId}]`)) {
                        isConnectedToMaster = true;
                        break;
                      }
                    }
                  }
                }
                
                if (foundAccountInFile) {
                  console.log(`📝 [disconnectAllSlavesFromMaster] Found slave ${account.account_id} in file but not connected to master ${masterAccountId}`);
                }
              }
            } catch (fileError) {
              console.error(`Error reading file ${filePath}:`, fileError);
            }
          }
          
          // Si está conectado, agregarlo a la lista
          if (isConnectedToMaster) {
            console.log(`📝 [disconnectAllSlavesFromMaster] Found slave ${account.account_id} connected to master ${masterAccountId}`);
            connectedSlaves.push({
              slaveId: account.account_id,
              filePath: filePath,
            });
          }
        }
      });
    }

    if (connectedSlaves.length === 0) {
      console.log(`📝 [disconnectAllSlavesFromMaster] No slaves found connected to master ${masterAccountId}`);
      return res.json({
        success: true,
        message: `No slaves found connected to master ${masterAccountId}`,
        masterAccountId,
        disconnectedCount: 0,
        totalSlaves: 0,
      });
    }

    console.log(`📝 [disconnectAllSlavesFromMaster] Found ${connectedSlaves.length} slaves connected to master ${masterAccountId}`);

    // Desconectar cada slave
    let successCount = 0;
    for (const { slaveId, filePath } of connectedSlaves) {
      try {
        console.log(`📝 [disconnectAllSlavesFromMaster] Disconnecting slave ${slaveId} from master ${masterAccountId}`);
        if (await updateCSVFileToDisconnectSlave(filePath, slaveId)) {
          successCount++;
          console.log(`📝 [disconnectAllSlavesFromMaster] Successfully disconnected slave ${slaveId}`);
        }
      } catch (error) {
        console.error(`Error disconnecting slave ${slaveId}:`, error);
      }
    }

    console.log(`📝 [disconnectAllSlavesFromMaster] Disconnected ${successCount} out of ${connectedSlaves.length} slaves`);

    // Refrescar el cache de datos
    try {
      await csvManager.refreshAllFileData();
      console.log(`📝 [disconnectAllSlavesFromMaster] Refreshed csvManager data cache`);
    } catch (refreshError) {
      console.error(`Error refreshing CSV data cache:`, refreshError);
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
    console.log(`📝 [updateCSVFileToDisconnectSlave] Attempting to disconnect slave ${slaveAccountId} in file ${csvFilePath}`);
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
    let currentAccountId = null;

    // Procesamos cada línea para encontrar y modificar la configuración del slave
    const updatedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let updatedLine = line;

      // Detectar línea TYPE para identificar la cuenta actual
      if (line.includes('[TYPE]')) {
        const matches = line.match(/\[([^\]]+)\]/g);
        if (matches && matches.length >= 3) {
          // El accountId está en la última posición para el formato CSV2
          const extractedAccountId = matches[matches.length - 1].replace(/[\[\]]/g, '').trim();
          console.log(`📝 [updateCSVFileToDisconnectSlave] Found TYPE line for account: ${extractedAccountId}`);
          
          if (extractedAccountId === slaveAccountId) {
            currentAccountId = extractedAccountId;
            console.log(`📝 [updateCSVFileToDisconnectSlave] Found slave account: ${currentAccountId}`);
          }
        }
      } 
      // Buscar y actualizar línea CONFIG para desconectar el slave
      else if (line.includes('[CONFIG]') && line.includes('[SLAVE]') && currentAccountId === slaveAccountId) {
        console.log(`📝 [updateCSVFileToDisconnectSlave] Found CONFIG line for slave: ${line}`);
        
        // Actualizar la línea CONFIG para quitar el masterId y masterCsvPath (NULL)
        const parts = line.split(']').map(part => part.trim() + ']');
        
        if (parts.length >= 9) { // Formato completo con prefix/suffix
          // [CONFIG] [SLAVE] [ENABLED/DISABLED] [LOT_MULT] [FORCE_LOT] [REVERSE] [MASTER_ID] [MASTER_CSV_PATH] [PREFIX] [SUFFIX]
          const status = parts[2];
          const lotMult = parts[3];
          const forceLot = parts[4];
          const reverse = parts[5];
          const prefix = parts.length > 8 ? parts[8] : '[NULL]';
          const suffix = parts.length > 9 ? parts[9] : '[NULL]';
          
          updatedLine = `[CONFIG] [SLAVE] ${status} ${lotMult} ${forceLot} ${reverse} [NULL] [NULL] ${prefix} ${suffix}`;
          console.log(`📝 [updateCSVFileToDisconnectSlave] Updated CONFIG line: ${updatedLine}`);
          updated = true;
        }
      }
      
      // Agregar la línea actualizada al array
      updatedLines.push(updatedLine);
    }

    if (updated) {
      console.log(`📝 [updateCSVFileToDisconnectSlave] Writing updated content to file`);
      // Write the updated content back to the file
      const updatedContent = updatedLines.join('\n');
      // Ensure we're writing to .csv not .cssv
      const correctPath = csvFilePath.replace(/\.cssv$/, '.csv');
      writeFileSync(correctPath, updatedContent, 'utf8');
      
      // También actualizar el cache interno de csvManager
      try {
        const csvManager = await import('../services/csvManager.js')
          .then(m => m.default)
          .catch(() => null);
          
        if (csvManager && csvManager.csvFiles.has(csvFilePath)) {
          console.log(`📝 [updateCSVFileToDisconnectSlave] Refreshing csvManager cache for file`);
          await csvManager.refreshFileData(csvFilePath);
        }
      } catch (refreshError) {
        console.error('Error refreshing CSV manager cache:', refreshError);
      }
      
      return true;
    } else {
      console.log(`📝 [updateCSVFileToDisconnectSlave] No changes were made to the file`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating CSV file ${csvFilePath}:`, error);
    return false;
  }
};
