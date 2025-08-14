import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

import csvManager from '../services/csvManager.js';
import { getUserAccounts, saveUserAccounts } from './configManager.js';
import { createDisabledMasterConfig } from './copierStatusController.js';
import { notifyAccountCreated, notifyTradingConfigCreated } from './eventNotifier.js';
import { createDisabledSlaveConfig } from './slaveConfigController.js';
import { createDefaultTradingConfig } from './tradingConfigController.js';

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

// Update CSV account type from pending to master/slave
export const updateCSVAccountType = async (req, res) => {
  console.log('🚀 updateCSVAccountType called with:', {
    accountId: req.params.accountId,
    newType: req.body.newType,
  });
  try {
    const { accountId } = req.params;
    const { newType } = req.body; // 'master' or 'slave'
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

    console.log(`🔄 Updating CSV account ${accountId} from pending to ${newType}...`);

    // Use the specific file path directly
    const csvFilePath =
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    let filesUpdated = 0;
    const allFiles = [csvFilePath];
    let platform = 'MT4'; // Default platform
    let timestamp = Date.now(); // Default timestamp

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

          // Process the single line directly
          const line = lines[0];
          console.log(`📄 Processing line: ${line}`);

          // Check if it's the bracket format: [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
          if (line.includes('[') && line.includes(']')) {
            // Extract values from bracket format
            const matches = line.match(/\[([^\]]+)\]/g);
            if (matches && matches.length >= 5) {
              const values = matches.map(m => m.replace(/[\[\]]/g, ''));
              console.log(`📋 Extracted values: [${values.join('][')}]`);

              if (values[0] === '0' && values[1] === accountId) {
                // Found the account - change from pending (0) to master (1) or slave (2)
                const newIndicator = newType === 'master' ? '1' : '2';
                const newStatus = newType.toUpperCase();
                const newLine = `[${newIndicator}][${values[1]}][${values[2]}][${newStatus}][${values[4]}]`;

                // Extract platform and timestamp from the original line
                platform = values[2] || 'MT4';
                timestamp = values[4] || Date.now();

                // Write the updated line back to file
                writeFileSync(filePath, newLine + '\n', 'utf8');
                filesUpdated++;
                console.log(`✏️ Updated account ${accountId} to ${newType} in ${filePath}`);
                console.log(`📄 New content: ${newLine}`);
              } else {
                console.log(`❌ Account ${accountId} not found in this line`);
              }
            }
          } else {
            console.log(`❌ File format not recognized: ${filePath}`);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    if (filesUpdated > 0) {
      // Register the account in the configured accounts system
      const userAccounts = getUserAccounts(apiKey);

      if (newType === 'master') {
        // Check if account already exists as master or slave
        if (userAccounts.masterAccounts[accountId] || userAccounts.slaveAccounts[accountId]) {
          console.log(
            `⚠️ Account ${accountId} already exists as configured account, skipping registration`
          );
        } else {
          // Register as master account
          userAccounts.masterAccounts[accountId] = {
            id: accountId,
            name: accountId,
            description: `Converted from pending CSV account`,
            broker: 'Unknown',
            platform: platform,
            registeredAt: new Date().toISOString(),
            lastActivity: new Date(parseInt(timestamp) * 1000).toISOString(),
            status: 'active',
            apiKey: apiKey,
            convertedFrom: 'pending_csv',
          };

          if (saveUserAccounts(apiKey, userAccounts)) {
            // Create disabled master configuration for copy control
            createDisabledMasterConfig(accountId, apiKey);
            // Create default trading configuration
            createDefaultTradingConfig(accountId);

            // Notify about account creation
            notifyAccountCreated(accountId, 'master', apiKey);
            notifyTradingConfigCreated(accountId, {
              lotMultiplier: 1.0,
              forceLot: null,
              reverseTrading: false,
            });

            console.log(
              `✅ Successfully registered account ${accountId} as master in configured accounts system`
            );
          }
        }
      } else if (newType === 'slave') {
        // Check if account already exists as master or slave
        if (userAccounts.masterAccounts[accountId] || userAccounts.slaveAccounts[accountId]) {
          console.log(
            `⚠️ Account ${accountId} already exists as configured account, skipping registration`
          );
        } else {
          // Register as slave account
          userAccounts.slaveAccounts[accountId] = {
            id: accountId,
            name: accountId,
            description: `Converted from pending CSV account`,
            broker: 'Unknown',
            platform: platform,
            registeredAt: new Date().toISOString(),
            lastActivity: new Date(parseInt(timestamp) * 1000).toISOString(),
            status: 'active',
            apiKey: apiKey,
            convertedFrom: 'pending_csv',
          };

          if (saveUserAccounts(apiKey, userAccounts)) {
            // Create disabled slave configuration
            createDisabledSlaveConfig(accountId);

            console.log(
              `✅ Successfully registered account ${accountId} as slave in configured accounts system`
            );
          }
        }
      }

      // Trigger CSV scan to update the in-memory data
      await csvManager.scanCSVFiles();

      // Emit SSE event to notify frontend of account conversion
      csvManager.emit('accountConverted', {
        accountId: accountId,
        newType: newType,
        platform: platform,
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

    // Usar el nuevo método que soporta ambos formatos
    const pendingAccounts = await csvManager.scanSimplifiedPendingCSVFiles();

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

    // Forzar escaneo completo
    const files = await csvManager.scanCSVFiles();

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

    // Forzar escaneo completo
    await csvManager.scanCSVFiles();

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
