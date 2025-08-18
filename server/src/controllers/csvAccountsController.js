import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

import csvManager from '../services/csvManager.js';

// Generate CSV2 format content for account conversion (WITH SPACES to match bot format)
const generateCSV2Content = (accountId, accountType, platform, timestamp, slaveConfig = null) => {
  const upperType = accountType.toUpperCase();

  let content = `[TYPE] [${upperType}] [${platform}] [${accountId}]\n`;
  content += `[STATUS] [ONLINE] [${timestamp}]\n`;

  if (accountType === 'master') {
    // For master accounts: [CONFIG][MASTER][ENABLED/DISABLED][NOMBRE]
    content += `[CONFIG] [MASTER] [DISABLED] [Account ${accountId}]\n`;
  } else if (accountType === 'slave') {
    // For slave accounts: [CONFIG][SLAVE][ENABLED/DISABLED][LOT_MULT][FORCE_LOT][REVERSE][MASTER_ID]
    const lotMultiplier = slaveConfig?.lotCoefficient || 1.0;
    const forceLot = slaveConfig?.forceLot ? slaveConfig.forceLot : 'FALSE';
    const reverseTrade = slaveConfig?.reverseTrade ? 'TRUE' : 'FALSE';
    const masterId = slaveConfig?.masterAccountId || 'NULL';

    content += `[CONFIG] [SLAVE] [DISABLED] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}]\n`;
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
  console.log('🚀 updateCSVAccountType called with:', {
    accountId: req.params.accountId,
    newType: req.body.newType,
    slaveConfig: req.body.slaveConfig,
  });
  try {
    const { accountId } = req.params;
    const { newType, slaveConfig } = req.body; // 'master' or 'slave', plus slave configs
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

    console.log(
      `🔄 Updating CSV account ${accountId} from pending to ${newType} using new CSV2 format...`
    );

    // Use cached CSV files from csvManager instead of hardcoded paths
    let filesUpdated = 0;
    const allFiles = Array.from(csvManager.csvFiles.keys());
    let platform = 'MT4'; // Default platform
    let currentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    console.log(`📁 Found ${allFiles.length} CSV files to check`);
    console.log('📁 Files found:', allFiles);

    // Process each file
    for (const filePath of allFiles) {
      try {
        console.log(`🔍 Checking file: ${filePath}`);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          console.log(`📄 File has ${lines.length} lines`);

          if (lines.length < 1) {
            console.log('⚠️ File is empty, skipping');
            continue;
          }

          let foundAccount = false;
          let accountPlatform = 'MT4';

          // Check if this file contains the pending account in the new CSV2 format
          for (const line of lines) {
            // Clean the line from BOM and special characters
            const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');
            console.log(`📄 Processing line: ${line}`);
            console.log(`📄 Clean line: ${cleanLine}`);

            // Simple check: if the line contains the accountId, this is our file
            if (cleanLine.includes(`[${accountId}]`) || cleanLine.includes(accountId)) {
              // Extract platform from the line
              const matches = cleanLine.match(/\[([^\]]+)\]/g);
              if (matches && matches.length >= 3) {
                const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
                console.log(`📋 Extracted values from line with account: [${values.join('][')}]`);

                // Find platform (usually the second or third bracket)
                accountPlatform = values.find(v => ['MT4', 'MT5', 'CTRADER'].includes(v)) || 'MT4';
                foundAccount = true;
                console.log(`✅ Found account ${accountId} on platform ${accountPlatform}`);
                console.log(`🎯 Will update CONFIG line in this file`);
                break;
              }
            }

            // Legacy check for [TYPE][PENDING][PLATFORM][ACCOUNT_ID] format
            if (cleanLine.includes('[TYPE]') && cleanLine.includes('[PENDING]')) {
              const matches = cleanLine.match(/\[([^\]]+)\]/g);
              if (matches && matches.length >= 4) {
                const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
                console.log(`📋 Extracted TYPE values: [${values.join('][')}]`);

                if (values[3] === accountId) {
                  foundAccount = true;
                  accountPlatform = values[2] || 'MT4';
                  console.log(
                    `✅ Found pending account ${accountId} on platform ${accountPlatform}`
                  );
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
                  console.log(
                    `✅ Found pending account ${accountId} in old format on platform ${accountPlatform}`
                  );
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
            for (const line of lines) {
              console.log(`🔍 Processing line: "${line}"`);
              const cleanLine = line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');
              console.log(`🔍 Clean line: "${cleanLine}"`);

              if (cleanLine.includes('[CONFIG]') && cleanLine.includes('[PENDING]')) {
                console.log(`✅ Found CONFIG line with PENDING, updating to ${newType}`);
                if (newType === 'master') {
                  newContent += `[CONFIG] [MASTER] [DISABLED] [Account ${accountId}]\n`;
                } else if (newType === 'slave') {
                  // Generate slave config with provided settings
                  const lotMultiplier = slaveConfig?.lotCoefficient || 1.0;
                  const forceLot = slaveConfig?.forceLot ? slaveConfig.forceLot : 'FALSE';
                  const reverseTrade = slaveConfig?.reverseTrade ? 'TRUE' : 'FALSE';
                  const masterId = slaveConfig?.masterAccountId || 'NULL';

                  newContent += `[CONFIG] [SLAVE] [DISABLED] [${lotMultiplier}] [${forceLot}] [${reverseTrade}] [${masterId}]\n`;
                }
              } else if (cleanLine.includes('[STATUS]')) {
                // Update timestamp
                console.log(`⏰ Updating STATUS timestamp`);
                newContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
              } else {
                newContent += line + '\n';
              }
            }

            writeFileSync(filePath, newContent, 'utf8');
            filesUpdated++;
            console.log(
              `✏️ Updated CONFIG line for account ${accountId} to ${newType} in ${filePath} (bot will update TYPE)`
            );
            console.log(`📄 New content:\n${newContent}`);
          } else {
            console.log(`❌ Account ${accountId} not found in this file`);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    if (filesUpdated > 0) {
      // Refresh CSV data from existing files (no new search)
      csvManager.refreshAllFileData();

      // Emit SSE event to notify frontend of account conversion
      csvManager.emit('accountConverted', {
        accountId: accountId,
        newType: newType,
        platform: platform,
        status: 'online', // La cuenta está online cuando se convierte
        apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
        timestamp: new Date().toISOString(),
      });
      console.log(`📢 SSE: Emitted accountConverted event for ${accountId} to ${newType}`);

      res.json({
        success: true,
        message: `Successfully updated account ${accountId} to ${newType} and registered in configured accounts system`,
        filesUpdated,
        accountRegistered: true,
      });
    } else {
      res.status(404).json({
        error: 'Account not found',
        message: `No pending account with ID ${accountId} found in CSV files`,
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

    console.log(`🗑️ Request to delete pending account ${accountId} from CSV files`);

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
            console.log(`📄 Processing new simplified format for deletion: ${filePath}`);

            for (let i = 0; i < lines.length; i++) {
              const lineValues = lines[i].split(',').map(v => v.trim());

              // Verificar formato: [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
              if (lineValues[0] === '0' && lineValues.length >= 5) {
                if (lineValues[1] === accountId) {
                  console.log(`🗑️ Removing account ${accountId} from new format file ${filePath}`);
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
                console.log(`🗑️ Removing account ${accountId} from legacy format file ${filePath}`);
                modified = true;
                // No agregar esta línea (eliminar)
              } else {
                filteredLines.push(lines[i]);
              }
            }
          }

          if (modified) {
            // Escribir el archivo actualizado
            writeFileSync(filePath, filteredLines.join('\n'));
            deletedFromFiles++;
            console.log(`✅ Updated file: ${filePath}`);
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
      console.log(`✅ Deleted account ${accountId} from ${deletedFromFiles} CSV file(s)`);
      res.json({
        success: true,
        message: `Account ${accountId} deleted from ${deletedFromFiles} CSV file(s)`,
        filesModified: deletedFromFiles,
      });
    } else {
      console.log(`⚠️ Account ${accountId} not found in any CSV files`);
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
    console.log('🔍 Starting simplified pending accounts scan...');

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

    // Solo loguear cuando hay resultados significativos
    if (response.summary.totalAccounts > 0) {
      console.log('✅ Pending accounts scan completed:', response.summary);
    }
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
    console.log('🔍 Starting platform connection scan...');

    const apiKey = req.apiKey;
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const userAccounts = getUserAccounts(apiKey);
    const previousCount = csvManager.csvFiles.size;
    console.log(`📊 Current CSV files: ${previousCount}`);

    // Usar archivos ya cargados (no hacer búsqueda completa)
    const files = Array.from(csvManager.csvFiles.keys());

    const newCount = csvManager.csvFiles.size;
    const foundFiles = newCount - previousCount;

    // Registrar automáticamente cuentas unknown como pending
    let registeredCount = 0;
    csvManager.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach(row => {
        if (row.account_id && row.account_type === 'unknown' && row.status === 'online') {
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
            console.log(`🔄 Auto-registered CSV account ${accountId} (${platform}) as pending`);
          }
        }
      });
    });

    // Guardar cambios si se registraron cuentas
    if (registeredCount > 0) {
      saveUserAccounts(apiKey, userAccounts);
      console.log(`💾 Saved ${registeredCount} new pending accounts`);
    }

    // Obtener estadísticas actualizadas
    const allAccounts = csvManager.getAllActiveAccounts();
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

    // Respuesta con estadísticas mejoradas
    const response = {
      success: true,
      message: `Platform scan completed. Found ${newCount} CSV files (${foundFiles} new)`,
      statistics: {
        csvFiles: {
          total: newCount,
          new: foundFiles,
          previousCount: previousCount,
        },
        accounts: {
          totalDetected: allAccounts.length,
          newlyRegistered: registeredCount,
        },
        platforms: platformStats,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Platform connection scan completed');
    console.log(`📊 Statistics: ${JSON.stringify(response.statistics, null, 2)}`);

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
    console.log('🔍 Starting platform accounts scan...');

    const previousCount = csvManager.csvFiles.size;

    // Refresh data from existing files (no new search)
    csvManager.refreshAllFileData();

    const newCount = csvManager.csvFiles.size;
    const allAccounts = csvManager.getAllActiveAccounts();

    res.json({
      success: true,
      message: 'Platform scan completed',
      filesFound: newCount,
      newFiles: newCount - previousCount,
      totalAccounts: allAccounts.length,
      accounts: allAccounts,
    });

    console.log(`✅ Platform scan completed: ${newCount} files, ${allAccounts.length} accounts`);
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
        if (row.account_id && row.account_type === 'unknown' && row.status === 'online') {
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

            console.log(`🔄 CSV account ${accountId} registered as pending`);
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
