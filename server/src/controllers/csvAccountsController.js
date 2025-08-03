import csvManager from '../services/csvManager.js';
import { getUserAccounts, saveUserAccounts } from './configManager.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Obtener todas las cuentas desde CSV
export const getAllAccounts = (req, res) => {
  try {
    const accounts = csvManager.getAllActiveAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error getting accounts from CSV:', error);
    res.status(500).json({ error: 'Failed to get accounts from CSV' });
  }
};

// Obtener estado del copier desde CSV
export const getCopierStatus = (req, res) => {
  try {
    const status = csvManager.getCopierStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting copier status from CSV:', error);
    res.status(500).json({ error: 'Failed to get copier status from CSV' });
  }
};

// Actualizar estado global del copier
export const setGlobalStatus = (req, res) => {
  try {
    const { enabled } = req.body;
    csvManager.updateGlobalStatus(enabled);

    res.json({
      success: true,
      message: `Global copier ${enabled ? 'enabled' : 'disabled'}`,
      enabled,
    });
  } catch (error) {
    console.error('Error updating global status:', error);
    res.status(500).json({ error: 'Failed to update global status' });
  }
};

// Actualizar estado de master
export const setMasterStatus = (req, res) => {
  try {
    const { masterAccountId, enabled } = req.body;
    csvManager.updateMasterStatus(masterAccountId, enabled);

    res.json({
      success: true,
      message: `Master ${masterAccountId} ${enabled ? 'enabled' : 'disabled'}`,
      masterAccountId,
      enabled,
    });
  } catch (error) {
    console.error('Error updating master status:', error);
    res.status(500).json({ error: 'Failed to update master status' });
  }
};

// Obtener configuración de slave
export const getSlaveConfig = (req, res) => {
  try {
    const { slaveAccountId } = req.params;
    const config = csvManager.getSlaveConfig(slaveAccountId);

    res.json({
      slaveAccountId,
      config,
    });
  } catch (error) {
    console.error('Error getting slave config:', error);
    res.status(500).json({ error: 'Failed to get slave config' });
  }
};

// Actualizar configuración de slave
export const updateSlaveConfig = (req, res) => {
  try {
    const { slaveAccountId, enabled } = req.body;
    csvManager.updateSlaveConfig(slaveAccountId, enabled);

    res.json({
      success: true,
      message: `Slave ${slaveAccountId} ${enabled ? 'enabled' : 'disabled'}`,
      slaveAccountId,
      enabled,
    });
  } catch (error) {
    console.error('Error updating slave config:', error);
    res.status(500).json({ error: 'Failed to update slave config' });
  }
};

// Emergency shutdown
export const emergencyShutdown = (req, res) => {
  try {
    csvManager.emergencyShutdown();

    res.json({
      success: true,
      message: 'Emergency shutdown executed - all copiers disabled',
    });
  } catch (error) {
    console.error('Error executing emergency shutdown:', error);
    res.status(500).json({ error: 'Failed to execute emergency shutdown' });
  }
};

// Reset all to ON
export const resetAllToOn = (req, res) => {
  try {
    csvManager.resetAllToOn();

    res.json({
      success: true,
      message: 'All copier statuses reset to ON',
    });
  } catch (error) {
    console.error('Error resetting all statuses:', error);
    res.status(500).json({ error: 'Failed to reset all statuses' });
  }
};

// Obtener estadísticas de conectividad
export const getConnectivityStats = (req, res) => {
  try {
    const accounts = csvManager.getAllActiveAccounts();
    const totalAccounts =
      Object.keys(accounts.masterAccounts).length + accounts.unconnectedSlaves.length;

    const onlineAccounts =
      Object.values(accounts.masterAccounts).filter(account => account.status === 'online').length +
      accounts.unconnectedSlaves.filter(slave => slave.status === 'online').length;

    res.json({
      totalAccounts,
      onlineAccounts,
      offlineAccounts: totalAccounts - onlineAccounts,
      connectivityPercentage: totalAccounts > 0 ? (onlineAccounts / totalAccounts) * 100 : 0,
    });
  } catch (error) {
    console.error('Error getting connectivity stats:', error);
    res.status(500).json({ error: 'Failed to get connectivity stats' });
  }
};

// Escanear archivos CSV
export const scanCSVFiles = (req, res) => {
  try {
    const files = csvManager.scanCSVFiles();

    res.json({
      success: true,
      message: `Found ${files.length} CSV files`,
      files,
    });
  } catch (error) {
    console.error('Error scanning CSV files:', error);
    res.status(500).json({ error: 'Failed to scan CSV files' });
  }
};

// Eliminar cuenta pending del sistema CSV simplificado
export const deletePendingAccount = async (req, res) => {
  try {
    console.log('🗑️ Deleting pending account...');
    
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false,
        error: 'Account ID is required' 
      });
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
          absolute: true 
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
          
          const headers = lines[0].split(',').map(h => h.trim());
          const expectedHeaders = ['timestamp', 'account_id', 'account_type', 'platform'];
          const isSimplifiedFormat = expectedHeaders.every(h => headers.includes(h));
          
          if (!isSimplifiedFormat) continue;

          // Buscar y eliminar líneas que contengan esta cuenta
          let modified = false;
          const filteredLines = [headers.join(',')]; // Mantener header
          
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const accountIdIndex = headers.indexOf('account_id');
            
            if (accountIdIndex >= 0 && values[accountIdIndex] === accountId) {
              console.log(`🗑️ Removing account ${accountId} from ${filePath}`);
              modified = true;
              // No agregar esta línea (eliminar)
            } else {
              filteredLines.push(lines[i]);
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

    // Trigger a scan update
    await csvManager.scanAndEmitPendingUpdates();

    const response = {
      success: true,
      message: deletedFromFiles > 0 
        ? `Account ${accountId} deleted from ${deletedFromFiles} file(s)` 
        : `Account ${accountId} not found in any files`,
      deletedFromFiles,
      accountId
    };

    console.log('✅ Pending account deletion completed:', response);
    res.json(response);

  } catch (error) {
    console.error('❌ Error deleting pending account:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete pending account',
      details: error.message 
    });
  }
};

// Nuevo endpoint simplificado para pending accounts
export const scanPendingAccounts = async (req, res) => {
  try {
    console.log('🔍 Starting simplified pending accounts scan...');

    const pendingAccounts = await csvManager.scanPendingCSVFiles();

    // Agrupar por plataforma
    const platformStats = {};
    pendingAccounts.forEach(account => {
      const platform = account.platform || 'Unknown';
      if (!platformStats[platform]) {
        platformStats[platform] = { online: 0, offline: 0, total: 0 };
      }
      platformStats[platform][account.status]++;
      platformStats[platform].total++;
    });

    const response = {
      success: true,
      message: `Found ${pendingAccounts.length} pending accounts`,
      accounts: pendingAccounts,
      summary: {
        totalAccounts: pendingAccounts.length,
        onlineAccounts: pendingAccounts.filter(a => a.status === 'online').length,
        offlineAccounts: pendingAccounts.filter(a => a.status === 'offline').length,
        platformStats,
      },
      platforms: Object.keys(platformStats),
    };

    console.log('✅ Pending accounts scan completed:', response.summary);
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
    Object.values(allAccounts.masterAccounts).forEach(account => {
      const platform = account.platform || 'Unknown';
      platformStats[platform] = (platformStats[platform] || 0) + 1;
    });

    allAccounts.unconnectedSlaves.forEach(account => {
      const platform = account.platform || 'Unknown';
      platformStats[platform] = (platformStats[platform] || 0) + 1;
    });

    // Contar cuentas pending por plataforma
    const pendingStats = {};
    if (userAccounts.pendingAccounts) {
      Object.values(userAccounts.pendingAccounts).forEach(account => {
        const platform = account.platform || 'Unknown';
        pendingStats[platform] = (pendingStats[platform] || 0) + 1;
      });
    }

    // Reiniciar watchers para nuevos archivos
    if (foundFiles > 0) {
      csvManager.startFileWatching();
      console.log(`📁 Started watching ${foundFiles} new CSV file(s)`);
    }

    const totalPendingAccounts = userAccounts.pendingAccounts
      ? Object.keys(userAccounts.pendingAccounts).length
      : 0;
    const csvAccountsCount =
      Object.keys(allAccounts.masterAccounts).length + allAccounts.unconnectedSlaves.length;

    const response = {
      success: true,
      message:
        registeredCount > 0
          ? `Connected ${registeredCount} new accounts! Found ${foundFiles} new CSV files`
          : foundFiles > 0
            ? `Scanned ${foundFiles} new CSV files. No new accounts to connect`
            : 'Platform scan complete. No new files or accounts found',
      summary: {
        totalFiles: newCount,
        newFiles: foundFiles,
        csvAccounts: csvAccountsCount,
        newPendingAccounts: registeredCount,
        totalPendingAccounts,
        platformStats,
        pendingStats,
      },
      platforms: Object.keys({ ...platformStats, ...pendingStats }),
      actions: {
        filesScanned: newCount,
        newFilesFound: foundFiles,
        accountsRegistered: registeredCount,
        totalPending: totalPendingAccounts,
      },
    };

    console.log('✅ Platform connection completed:', response.summary);
    res.json(response);
  } catch (error) {
    console.error('❌ Error connecting platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect platforms',
      details: error.message,
    });
  }
};

// Instalar bot en plataforma
export const installBot = (req, res) => {
  try {
    const { platform } = req.body;

    // Simular instalación de bot
    console.log(`Installing bot for platform: ${platform}`);

    res.json({
      success: true,
      message: `Bot installed successfully for ${platform}`,
      platform,
    });
  } catch (error) {
    console.error('Error installing bot:', error);
    res.status(500).json({ error: 'Failed to install bot' });
  }
};

// Ejecutar script de instalación
export const runInstallScript = (req, res) => {
  try {
    const { platform } = req.body;

    // Simular ejecución de script
    console.log(`Running install script for platform: ${platform}`);

    res.json({
      success: true,
      message: `Install script executed for ${platform}`,
      platform,
    });
  } catch (error) {
    console.error('Error running install script:', error);
    res.status(500).json({ error: 'Failed to run install script' });
  }
};

// Escanear cuentas en plataformas
export const scanPlatformAccounts = (req, res) => {
  try {
    // Simular escaneo de cuentas
    const accounts = {
      mt4: 2,
      mt5: 3,
      ctrader: 1,
      tradingview: 0,
      ninjatrader: 0,
    };

    res.json({
      success: true,
      message: 'Platform accounts scanned successfully',
      accounts,
    });
  } catch (error) {
    console.error('Error scanning platform accounts:', error);
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
      totalPending: Object.keys(userAccounts.pendingAccounts || {}).length,
    });
  } catch (error) {
    console.error('Error registering CSV accounts as pending:', error);
    res.status(500).json({ error: 'Failed to register CSV accounts as pending' });
  }
};
