import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

import csvManager from '../services/csvManager.js';

// Helper function to find CSV file path for a master account
const findMasterCSVPath = async masterId => {
  try {
    // Use csvManager that's already imported at the top of this file
    if (!csvManager || !csvManager.csvFiles) {
      return null;
    }

    // IMPORTANT: Refresh cache before searching to ensure we have the latest data

    await csvManager.refreshAllFileData();

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

// Generate CSV2 format content for account conversion (WITH SPACES to match bot format)
const generateCSV2Content = async (
  accountId,
  accountType,
  platform,
  timestamp,
  slaveConfig = null
) => {
  const upperType = accountType.toUpperCase();

  let content = `[TYPE] [${platform}] [${accountId}]\n`;
  content += `[STATUS] [ONLINE] [${timestamp}]\n`;

  if (accountType === 'master') {
    // For master accounts: [CONFIG][MASTER][ENABLED/DISABLED][NOMBRE][PREFIX][SUFFIX]
    // Mantener el estado actual si existe, o usar ENABLED por defecto
    const currentStatus =
      slaveConfig?.enabled !== undefined
        ? slaveConfig.enabled
          ? 'ENABLED'
          : 'DISABLED'
        : 'ENABLED';
    const prefix = slaveConfig?.prefix ? slaveConfig.prefix : 'NULL';
    const suffix = slaveConfig?.suffix ? slaveConfig.suffix : 'NULL';
    content += `[CONFIG] [MASTER] [${currentStatus}] [${accountId}] [NULL] [NULL] [NULL] [NULL] [${prefix}] [${suffix}]\n`;
  } else if (accountType === 'slave') {
    // For slave accounts: [CONFIG][SLAVE][ENABLED/DISABLED][LOT_MULT][FORCE_LOT][REVERSE][MASTER_ID][MASTER_CSV_PATH][PREFIX][SUFFIX]
    const lotMultiplier = slaveConfig?.lotCoefficient || 1.0;
    const forceLot = slaveConfig?.forceLot ? slaveConfig.forceLot : 'NULL';
    const reverseTrade = slaveConfig?.reverseTrade ? 'TRUE' : 'FALSE';
    const masterId = slaveConfig?.masterAccountId || 'NULL';
    const prefix = slaveConfig?.prefix || '';
    const suffix = slaveConfig?.suffix || '';

    // Mantener el estado actual si existe, o usar ENABLED por defecto
    const currentStatus =
      slaveConfig?.enabled !== undefined
        ? slaveConfig.enabled
          ? 'ENABLED'
          : 'DISABLED'
        : 'ENABLED';

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

    content += `[CONFIG] [SLAVE] [${currentStatus}] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}] [${masterCsvPath}] [${prefix}] [${suffix}]\n`;
  }

  return content;
};

// Get all CSV pending accounts
export const getPendingCSVAccounts = (req, res) => {
  try {
    const pendingAccounts = csvManager.csvFiles;
    const accountsArray = [];

    pendingAccounts.forEach((data, filePath) => {
      data.data.forEach(row => {
        if (row.account_type === 'pending') {
          accountsArray.push({
            ...row,
            filePath,
          });
        }
      });
    });

    res.json({
      success: true,
      accounts: accountsArray,
      totalPending: accountsArray.length,
    });
  } catch (error) {
    console.error('Error getting pending CSV accounts:', error);
    res.status(500).json({ error: 'Failed to get pending CSV accounts' });
  }
};

// Update CSV account type from pending to master/slave using new CSV2 format
export const updateCSVAccountType = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { newType, slaveConfig, masterConfig } = req.body; // 'master' or 'slave', plus configs
    const apiKey = req.apiKey;



    if (!accountId || !newType) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'accountId and newType are required',
      });
    }

    if (!['master', 'slave'].includes(newType)) {
      return res.status(400).json({
        error: 'Invalid account type',
        message: 'newType must be either "master" or "slave"',
      });
    }

    // Import user accounts management functions
    const { getUserAccounts, saveUserAccounts } = await import('./configManager.js');
    const userAccounts = getUserAccounts(apiKey);

    // Use csvManager to get scanned CSV files
    let filesUpdated = 0;
    const csvFiles = Array.from(csvManager.csvFiles.keys());
    let platform = 'MT4'; // Default platform
    let currentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    // Check if we're converting from master to slave and need to disconnect slaves
    let isConvertingFromMaster = false;
    let slavesToDisconnect = [];

    // First pass: check if the account is currently a master
    for (const filePath of csvFiles) {
      try {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

            // Check if this account is currently a master
            if (
              cleanLine.includes('[TYPE]') &&
              cleanLine.includes('[MASTER]') &&
              cleanLine.includes(`[${accountId}]`)
            ) {
              isConvertingFromMaster = true;
              break;
            }
          }

          if (isConvertingFromMaster) break;
        }
      } catch (error) {
        console.error(`Error checking master status in ${filePath}:`, error);
      }
    }

    // If converting from master to slave, find and disconnect all connected slaves
    if (isConvertingFromMaster && newType === 'slave') {
      for (const filePath of csvFiles) {
        try {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());

            // Find all slave accounts connected to this master
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

              // Check if this is a slave CONFIG line connected to our master
              if (
                cleanLine.includes('[CONFIG]') &&
                cleanLine.includes('[SLAVE]') &&
                cleanLine.includes(`[${accountId}]`)
              ) {
                // Extract slave account ID from the TYPE line (should be a few lines above)
                for (let j = Math.max(0, i - 5); j < i; j++) {
                  const typeLine = lines[j].replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');
                  if (typeLine.includes('[TYPE]') && typeLine.includes('[SLAVE]')) {
                    const matches = typeLine.match(/\[([^\]]+)\]/g);
                    if (matches && matches.length >= 4) {
                      const slaveId = matches[3].replace(/[\[\]]/g, '').trim();
                      if (slaveId && slaveId !== accountId) {
                        slavesToDisconnect.push({ slaveId, filePath });
                      }
                    }
                    break;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error finding slaves in ${filePath}:`, error);
        }
      }
    }

    // Process each file
    for (const filePath of csvFiles) {
      try {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          if (lines.length < 1) {
            continue;
          }

          let foundAccount = false;
          let accountPlatform = 'MT4';



          // Check if this file contains the pending account in the new CSV2 format
          for (const line of lines) {
            // Clean the line from BOM and special characters
            const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

            // Simple check: if the line contains the accountId, this is our file
            if (cleanLine.includes(`[${accountId}]`) || cleanLine.includes(accountId)) {
              // Extract platform from the line
              const matches = cleanLine.match(/\[([^\]]+)\]/g);
              if (matches && matches.length >= 3) {
                const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());

                // Find platform (usually the second or third bracket)
                accountPlatform = values.find(v => ['MT4', 'MT5', 'CTRADER'].includes(v)) || 'MT4';
                foundAccount = true;
                break;
              }
            }

            // Check for [TYPE][PLATFORM][ACCOUNT_ID] format
            if (cleanLine.includes('[TYPE]')) {
              const matches = cleanLine.match(/\[([^\]]+)\]/g);
              if (matches && matches.length >= 3) {
                const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());

                if (values[2] === accountId) {
                  foundAccount = true;
                  accountPlatform = values[1] || 'MT4';
                  break;
                }
              }
            }
            // Also check for old format for backward compatibility
            else if (line.includes('[') && line.includes(']')) {
              const matches = line.match(/\[([^\]]+)\]/g);
              if (matches && matches.length >= 5) {
                const values = matches.map(m => m.replace(/[\[\]]/g, ''));
                if (values[0] === '0' && values[1] === accountId) {
                  foundAccount = true;
                  accountPlatform = values[2] || 'MT4';
                  break;
                }
              }
            }
          }

          if (foundAccount) {
            // Simple approach: just update the CONFIG line, bot will update TYPE
            const fileContent = readFileSync(filePath, 'utf8');
            const lines = fileContent.split('\n');
            const currentTimestamp = Math.floor(Date.now() / 1000);

            let newContent = '';
            let translateLineAdded = false; // Track if we've added the TRANSLATE line
            
            for (const line of lines) {
              const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

              // Update TYPE line if it contains the account
              if (
                cleanLine.includes('[TYPE]') &&
                (cleanLine.includes(`[${accountId}]`) || cleanLine.includes(accountId))
              ) {
                newContent += `[TYPE] [${accountPlatform}] [${accountId}]\n`;
              } else if (
                cleanLine.includes('[CONFIG]') &&
                (cleanLine.includes(`[${accountId}]`) ||
                  cleanLine.includes(accountId) ||
                  cleanLine.includes(`Account ${accountId}`) ||
                  cleanLine.includes('[PENDING]') ||
                  cleanLine.includes('PENDING'))
              ) {
                // Preserve the current ENABLED/DISABLED status
                const enabledMatch = cleanLine.match(/\[(ENABLED|DISABLED)\]/);
                const currentStatus = enabledMatch ? enabledMatch[1] : 'DISABLED';

                if (newType === 'master') {
                  const prefix = masterConfig?.prefix ? masterConfig.prefix : 'NULL';
                  const suffix = masterConfig?.suffix ? masterConfig.suffix : 'NULL';

                  newContent += `[CONFIG] [MASTER] [${currentStatus}] [${accountId}] [NULL] [NULL] [NULL] [NULL] [${prefix}] [${suffix}]\n`;
                  
                  // Add TRANSLATE line for master accounts
                  if (masterConfig?.translations && Object.keys(masterConfig.translations).length > 0) {
                    const translationPairs = Object.entries(masterConfig.translations)
                      .map(([from, to]) => `[${from}:${to}]`)
                      .join(' ');
                    newContent += `[TRANSLATE] ${translationPairs}\n`;
                    translateLineAdded = true;
                  } else {
                    newContent += `[TRANSLATE] [NULL]\n`;
                    translateLineAdded = true;
                  }
                } else if (newType === 'slave') {
                  // Generate slave config with provided settings
                  const lotMultiplier = slaveConfig?.lotCoefficient || 1.0;
                  const forceLot = slaveConfig?.forceLot ? slaveConfig.forceLot : 'NULL';
                  const reverseTrade = slaveConfig?.reverseTrade ? 'TRUE' : 'FALSE';
                  const masterId = slaveConfig?.masterAccountId || 'NULL';
                  const prefix = slaveConfig?.prefix ? slaveConfig.prefix : 'NULL';
                  const suffix = slaveConfig?.suffix ? slaveConfig.suffix : 'NULL';

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

                  newContent += `[CONFIG] [SLAVE] [${currentStatus}] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}] [${masterCsvPath}] [${prefix}] [${suffix}]\n`;
                  
                  // Add TRANSLATE line for slave accounts
                  if (slaveConfig?.translations && Object.keys(slaveConfig.translations).length > 0) {
                    const translationPairs = Object.entries(slaveConfig.translations)
                      .map(([from, to]) => `[${from}:${to}]`)
                      .join(' ');
                    newContent += `[TRANSLATE] ${translationPairs}\n`;
                    translateLineAdded = true;
                  } else {
                    newContent += `[TRANSLATE] [NULL]\n`;
                    translateLineAdded = true;
                  }
                }
              } else if (cleanLine.includes('[TRANSLATE]')) {
                // Skip existing TRANSLATE line as we already added it after CONFIG
                continue;
              } else if (cleanLine.includes('[STATUS]')) {
                // Update timestamp
                newContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
              } else {
                newContent += line + '\n';
              }
            }

            // Ensure we're writing to .csv not .cssv
            const correctPath = filePath.replace(/\.cssv$/, '.csv');
            

            
            writeFileSync(correctPath, newContent.replace(/\r\n/g, '\n'), 'utf8');
            filesUpdated++;

            // IMPORTANT: Immediately refresh cache for this specific file to ensure latest data
            if (csvManager.csvFiles.has(filePath)) {
              csvManager.csvFiles.set(filePath, {
                lastModified: csvManager.getFileLastModified(filePath),
                data: csvManager.parseCSVFile(filePath),
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    if (filesUpdated > 0) {
      // If converting from master to slave, disconnect all connected slaves
      if (isConvertingFromMaster && newType === 'slave' && slavesToDisconnect.length > 0) {
        for (const { slaveId, filePath } of slavesToDisconnect) {
          try {
            if (existsSync(filePath)) {
              const content = readFileSync(filePath, 'utf8');
              const lines = content.split('\n');
              let newContent = '';
              let slaveFound = false;

              for (const line of lines) {
                const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');

                // Check if this is the CONFIG line for the slave we want to disconnect
                if (
                  cleanLine.includes('[CONFIG]') &&
                  cleanLine.includes('[SLAVE]') &&
                  cleanLine.includes(`[${accountId}]`)
                ) {
                  // This is a slave connected to our master, disconnect it
                  const matches = cleanLine.match(/\[([^\]]+)\]/g) || [];
                  const lotMultiplier = matches[3] ? matches[3].replace(/[\[\]]/g, '') : '1.0';
                  const forceLot = matches[4] ? matches[4].replace(/[\[\]]/g, '') : 'NULL';
                  const reverseTrade = matches[5] ? matches[5].replace(/[\[\]]/g, '') : 'FALSE';

                  // Set masterId and masterCsvPath to NULL to disconnect (8-parameter format)
                  newContent += `[CONFIG] [SLAVE] [DISABLED] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [NULL] [NULL]\n`;
                  slaveFound = true;
                } else if (cleanLine.includes('[STATUS]')) {
                  // Update timestamp for the slave
                  newContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
                } else {
                  newContent += line + '\n';
                }
              }

              if (slaveFound) {
                // Ensure we're writing to .csv not .cssv
                const correctPath = filePath.replace(/\.cssv$/, '.csv');
                writeFileSync(correctPath, newContent.replace(/\r\n/g, '\n'), 'utf8');
              }
            }
          } catch (error) {
            console.error(`Error disconnecting slave ${slaveId}:`, error);
          }
        }
      }

      // Update user accounts database to reflect the conversion

      let accountMoved = false;

      if (newType === 'master') {
        // Move from pending/slave to master
        if (userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId]) {
          // Move from pending to master
          const pendingAccount = userAccounts.pendingAccounts[accountId];
          const masterAccount = {
            id: accountId,
            name: pendingAccount.name || accountId,
            description: pendingAccount.description || '',
            broker: pendingAccount.broker || 'Unknown',
            platform: pendingAccount.platform || 'MT5',
            registeredAt: new Date().toISOString(),
            convertedFrom: 'pending',
            firstSeen: pendingAccount.firstSeen,
            lastActivity: pendingAccount.lastActivity || new Date().toISOString(),
            status: 'active',
          };

          if (!userAccounts.masterAccounts) userAccounts.masterAccounts = {};
          userAccounts.masterAccounts[accountId] = masterAccount;
          delete userAccounts.pendingAccounts[accountId];

          // Remove from slave accounts if it was there
          if (userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId]) {
            delete userAccounts.slaveAccounts[accountId];
            // Remove connection if it exists
            if (userAccounts.connections && userAccounts.connections[accountId]) {
              delete userAccounts.connections[accountId];
            }
          }

          accountMoved = true;
        } else if (userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId]) {
          // Move from slave to master
          const slaveAccount = userAccounts.slaveAccounts[accountId];
          const masterAccount = {
            id: accountId,
            name: slaveAccount.name || accountId,
            description: slaveAccount.description || '',
            broker: slaveAccount.broker || 'Unknown',
            platform: slaveAccount.platform || 'MT5',
            registeredAt: new Date().toISOString(),
            convertedFrom: 'slave',
            firstSeen: slaveAccount.firstSeen,
            lastActivity: slaveAccount.lastActivity || new Date().toISOString(),
            status: 'active',
          };

          if (!userAccounts.masterAccounts) userAccounts.masterAccounts = {};
          userAccounts.masterAccounts[accountId] = masterAccount;
          delete userAccounts.slaveAccounts[accountId];

          // Remove connection if it exists
          if (userAccounts.connections && userAccounts.connections[accountId]) {
            delete userAccounts.connections[accountId];
          }

          accountMoved = true;
        }
      } else if (newType === 'slave') {
        // Move from pending/master to slave
        if (userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId]) {
          // Move from pending to slave
          const pendingAccount = userAccounts.pendingAccounts[accountId];
          const slaveAccount = {
            id: accountId,
            name: pendingAccount.name || accountId,
            description: pendingAccount.description || '',
            broker: pendingAccount.broker || 'Unknown',
            platform: pendingAccount.platform || 'MT5',
            registeredAt: new Date().toISOString(),
            convertedFrom: 'pending',
            firstSeen: pendingAccount.firstSeen,
            lastActivity: pendingAccount.lastActivity || new Date().toISOString(),
            status: 'active',
          };

          if (!userAccounts.slaveAccounts) userAccounts.slaveAccounts = {};
          userAccounts.slaveAccounts[accountId] = slaveAccount;
          delete userAccounts.pendingAccounts[accountId];

          // Add connection if masterId is provided
          if (slaveConfig?.masterAccountId && slaveConfig.masterAccountId !== 'NULL') {
            if (!userAccounts.connections) userAccounts.connections = {};
            userAccounts.connections[accountId] = slaveConfig.masterAccountId;
          }

          // Create slave configuration with the provided settings
          const { createSlaveConfigWithSettings } = await import('./slaveConfigController.js');
          createSlaveConfigWithSettings(accountId, {
            masterAccountId: slaveConfig?.masterAccountId || null,
            lotCoefficient: slaveConfig?.lotCoefficient || 1.0,
            forceLot: slaveConfig?.forceLot || null,
            reverseTrade: slaveConfig?.reverseTrade || false,
            prefix: slaveConfig?.prefix || '',
            suffix: slaveConfig?.suffix || '',
            translations: slaveConfig?.translations || {},
          });

          accountMoved = true;
        } else if (userAccounts.masterAccounts && userAccounts.masterAccounts[accountId]) {
          // Move from master to slave
          const masterAccount = userAccounts.masterAccounts[accountId];
          const slaveAccount = {
            id: accountId,
            name: masterAccount.name || accountId,
            description: masterAccount.description || '',
            broker: masterAccount.broker || 'Unknown',
            platform: masterAccount.platform || 'MT5',
            registeredAt: new Date().toISOString(),
            convertedFrom: 'master',
            firstSeen: masterAccount.firstSeen,
            lastActivity: masterAccount.lastActivity || new Date().toISOString(),
            status: 'active',
          };

          if (!userAccounts.slaveAccounts) userAccounts.slaveAccounts = {};
          userAccounts.slaveAccounts[accountId] = slaveAccount;
          delete userAccounts.masterAccounts[accountId];

          // Add connection if masterId is provided
          if (slaveConfig?.masterAccountId && slaveConfig.masterAccountId !== 'NULL') {
            if (!userAccounts.connections) userAccounts.connections = {};
            userAccounts.connections[accountId] = slaveConfig.masterAccountId;
          }

          // Create slave configuration with the provided settings
          const { createSlaveConfigWithSettings } = await import('./slaveConfigController.js');
          createSlaveConfigWithSettings(accountId, {
            masterAccountId: slaveConfig?.masterAccountId || null,
            lotCoefficient: slaveConfig?.lotCoefficient || 1.0,
            forceLot: slaveConfig?.forceLot || null,
            reverseTrade: slaveConfig?.reverseTrade || false,
            prefix: slaveConfig?.prefix || '',
            suffix: slaveConfig?.suffix || '',
            translations: slaveConfig?.translations || {},
          });

          accountMoved = true;
        }
      }

      // Save user accounts if any changes were made
      if (accountMoved) {
        saveUserAccounts(apiKey, userAccounts);
      }

      // Refresh CSV data from existing files (no new search)
      await csvManager.refreshAllFileData();

      // Emit SSE event to notify frontend of account conversion
      csvManager.emit('accountConverted', {
        accountId: accountId,
        newType: newType,
        platform: platform,
        status: 'online', // La cuenta está online cuando se convierte
        apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
        timestamp: new Date().toISOString(),
      });

      const disconnectMessage =
        isConvertingFromMaster && newType === 'slave' && slavesToDisconnect.length > 0
          ? ` and disconnected ${slavesToDisconnect.length} slave(s)`
          : '';

      res.json({
        success: true,
        message: `Successfully updated account ${accountId} to ${newType}${disconnectMessage} and registered in configured accounts system`,
        filesUpdated,
        accountRegistered: true,
        accountMovedInDatabase: accountMoved,
        slavesDisconnected:
          isConvertingFromMaster && newType === 'slave' ? slavesToDisconnect.length : 0,
      });
    } else {
      res.status(404).json({
        error: 'Account not found',
        message: `No account with ID ${accountId} found in CSV files`,
      });
    }
  } catch (error) {
    console.error('Error updating CSV account type:', error);
    res.status(500).json({
      error: 'Failed to update CSV account type',
      details: error.message,
    });
  }
};

// Delete pending account from CSV files
export const deletePendingFromCSV = async (req, res) => {
  try {
    const { accountId } = req.params;
    const apiKey = req.apiKey;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Buscar todos los archivos IPTRADECSV2.csv que contienen esta cuenta
    const patterns = [
      '**/IPTRADECSV2.csv',
      '**/csv_data/**/IPTRADECSV2.csv',
      '**/accounts/**/IPTRADECSV2.csv',
    ];

    let deletedFromFiles = 0;
    const allFiles = [];

    // Encontrar archivos
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/.git/**'],
          absolute: true,
        });
        allFiles.push(...files);
      } catch (error) {
        console.error(`Error searching pattern ${pattern}:`, error);
      }
    }

    // Procesar cada archivo para eliminar la cuenta
    for (const filePath of allFiles) {
      try {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          if (lines.length < 2) continue;

          // Verificar si es el nuevo formato simplificado [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
          const firstDataLine = lines[1]; // Primera línea de datos
          const firstValues = firstDataLine.split(',').map(v => v.trim());

          let modified = false;
          let filteredLines = [];

          if (firstValues[0] === '0' && firstValues.length >= 5) {
            // Nuevo formato simplificado - no hay header

            for (let i = 0; i < lines.length; i++) {
              const lineValues = lines[i].split(',').map(v => v.trim());

              // Verificar formato: [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
              if (lineValues[0] === '0' && lineValues.length >= 5) {
                if (lineValues[1] === accountId) {
                  modified = true;
                  // No agregar esta línea (eliminar)
                } else {
                  filteredLines.push(lines[i]);
                }
              } else {
                // Mantener líneas que no siguen el formato esperado
                filteredLines.push(lines[i]);
              }
            }
          } else {
            // Formato anterior con headers
            const headers = lines[0].split(',').map(h => h.trim());
            const expectedHeaders = ['timestamp', 'account_id', 'account_type', 'platform'];
            const isSimplifiedFormat = expectedHeaders.every(h => headers.includes(h));

            if (!isSimplifiedFormat) continue;

            filteredLines = [headers.join(',')]; // Mantener header

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              const accountIdIndex = headers.indexOf('account_id');

              if (accountIdIndex >= 0 && values[accountIdIndex] === accountId) {
                modified = true;
                // No agregar esta línea (eliminar)
              } else {
                filteredLines.push(lines[i]);
              }
            }
          }

          if (modified) {
            // Escribir el archivo actualizado
            // Ensure we're writing to .csv not .cssv
            const correctPath = filePath.replace(/\.cssv$/, '.csv');
            writeFileSync(correctPath, filteredLines.join('\n'));
            deletedFromFiles++;
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    // Trigger a scan update only if there are CSV files to scan
    if (csvManager.csvFiles.size > 0) {
      await csvManager.scanAndEmitPendingUpdates();
    }

    if (deletedFromFiles > 0) {
      res.json({
        success: true,
        message: `Account ${accountId} deleted from ${deletedFromFiles} CSV file(s)`,
        filesModified: deletedFromFiles,
      });
    } else {
      res.status(404).json({
        error: 'Account not found',
        message: `Account ${accountId} not found in any CSV files`,
      });
    }
  } catch (error) {
    console.error('Error deleting pending account from CSV:', error);
    res.status(500).json({ error: 'Failed to delete pending account from CSV' });
  }
};

// Nuevo endpoint simplificado para pending accounts
export const scanPendingAccounts = async (req, res) => {
  try {
    // Usar getAllActiveAccounts que parsea correctamente el nuevo formato
    const allAccounts = await csvManager.getAllActiveAccounts();
    const pendingAccounts = allAccounts.pendingAccounts || [];

    // Agrupar por plataforma
    const platformStats = {};
    pendingAccounts.forEach(account => {
      const platform = account.platform || 'Unknown';
      const status = account.current_status || account.status || 'offline';

      if (!platformStats[platform]) {
        platformStats[platform] = { online: 0, offline: 0, total: 0 };
      }
      platformStats[platform][status]++;
      platformStats[platform].total++;
    });

    const response = {
      success: true,
      message: `Found ${pendingAccounts.length} pending accounts`,
      accounts: pendingAccounts,
      summary: {
        totalAccounts: pendingAccounts.length,
        onlineAccounts: pendingAccounts.filter(a => (a.current_status || a.status) === 'online')
          .length,
        offlineAccounts: pendingAccounts.filter(a => (a.current_status || a.status) === 'offline')
          .length,
        platformStats,
      },
      platforms: Object.keys(platformStats),
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error scanning pending accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan pending accounts',
      details: error.message,
    });
  }
};

// Conectar plataformas - Escaneo completo del sistema y registro automático (método original)
export const connectPlatforms = async (req, res) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const userAccounts = getUserAccounts(apiKey);
    const previousCount = csvManager.csvFiles.size;

    // Primero obtener las cuentas cacheadas
    const cachedAccounts = await csvManager.getAllActiveAccounts();

    // Usar archivos ya cargados (no hacer búsqueda completa)
    const files = Array.from(csvManager.csvFiles.keys());

    // Guardar explícitamente el cache de CSV si hay archivos
    if (csvManager.csvFiles.size > 0) {
      csvManager.saveCSVPathsToCache();
    }

    const newCount = csvManager.csvFiles.size;
    const foundFiles = newCount - previousCount;

    // Registrar automáticamente cuentas unknown como pending
    let registeredCount = 0;
    csvManager.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach(row => {
        if (row.account_id && row.account_type === 'pending' && row.status === 'online') {
          const accountId = row.account_id;
          const platform = row.platform || 'Unknown';

          // Verificar si ya existe en algún lado
          const isPending = userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId];
          const isMaster = userAccounts.masterAccounts && userAccounts.masterAccounts[accountId];
          const isSlave = userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId];

          if (!isPending && !isMaster && !isSlave) {
            const pendingAccount = {
              id: accountId,
              name: `Account ${accountId}`,
              platform: platform,
              status: 'online',
              balance: parseFloat(row.balance) || 0,
              equity: parseFloat(row.equity) || 0,
              margin: parseFloat(row.margin) || 0,
              freeMargin: parseFloat(row.free_margin) || 0,
              server: row.server || 'Unknown',
              currency: row.currency || 'USD',
              leverage: row.leverage || '1:100',
              company: row.company || platform,
              createdAt: new Date().toISOString(),
              source: 'auto_detected',
            };

            if (!userAccounts.pendingAccounts) {
              userAccounts.pendingAccounts = {};
            }
            userAccounts.pendingAccounts[accountId] = pendingAccount;
            registeredCount++;
          }
        }
      });
    });

    // Guardar cambios si se registraron cuentas
    if (registeredCount > 0) {
      saveUserAccounts(apiKey, userAccounts);

      // Asegurar que se guarde el cache de CSV después de registrar nuevas cuentas
      csvManager.saveCSVPathsToCache();
    }

    // Obtener estadísticas actualizadas
    const allAccounts = await csvManager.getAllActiveAccounts();
    const platformStats = {};

    // Contar cuentas detectadas en CSV por plataforma
    allAccounts.forEach(account => {
      const platform = account.platform || 'Unknown';
      if (!platformStats[platform]) {
        platformStats[platform] = {
          total: 0,
          online: 0,
          offline: 0,
          platforms: {},
        };
      }
      platformStats[platform].total++;
      if (account.status === 'online') {
        platformStats[platform].online++;
      } else {
        platformStats[platform].offline++;
      }
    });

    // Respuesta con estadísticas mejoradas y cuentas cacheadas
    const response = {
      success: true,
      message: `Platform scan completed. Found ${newCount} CSV files (${foundFiles} new)`,
      cachedAccounts: {
        pendingAccounts: cachedAccounts.pendingAccounts || [],
        masterAccounts: cachedAccounts.masterAccounts || {},
        slaveAccounts: cachedAccounts.slaveAccounts || {},
        unconnectedSlaves: cachedAccounts.unconnectedSlaves || [],
      },
      statistics: {
        csvFiles: {
          total: newCount,
          new: foundFiles,
          previousCount: previousCount,
        },
        accounts: {
          totalDetected: allAccounts.length,
          newlyRegistered: registeredCount,
          cachedPending: cachedAccounts.pendingAccounts?.length || 0,
        },
        platforms: platformStats,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error in connectPlatforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect platforms',
      message: error.message,
    });
  }
};

// Escanear cuentas de plataforma - Método más simple que solo escanea
export const scanPlatformAccounts = async (req, res) => {
  try {
    const previousCount = csvManager.csvFiles.size;

    // Refresh data from existing files (no new search)
    await csvManager.refreshAllFileData();

    const newCount = csvManager.csvFiles.size;
    const allAccounts = await csvManager.getAllActiveAccounts();

    res.json({
      success: true,
      message: 'Platform scan completed',
      filesFound: newCount,
      newFiles: newCount - previousCount,
      totalAccounts: allAccounts.length,
      accounts: allAccounts,
    });
  } catch (error) {
    console.error('❌ Error scanning platform accounts:', error);
    res.status(500).json({ error: 'Failed to scan platform accounts' });
  }
};

// Registrar cuentas CSV como pending accounts
export const registerCSVAsPending = (req, res) => {
  try {
    const apiKey = req.apiKey; // Set by requireValidSubscription middleware
    if (!apiKey) {
      return res
        .status(401)
        .json({ error: 'API Key required - use requireValidSubscription middleware' });
    }

    const userAccounts = getUserAccounts(apiKey);
    let registeredCount = 0;

    // Procesar todos los archivos CSV
    csvManager.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach(row => {
        if (row.account_id && row.account_type === 'pending' && row.status === 'online') {
          const accountId = row.account_id;
          const platform = row.platform || 'Unknown';

          // Verificar si ya existe como pending, master o slave
          const isPending = userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId];
          const isMaster = userAccounts.masterAccounts && userAccounts.masterAccounts[accountId];
          const isSlave = userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId];

          if (!isPending && !isMaster && !isSlave) {
            // Crear pending account
            const pendingAccount = {
              id: accountId,
              name: accountId,
              platform: platform,
              status: 'online',
              firstSeen: row.timestamp,
              lastActivity: row.timestamp,
              description: `Auto-detected ${platform} account`,
              broker: 'Unknown',
            };

            // Agregar a pending accounts
            if (!userAccounts.pendingAccounts) {
              userAccounts.pendingAccounts = {};
            }
            userAccounts.pendingAccounts[accountId] = pendingAccount;
            registeredCount++;
          }
        }
      });
    });

    // Guardar cambios
    if (registeredCount > 0) {
      saveUserAccounts(apiKey, userAccounts);
    }

    res.json({
      success: true,
      message: `Registered ${registeredCount} CSV accounts as pending`,
      registeredCount,
    });
  } catch (error) {
    console.error('Error registering CSV accounts as pending:', error);
    res.status(500).json({ error: 'Failed to register CSV accounts' });
  }
};
