import { existsSync, mkdirSync, readFile, readFileSync, writeFile, writeFileSync } from 'fs';
import { join } from 'path';

import csvManager from '../services/csvManager.js';
import { getUserAccounts, loadAccountsConfig, saveUserAccounts } from './configManager.js';
import { createDisabledMasterConfig, loadUserCopierStatus } from './copierStatusController.js';
import {
  notifyAccountConverted,
  notifyAccountCreated,
  notifyTradingConfigCreated,
} from './eventNotifier.js';
import linkPlatformsController from './linkPlatformsController.js';
import { createDisabledSlaveConfig, loadSlaveConfigs } from './slaveConfigController.js';
import { createDefaultTradingConfig } from './tradingConfigController.js';

// Accounts management file
const configBaseDir = join(process.cwd(), 'server', 'config');
const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

// Initialize accounts configuration with new user-based structure
const initializeAccountsConfig = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(accountsFilePath)) {
    const defaultConfig = {
      userAccounts: {},
      globalData: {
        lastMigration: null,
        version: '2.0',
      },
    };
    writeFileSync(accountsFilePath, JSON.stringify(defaultConfig, null, 2));
  }
};

// Validation helpers - now user-specific
export const isMasterAccountRegistered = (apiKey, masterAccountId) => {
  const userAccounts = getUserAccounts(apiKey);
  return masterAccountId in userAccounts.masterAccounts;
};

export const isSlaveAccountRegistered = (apiKey, slaveAccountId) => {
  const userAccounts = getUserAccounts(apiKey);
  return slaveAccountId in userAccounts.slaveAccounts;
};

export const getSlaveConnection = (apiKey, slaveAccountId) => {
  const userAccounts = getUserAccounts(apiKey);
  return userAccounts.connections[slaveAccountId] || null;
};

// Check if master account is online for a given slave
export const isMasterOnlineForSlave = (apiKey, slaveAccountId) => {
  const userAccounts = getUserAccounts(apiKey);
  const masterId = userAccounts.connections[slaveAccountId];

  if (!masterId) {
    return false; // No master connected
  }

  const masterAccount = userAccounts.masterAccounts[masterId];
  return masterAccount && masterAccount.status !== 'offline';
};

// Define supported platforms
const SUPPORTED_PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'NinjaTrader', 'Other'];

// Activity monitoring configuration
const ACTIVITY_TIMEOUT = 5000; // 5 seconds in milliseconds
const PENDING_DELETION_TIMEOUT = 3600000; // 1 hour in milliseconds

// Check and update account status based on activity
const checkAccountActivity = async () => {
  try {
    // Get all accounts from CSV files
    const allAccounts = await csvManager.getAllActiveAccounts();
    let hasChanges = false;
    const now = new Date();

    // Process all accounts (pending, master, and slave)
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      try {
        // Use async file reading to avoid EBUSY errors
        const fileContent = await new Promise((resolve, reject) => {
          readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              if (err.code === 'EBUSY' || err.code === 'EACCES') {
                resolve(null); // Skip this file
              } else {
                reject(err);
              }
            } else {
              resolve(data);
            }
          });
        });

        if (!fileContent) {
          continue; // Skip this file if it was busy
        }

        let fileModified = false;

        fileData.data.forEach(account => {
          const accountId = account.account_id;
          const accountType = account.account_type;
          const lastActivity = new Date(account.timestamp);
          const timeSinceActivity = now - lastActivity;
          const currentStatus = account.current_status || account.status;

          // Check if account should be marked as offline
          if (timeSinceActivity > ACTIVITY_TIMEOUT && currentStatus !== 'offline') {
            // Update status in CSV file
            const statusLine = `[STATUS] [OFFLINE] [${Math.floor(now.getTime() / 1000)}]`;
            fileContent = fileContent.replace(/\[STATUS\].*\n/, `${statusLine}\n`);
            fileModified = true;
            hasChanges = true;
          }
          // Check if account should be marked as online
          else if (timeSinceActivity <= ACTIVITY_TIMEOUT && currentStatus === 'offline') {
            // Update status in CSV file
            const statusLine = `[STATUS] [ONLINE] [${Math.floor(now.getTime() / 1000)}]`;
            fileContent = fileContent.replace(/\[STATUS\].*\n/, `${statusLine}\n`);
            fileModified = true;
            hasChanges = true;
          }
        });

        // Save changes to file if modified
        if (fileModified) {
          try {
            await new Promise((resolve, reject) => {
              writeFile(filePath, fileContent, 'utf8', err => {
                if (err) {
                  if (err.code === 'EBUSY' || err.code === 'EACCES') {
                    resolve(); // Continue without error
                  } else {
                    reject(err);
                  }
                } else {
                  resolve();
                }
              });
            });
          } catch (error) {
            console.error(`Error writing to file ${filePath}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        continue; // Skip this file and continue with others
      }
    }

    // Refresh CSV data if changes were made
    if (hasChanges) {
      csvManager.refreshAllFileData().catch(error => {
        console.error('Error refreshing CSV data:', error);
      });

      // Emit event to notify frontend of account changes
      csvManager.emit('csvUpdated', {
        type: 'statusUpdate',
        timestamp: new Date().toISOString(),
      });
    }

    return hasChanges;
  } catch (error) {
    console.error('Error checking account activity:', error);
    return false;
  }
};

// Start activity monitoring
const startActivityMonitoring = () => {
  // Check activity every 1 second
  setInterval(() => {
    checkAccountActivity();
  }, 1000);
};

// Initialize activity monitoring when module loads
// startActivityMonitoring(); // Removed to avoid duplicate monitoring - now called from dev.js

// Register new master account
export const registerMasterAccount = (req, res) => {
  const { masterAccountId, name, description, broker, platform } = req.body;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!masterAccountId) {
    return res.status(400).json({
      error: 'masterAccountId is required',
    });
  }

  if (platform && !SUPPORTED_PLATFORMS.includes(platform)) {
    return res.status(400).json({
      error: `Platform ${platform} is not supported. Supported platforms: ${SUPPORTED_PLATFORMS.join(', ')}`,
    });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (userAccounts.masterAccounts[masterAccountId]) {
    return res.status(409).json({
      error: `Master account ${masterAccountId} is already registered`,
    });
  }

  userAccounts.masterAccounts[masterAccountId] = {
    id: masterAccountId,
    name: name || masterAccountId,
    description: description || '',
    broker: broker || '',
    platform: platform || '',
    registeredAt: new Date().toISOString(),
    lastActivity: null,
    status: 'active',
    apiKey: apiKey, // Track which user owns this account
  };

  if (saveUserAccounts(apiKey, userAccounts)) {
    // Create disabled master configuration for copy control
    createDisabledMasterConfig(masterAccountId, apiKey);
    // Create default trading configuration
    createDefaultTradingConfig(masterAccountId);

    // Notify about account creation
    notifyAccountCreated(masterAccountId, 'master', apiKey);
    notifyTradingConfigCreated(masterAccountId, {
      lotMultiplier: 1.0,
      forceLot: null,
      reverseTrading: false,
    });

    res.json({
      message: 'Master account registered successfully (copying disabled by default)',
      account: userAccounts.masterAccounts[masterAccountId],
      status: 'success',
      copyingEnabled: false,
    });
    // Trigger background linking after registering master (only if not already running)
    try {
      if (!linkPlatformsController.isLinking) {
        linkPlatformsController.findAndSyncMQLFoldersManual();
      } else {
      }
    } catch {}
  } else {
    res.status(500).json({ error: 'Failed to register master account' });
  }
};

// Register new slave account
export const registerSlaveAccount = (req, res) => {
  const { slaveAccountId, name, description, broker, platform, masterAccountId } = req.body;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!slaveAccountId) {
    return res.status(400).json({
      error: 'slaveAccountId is required',
    });
  }

  if (platform && !SUPPORTED_PLATFORMS.includes(platform)) {
    return res.status(400).json({
      error: `Platform ${platform} is not supported. Supported platforms: ${SUPPORTED_PLATFORMS.join(', ')}`,
    });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (userAccounts.slaveAccounts[slaveAccountId]) {
    return res.status(409).json({
      error: `Slave account ${slaveAccountId} is already registered`,
    });
  }

  // If masterAccountId is provided, validate it exists within user's accounts
  if (masterAccountId) {
    if (!userAccounts.masterAccounts[masterAccountId]) {
      return res.status(400).json({
        error: `Master account ${masterAccountId} is not registered in your account`,
      });
    }
  }

  userAccounts.slaveAccounts[slaveAccountId] = {
    id: slaveAccountId,
    name: name || slaveAccountId,
    description: description || '',
    broker: broker || '',
    platform: platform || '',
    registeredAt: new Date().toISOString(),
    lastActivity: null,
    status: 'active',
    apiKey: apiKey, // Track which user owns this account
  };

  // Set connection if masterAccountId is provided
  if (masterAccountId) {
    userAccounts.connections[slaveAccountId] = masterAccountId;
  }

  if (saveUserAccounts(apiKey, userAccounts)) {
    // Create disabled slave configuration for copy control
    createDisabledSlaveConfig(slaveAccountId);

    // Prepare response with deployment information
    const responseData = {
      message: 'Slave account registered successfully (copying disabled by default)',
      account: userAccounts.slaveAccounts[slaveAccountId],
      connectedTo: masterAccountId || null,
      status: 'success',
      copyingEnabled: false,
    };

    // Add deployment information if connected to master
    if (masterAccountId) {
      responseData.deployed = true;
      responseData.deploymentMessage = `Slave account ${slaveAccountId} has been deployed under master ${masterAccountId}`;
    }

    res.json(responseData);
    // Trigger background linking after registering slave (only if not already running)
    try {
      if (!linkPlatformsController.isLinking) {
        linkPlatformsController.findAndSyncMQLFoldersManual();
      } else {
      }
    } catch {}
  } else {
    res.status(500).json({ error: 'Failed to register slave account' });
  }
};

// Connect slave to master account
export const connectSlaveToMaster = (req, res) => {
  const { slaveAccountId, masterAccountId } = req.body;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!slaveAccountId || !masterAccountId) {
    return res.status(400).json({
      error: 'Both slaveAccountId and masterAccountId are required',
    });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (!userAccounts.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} is not registered`,
    });
  }

  if (!userAccounts.masterAccounts[masterAccountId]) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} is not registered`,
    });
  }

  userAccounts.connections[slaveAccountId] = masterAccountId;

  if (saveUserAccounts(apiKey, userAccounts)) {
    res.json({
      message: 'Accounts connected successfully',
      slaveAccountId,
      masterAccountId,
      status: 'connected',
    });
  } else {
    res.status(500).json({ error: 'Failed to connect accounts' });
  }
};

// Disconnect slave from master
export const disconnectSlave = (req, res) => {
  const { slaveAccountId } = req.params;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (!userAccounts.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} is not registered`,
    });
  }

  const previousConnection = userAccounts.connections[slaveAccountId];
  delete userAccounts.connections[slaveAccountId];

  if (saveUserAccounts(apiKey, userAccounts)) {
    res.json({
      message: 'Slave account disconnected successfully',
      slaveAccountId,
      previousConnection: previousConnection || null,
      status: 'disconnected',
    });
  } else {
    res.status(500).json({ error: 'Failed to disconnect slave account' });
  }
};

// Get master account
export const getMasterAccount = (req, res) => {
  const { masterAccountId } = req.params;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);
  const account = userAccounts.masterAccounts[masterAccountId];

  if (!account) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} not found in your accounts`,
    });
  }

  // Get connected slaves for this master
  const connectedSlaves = Object.entries(userAccounts.connections)
    .filter(([, masterId]) => masterId === masterAccountId)
    .map(([slaveId]) => ({ id: slaveId, ...userAccounts.slaveAccounts[slaveId] }));

  res.json({
    account,
    connectedSlaves,
    totalSlaves: connectedSlaves.length,
  });
};

// Get slave account
export const getSlaveAccount = (req, res) => {
  const { slaveAccountId } = req.params;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);
  const account = userAccounts.slaveAccounts[slaveAccountId];

  if (!account) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found in your accounts`,
    });
  }

  const connectedTo = userAccounts.connections[slaveAccountId] || null;

  res.json({
    account,
    connectedTo,
    masterAccount: connectedTo ? userAccounts.masterAccounts[connectedTo] : null,
  });
};

// Get all accounts overview
export const getAllAccounts = async (req, res) => {
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  try {
    // Force refresh of CSV data to ensure we have the latest information
    await csvManager.refreshAllFileData();

    // Get accounts from CSV instead of JSON
    const accounts = await csvManager.getAllActiveAccounts();

    const totalMasterAccounts = Object.keys(accounts.masterAccounts).length;
    const totalConnectedSlaves = Object.values(accounts.masterAccounts).reduce(
      (sum, master) => sum + master.connectedSlaves.length,
      0
    );
    const totalSlaveAccounts = accounts.unconnectedSlaves.length + totalConnectedSlaves;
    const totalPendingAccounts = accounts.pendingAccounts.length;
    const totalConnections = totalConnectedSlaves;

    // Calcular estadísticas adicionales
    const offlineAccounts =
      Object.values(accounts.masterAccounts).filter(acc => acc.status === 'offline').length +
      accounts.unconnectedSlaves.filter(acc => acc.status === 'offline').length +
      Object.values(accounts.masterAccounts).reduce(
        (sum, master) =>
          sum + master.connectedSlaves.filter(slave => slave.status === 'offline').length,
        0
      );
    const onlineAccounts =
      Object.values(accounts.masterAccounts).filter(acc => acc.status === 'online').length +
      accounts.unconnectedSlaves.filter(acc => acc.status === 'online').length +
      accounts.pendingAccounts.filter(acc => acc.status === 'online').length +
      Object.values(accounts.masterAccounts).reduce(
        (sum, master) =>
          sum + master.connectedSlaves.filter(slave => slave.status === 'online').length,
        0
      );
    const totalAccounts = totalMasterAccounts + totalSlaveAccounts + totalPendingAccounts;

    const response = {
      masterAccounts: accounts.masterAccounts,
      unconnectedSlaves: accounts.unconnectedSlaves,
      totalMasterAccounts,
      totalSlaveAccounts,
      totalPendingAccounts,
      totalConnections,
      offline: offlineAccounts,
      online: onlineAccounts,
      total: totalAccounts,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting all accounts:', error);
    res.status(500).json({
      error: 'Failed to get accounts',
      message: error.message,
    });
  }
};

// Update master account
export const updateMasterAccount = (req, res) => {
  const { masterAccountId } = req.params;
  const { name, description, broker, platform, status } = req.body;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (!userAccounts.masterAccounts[masterAccountId]) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} not found in your accounts`,
    });
  }

  // Update fields if provided
  if (name !== undefined) userAccounts.masterAccounts[masterAccountId].name = name;
  if (description !== undefined)
    userAccounts.masterAccounts[masterAccountId].description = description;
  if (broker !== undefined) userAccounts.masterAccounts[masterAccountId].broker = broker;
  if (platform !== undefined) userAccounts.masterAccounts[masterAccountId].platform = platform;
  if (status !== undefined) userAccounts.masterAccounts[masterAccountId].status = status;

  userAccounts.masterAccounts[masterAccountId].lastUpdated = new Date().toISOString();

  if (saveUserAccounts(apiKey, userAccounts)) {
    res.json({
      message: 'Master account updated successfully',
      account: userAccounts.masterAccounts[masterAccountId],
      status: 'success',
    });
    // Trigger background linking after master update (only if not already running)
    try {
      if (!linkPlatformsController.isLinking) {
        linkPlatformsController.findAndSyncMQLFoldersManual();
      } else {
      }
    } catch {}
  } else {
    res.status(500).json({ error: 'Failed to update master account' });
  }
};

// Update slave account
export const updateSlaveAccount = (req, res) => {
  const { slaveAccountId } = req.params;
  const { name, description, broker, platform, status, masterAccountId } = req.body;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (!userAccounts.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found in your accounts`,
    });
  }

  // Update fields if provided
  if (name !== undefined) userAccounts.slaveAccounts[slaveAccountId].name = name;
  if (description !== undefined)
    userAccounts.slaveAccounts[slaveAccountId].description = description;
  if (broker !== undefined) userAccounts.slaveAccounts[slaveAccountId].broker = broker;
  if (platform !== undefined) userAccounts.slaveAccounts[slaveAccountId].platform = platform;
  if (status !== undefined) userAccounts.slaveAccounts[slaveAccountId].status = status;

  userAccounts.slaveAccounts[slaveAccountId].lastUpdated = new Date().toISOString();

  // Handle master connection if provided
  if (masterAccountId !== undefined) {
    if (masterAccountId && masterAccountId !== 'none' && masterAccountId !== '') {
      // Validate that the master account exists in user's accounts
      if (!userAccounts.masterAccounts[masterAccountId]) {
        return res.status(400).json({
          error: `Master account ${masterAccountId} is not registered in your accounts`,
        });
      }
      // Establish connection
      userAccounts.connections[slaveAccountId] = masterAccountId;
    } else {
      // Remove connection if masterAccountId is empty, 'none', or null
      delete userAccounts.connections[slaveAccountId];
    }
  }

  if (saveUserAccounts(apiKey, userAccounts)) {
    res.json({
      message: 'Slave account updated successfully',
      account: userAccounts.slaveAccounts[slaveAccountId],
      connectedTo: userAccounts.connections[slaveAccountId] || null,
      status: 'success',
    });
    // Trigger background linking after slave update (only if not already running)
    try {
      if (!linkPlatformsController.isLinking) {
        linkPlatformsController.findAndSyncMQLFoldersManual();
      } else {
      }
    } catch {}
  } else {
    res.status(500).json({ error: 'Failed to update slave account' });
  }
};

// Function to write account back to CSV as PENDING using new CSV2 format
const writeAccountToCSVAsPending = async (accountId, platform = 'MT4') => {
  try {
    // Use csvManager to find appropriate CSV file
    let csvFilePath = null;
    let currentStatus = 'ONLINE'; // Default status
    let currentTimestamp = null; // Will be set from CSV

    // Import csvManager dynamically
    const csvManager = (await import('../services/csvManager.js')).default;

    // Find which cached file contains this account or find a suitable file for the platform
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      // Check if this file contains the account
      const accountExists = fileData.data.some(
        account =>
          account.account_id === accountId ||
          (existsSync(filePath) && readFileSync(filePath, 'utf8').includes(`[${accountId}]`))
      );

      if (accountExists) {
        csvFilePath = filePath;

        // Try to preserve the current status and timestamp from the existing CSV
        try {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n');

          for (const line of lines) {
            if (line.includes('[STATUS]') && line.includes(`[${accountId}]`)) {
              const statusMatch = line.match(/\[(ONLINE|OFFLINE)\]/);
              const timestampMatch = line.match(/\[(\d+)\]/);
              if (statusMatch) {
                currentStatus = statusMatch[1];
              }
              if (timestampMatch) {
                currentTimestamp = parseInt(timestampMatch[1]);
              }
              break;
            }
          }
        } catch (error) {}

        break;
      }
    }

    // If we couldn't find the timestamp, use current time as fallback
    if (currentTimestamp === null) {
      currentTimestamp = Math.floor(Date.now() / 1000);
    }

    // If no file found with the account, find a file for the platform
    if (!csvFilePath) {
      for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
        // Check if any account in this file matches the platform
        const platformMatch = fileData.data.some(account => account.platform === platform);
        if (platformMatch) {
          csvFilePath = filePath;
          break;
        }
      }
    }

    // If still no file found, use the first available file
    if (!csvFilePath && csvManager.csvFiles.size > 0) {
      csvFilePath = Array.from(csvManager.csvFiles.keys())[0];
    }

    if (!csvFilePath) {
      return false;
    }

    // Instead of overwriting the entire file, use csvManager.convertToPending()
    // which properly modifies only the specific account lines
    const success = csvManager.convertToPending(accountId);

    if (success) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error writing account to CSV as pending:', error);
    return false;
  }
};

// Function to update CSV account to MASTER using new CSV2 format
const updateCSVAccountToMaster = async (accountId, platform = 'MT4') => {
  try {
    // Import csvManager dynamically
    const csvManager = (await import('../services/csvManager.js')).default;

    // Use cached CSV files from csvManager to find the account
    let csvFilePath = null;

    // Find which cached file contains this account
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      // Check if this file contains the account
      const accountExists = fileData.data.some(
        account =>
          account.account_id === accountId ||
          (existsSync(filePath) && readFileSync(filePath, 'utf8').includes(`[${accountId}]`))
      );

      if (accountExists) {
        csvFilePath = filePath;
        break;
      }
    }

    if (!csvFilePath) {
      return false;
    }

    // Try to preserve the current status and timestamp from the existing CSV
    let currentStatus = 'ONLINE'; // Default status
    let currentTimestamp = null; // Will be set from CSV
    try {
      const content = readFileSync(csvFilePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.includes('[STATUS]') && line.includes(`[${accountId}]`)) {
          const statusMatch = line.match(/\[(ONLINE|OFFLINE)\]/);
          const timestampMatch = line.match(/\[(\d+)\]/);
          if (statusMatch) {
            currentStatus = statusMatch[1];
          }
          if (timestampMatch) {
            currentTimestamp = parseInt(timestampMatch[1]);
          }
          break;
        }
      }
    } catch (error) {}

    // If we couldn't find the timestamp, use current time as fallback
    if (currentTimestamp === null) {
      currentTimestamp = Math.floor(Date.now() / 1000);
    }

    // Generate new CSV2 format content for master account (WITH SPACES)
    let csvContent = `[TYPE] [PENDING] [${platform}] [${accountId}]\n`;
    csvContent += `[STATUS] [${currentStatus}] [${currentTimestamp}]\n`;
    csvContent += `[CONFIG] [MASTER] [DISABLED] [${accountId}]\n`;

    // Write the master account to CSV in new format
    // Ensure we're writing to .csv not .cssv
    const correctPath = csvFilePath.replace(/\.cssv$/, '.csv');
    writeFileSync(correctPath, csvContent.replace(/\r\n/g, '\n'), 'utf8');

    return true;
  } catch (error) {
    console.error('Error updating CSV account to master:', error);
    return false;
  }
};

// Helper function to find CSV file path for a master account
const findMasterCSVPath = async masterId => {
  try {
    // Use csvManager that's already imported at the top of this file
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

// Function to update CSV account to SLAVE using new CSV2 format
const updateCSVAccountToSlave = async (accountId, platform = 'MT4', masterId = 'NULL') => {
  try {
    // Use cached CSV files from csvManager to find the account
    let csvFilePath = null;

    // Find which cached file contains this account
    for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
      // Check if this file contains the account
      const accountExists = fileData.data.some(
        account =>
          account.account_id === accountId ||
          (existsSync(filePath) && readFileSync(filePath, 'utf8').includes(`[${accountId}]`))
      );

      if (accountExists) {
        csvFilePath = filePath;
        break;
      }
    }

    if (!csvFilePath) {
      return false;
    }

    // Try to preserve the current timestamp from the existing CSV
    let currentTimestamp = null; // Will be set from CSV
    try {
      const content = readFileSync(csvFilePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.includes('[STATUS]') && line.includes(`[${accountId}]`)) {
          const timestampMatch = line.match(/\[(\d+)\]/);
          if (timestampMatch) {
            currentTimestamp = parseInt(timestampMatch[1]);

            break;
          }
        }
      }
    } catch (error) {}

    // If we couldn't find the timestamp, use current time as fallback
    if (currentTimestamp === null) {
      currentTimestamp = Math.floor(Date.now() / 1000);
    }

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

    // Preserve the current ENABLED/DISABLED status from the existing CSV
    let currentStatus = 'ENABLED'; // Default to ENABLED instead of DISABLED
    if (existsSync(csvFilePath)) {
      const content = await new Promise((resolve, reject) => {
        readFile(csvFilePath, 'utf8', (err, data) => {
          if (err) {
            if (err.code === 'EBUSY' || err.code === 'EACCES') {
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            resolve(data);
          }
        });
      });
      if (!content) return res.status(500).json({ error: 'File is busy, try again later' });
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.includes('[CONFIG]') && line.includes(`[${accountId}]`)) {
          const enabledMatch = line.match(/\[(ENABLED|DISABLED)\]/);
          if (enabledMatch) {
            currentStatus = enabledMatch[1];

            break;
          }
        }
      }
    }

    // Try to preserve the current ONLINE/OFFLINE status from the existing CSV
    let currentOnlineStatus = 'ONLINE'; // Default status
    try {
      const content = readFileSync(csvFilePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.includes('[STATUS]') && line.includes(`[${accountId}]`)) {
          const statusMatch = line.match(/\[(ONLINE|OFFLINE)\]/);
          if (statusMatch) {
            currentOnlineStatus = statusMatch[1];

            break;
          }
        }
      }
    } catch (error) {}

    // Generate new CSV2 format content for slave account (WITH SPACES)
    let csvContent = `[TYPE] [PENDING] [${platform}] [${accountId}]\n`;
    csvContent += `[STATUS] [${currentOnlineStatus}] [${currentTimestamp}]\n`;
    csvContent += `[CONFIG] [SLAVE] [${currentStatus}] [1.0] [NULL] [FALSE] [NULL] [NULL] [${masterId}] [${masterCsvPath}]\n`;

    // Write the slave account to CSV in new format with Unix line endings
    // Ensure we're writing to .csv not .cssv
    const correctPath = csvFilePath.replace(/\.cssv$/, '.csv');
    writeFileSync(correctPath, csvContent.replace(/\r\n/g, '\n'), 'utf8');

    return true;
  } catch (error) {
    console.error('Error updating CSV account to slave:', error);
    return false;
  }
};

// Delete master account
export const deleteMasterAccount = async (req, res) => {
  const { masterAccountId } = req.params;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  // If master account not found in userAccounts, try to sync from CSV files
  if (!userAccounts.masterAccounts[masterAccountId]) {
    try {
      const csvManager = await import('../services/csvManager.js')
        .then(m => m.default)
        .catch(() => null);

      if (csvManager && csvManager.csvFiles) {
        let foundInCSV = false;

        for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
          const masterAccount = fileData.data.find(
            account => account.account_id === masterAccountId && account.account_type === 'master'
          );

          if (masterAccount) {
            // Add to userAccounts
            if (!userAccounts.masterAccounts) userAccounts.masterAccounts = {};
            userAccounts.masterAccounts[masterAccountId] = {
              id: masterAccount.account_id,
              accountNumber: masterAccount.account_id,
              platform: masterAccount.platform || 'Unknown',
              server: masterAccount.server || '',
              password: masterAccount.password || '',
              status: masterAccount.status || 'offline',
              lastUpdated: new Date().toISOString(),
            };

            // Save updated userAccounts
            saveUserAccounts(apiKey, userAccounts);
            foundInCSV = true;

            break;
          }
        }

        if (!foundInCSV) {
          return res.status(404).json({
            error: `Master account ${masterAccountId} not found in your accounts or CSV files`,
          });
        }
      } else {
        return res.status(404).json({
          error: `Master account ${masterAccountId} not found in your accounts`,
        });
      }
    } catch (error) {
      console.error('Error syncing from CSV files:', error);
      return res.status(404).json({
        error: `Master account ${masterAccountId} not found in your accounts`,
      });
    }
  }

  // Get platform info before deleting
  const platform = userAccounts.masterAccounts[masterAccountId].platform || 'MT4';

  // Find and disconnect all connected slaves (both in user accounts and CSV files)
  let connectedSlaves = Object.entries(userAccounts.connections || {})
    .filter(([, masterId]) => masterId === masterAccountId)
    .map(([slaveId]) => slaveId);

  // Also sync slave accounts from CSV files if they're not in userAccounts
  try {
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);

    if (csvManager && csvManager.csvFiles) {
      for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
        fileData.data.forEach(account => {
          if (
            account.account_type === 'slave' &&
            account.config &&
            account.config.masterId === masterAccountId
          ) {
            // Add slave to userAccounts if not already there
            if (!userAccounts.slaveAccounts) userAccounts.slaveAccounts = {};
            if (!userAccounts.connections) userAccounts.connections = {};

            if (!userAccounts.slaveAccounts[account.account_id]) {
              userAccounts.slaveAccounts[account.account_id] = {
                id: account.account_id,
                accountNumber: account.account_id,
                platform: account.platform || 'Unknown',
                server: account.server || '',
                password: account.password || '',
                status: account.status || 'offline',
                config: account.config,
                lastUpdated: new Date().toISOString(),
              };
            }

            if (!userAccounts.connections[account.account_id]) {
              userAccounts.connections[account.account_id] = masterAccountId;
            }

            if (!connectedSlaves.includes(account.account_id)) {
              connectedSlaves.push(account.account_id);
            }
          }
        });
      }

      // Save updated userAccounts
      saveUserAccounts(apiKey, userAccounts);
    }
  } catch (error) {
    console.error('Error syncing slave accounts from CSV files:', error);
  }

  // Also check CSV files for slaves connected to this master
  try {
    const csvManager = await import('../services/csvManager.js')
      .then(m => m.default)
      .catch(() => null);
    if (csvManager && csvManager.csvFiles) {
      for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
        fileData.data.forEach(account => {
          if (
            account.account_type === 'slave' &&
            account.config &&
            account.config.masterId === masterAccountId &&
            !connectedSlaves.includes(account.account_id)
          ) {
            connectedSlaves.push(account.account_id);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking CSV files for connected slaves:', error);
  }

  // STEP 1: Disconnect all slaves in their CSV files first
  let slavesDisconnected = 0;
  if (connectedSlaves.length > 0) {
    // Import the disconnect function from slaveConfigController
    const { updateCSVFileToDisconnectSlave } = await import('./slaveConfigController.js');

    for (const slaveId of connectedSlaves) {
      try {
        // Find CSV files for this slave
        const csvManager = await import('../services/csvManager.js')
          .then(m => m.default)
          .catch(() => null);
        let slaveDisconnected = false;

        if (csvManager && csvManager.csvFiles) {
          for (const [filePath, fileData] of csvManager.csvFiles.entries()) {
            // Check if this file contains the slave account
            const accountExists = fileData.data.some(account => account.account_id === slaveId);

            if (accountExists) {
              // Disconnect the slave in this CSV file
              if (await updateCSVFileToDisconnectSlave(filePath, slaveId)) {
                slaveDisconnected = true;
                slavesDisconnected++;
                break; // Only update one file per slave
              }
            }
          }
        }

        if (!slaveDisconnected) {
        }
      } catch (error) {
        console.error(`Error disconnecting slave ${slaveId}:`, error);
      }
    }
  }

  // STEP 2: Remove connections from user accounts
  connectedSlaves.forEach(slaveId => {
    delete userAccounts.connections[slaveId];
  });

  // STEP 3: Delete master account from user accounts
  delete userAccounts.masterAccounts[masterAccountId];

  if (saveUserAccounts(apiKey, userAccounts)) {
    const csvWritten = await writeAccountToCSVAsPending(masterAccountId, platform);
    // Emit SSE event to notify frontend of account deletion
    try {
      const csvManager = await import('../services/csvManager.js');
      csvManager.default.emit('accountDeleted', {
        accountId: masterAccountId,
        accountType: 'master',
        apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error emitting accountDeleted event:', error);
    }

    res.json({
      message: 'Master account deleted successfully with proper slave disconnection',
      masterAccountId,
      disconnectedSlaves: connectedSlaves,
      slavesDisconnectedInCSV: slavesDisconnected,
      totalSlaves: connectedSlaves.length,
      csvWritten,
      status: 'deleted',
    });
  } else {
    res.status(500).json({ error: 'Failed to delete master account' });
  }
};

// Delete slave account
export const deleteSlaveAccount = (req, res) => {
  const { slaveAccountId } = req.params;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  if (!userAccounts.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found in your accounts`,
    });
  }

  const wasConnectedTo = userAccounts.connections[slaveAccountId];
  const slaveAccount = userAccounts.slaveAccounts[slaveAccountId];
  const platform = slaveAccount?.platform || 'MT4';

  delete userAccounts.connections[slaveAccountId];
  delete userAccounts.slaveAccounts[slaveAccountId];

  if (saveUserAccounts(apiKey, userAccounts)) {
    // STEP 2: Convert slave account to PENDING in CSV
    // Use the same method as master accounts to convert to pending
    writeAccountToCSVAsPending(slaveAccountId, platform)
      .then(csvWritten => {})
      .catch(error => {
        console.error(`Error converting slave ${slaveAccountId} to pending:`, error);
      });

    res.json({
      message: 'Slave account deleted successfully and converted to pending',
      slaveAccountId,
      wasConnectedTo: wasConnectedTo || null,
      status: 'deleted',
    });
  } else {
    res.status(500).json({ error: 'Failed to delete slave account' });
  }
};

// Get supported platforms
export const getSupportedPlatforms = (req, res) => {
  res.json({
    platforms: SUPPORTED_PLATFORMS.map(platform => {
      const platformInfo = {
        value: platform,
        label: platform,
        description: '',
      };

      switch (platform) {
        case 'MT4':
          platformInfo.label = 'MetaTrader 4';
          platformInfo.description = 'Popular forex trading platform with EA support';
          break;
        case 'MT5':
          platformInfo.label = 'MetaTrader 5';
          platformInfo.description = 'Advanced multi-asset trading platform';
          break;
        case 'cTrader':
          platformInfo.label = 'cTrader';
          platformInfo.description = 'Modern ECN trading platform';
          break;
        case 'TradingView':
          platformInfo.label = 'TradingView';
          platformInfo.description = 'Web-based charting and trading platform';
          break;
        case 'NinjaTrader':
          platformInfo.label = 'NinjaTrader';
          platformInfo.description = 'Professional futures and forex trading platform';
          break;
        case 'Other':
          platformInfo.label = 'Other Platform';
          platformInfo.description = 'Other trading platform not listed above';
          break;
      }

      return platformInfo;
    }),
    total: SUPPORTED_PLATFORMS.length,
  });
};

// ===== PENDING ACCOUNTS MANAGEMENT =====

// Get all pending accounts - Using cached CSV routes
export const getPendingAccounts = async (req, res) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key required - use requireValidSubscription middleware',
      });
    }

    const allPendingAccounts = [];

    try {
      // Get all active accounts from csvManager (which uses cached routes)
      const cachedAccounts = await csvManager.getAllActiveAccounts();

      // Process each cached pending account
      for (const account of cachedAccounts.pendingAccounts || []) {
        const accountId = account.account_id;
        const platform = account.platform;
        const timestamp = account.timestamp;
        const filePath = account.filePath;

        // TIMESTAMP VALIDATION LOGIC
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const accountTimestamp = parseInt(timestamp);
        const timeDifference = currentTime - accountTimestamp;

        // RULE 1: If more than 1 hour (3600 seconds) has passed, DON'T return the account
        if (timeDifference > 3600) {
          continue; // Skip this account
        }

        // RULE 2: Respect the original status from CSV, don't override based on timestamp
        let finalStatus = account.status || 'online';

        // Only apply timestamp-based logic if the account doesn't have a specific status
        if (!account.status) {
          if (timeDifference > 3) {
            finalStatus = 'offline';
          } else {
            finalStatus = 'online';
          }
        }

        const pendingAccount = {
          account_id: accountId,
          platform: platform,
          account_type: 'pending',
          status: finalStatus,
          timestamp: timestamp,
          filePath: filePath,
        };

        allPendingAccounts.push(pendingAccount);
      }
    } catch (error) {}

    const pendingAccountsArray = allPendingAccounts;

    // Convert to simple object format
    const pendingAccounts = {};
    pendingAccountsArray.forEach(account => {
      pendingAccounts[account.account_id] = {
        id: account.account_id,
        name: `Account ${account.account_id}`,
        platform: account.platform,
        status: account.status,
        current_status: account.status,
        timestamp: account.timestamp,
        config: account.config,
        filePath: account.filePath, // For debugging
      };
    });

    res.json({
      pendingAccounts,
      totalPending: pendingAccountsArray.length,
      message:
        pendingAccountsArray.length > 0
          ? `Found ${pendingAccountsArray.length} account(s) awaiting configuration`
          : 'No pending accounts found',
    });
  } catch (error) {
    console.error('Error getting pending accounts:', error);
    res.status(500).json({ error: 'Failed to get pending accounts' });
  }
};

// DISABLED: Cache endpoint removed - use /api/accounts/pending instead
export const getPendingAccountsFromCache = async (req, res) => {
  res.json({
    success: false,
    error: 'Cache endpoint disabled - use /api/accounts/pending instead',
    totalPending: 0,
    pendingAccounts: {},
    message: 'Cache endpoint disabled - use direct endpoint only',
    fromCache: false,
  });
};

// Convert pending account to master
export const convertPendingToMaster = async (req, res) => {
  const { accountId } = req.params;
  const { name, description, broker, platform } = req.body;
  const apiKey = req.apiKey;
  if (!apiKey) {
    return res
      .status(401)
      .json({ error: 'API Key required - use requireValidSubscription middleware' });
  }
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  try {
    const userAccounts = getUserAccounts(apiKey);
    // Check if account exists in pending
    if (!userAccounts.pendingAccounts || !userAccounts.pendingAccounts[accountId]) {
      return res.status(404).json({ error: `Pending account ${accountId} not found` });
    }
    // Check if account already exists as master or slave
    if (
      (userAccounts.masterAccounts && userAccounts.masterAccounts[accountId]) ||
      (userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId])
    ) {
      return res
        .status(409)
        .json({ error: `Account ${accountId} already exists as master or slave` });
    }
    // Get pending account data
    const pendingAccount = userAccounts.pendingAccounts[accountId];
    // Create master account
    const masterAccount = {
      id: accountId,
      name: name || pendingAccount.name,
      description: description || pendingAccount.description,
      broker: broker || 'Unknown',
      platform: platform || 'MT5',
      registeredAt: new Date().toISOString(),
      convertedFrom: 'pending',
      firstSeen: pendingAccount.firstSeen,
      lastActivity: pendingAccount.lastActivity || new Date().toISOString(), // Set current time if no lastActivity
      status: 'active',
    };
    // Move from pending to master
    if (!userAccounts.masterAccounts) userAccounts.masterAccounts = {};
    userAccounts.masterAccounts[accountId] = masterAccount;
    if (userAccounts.pendingAccounts) delete userAccounts.pendingAccounts[accountId];
    if (saveUserAccounts(apiKey, userAccounts)) {
      createDisabledMasterConfig(accountId, apiKey);
      createDefaultTradingConfig(accountId);

      // Update CSV file to reflect the master account conversion using new CSV2 format
      try {
        await updateCSVAccountToMaster(accountId, masterAccount.platform);
      } catch (error) {
        console.error('Error updating CSV for master conversion:', error);
        // Continue with success response even if CSV update fails
      }

      // Notify about account conversion
      notifyAccountConverted(accountId, 'pending', 'master', apiKey);
      notifyTradingConfigCreated(accountId, {
        lotMultiplier: 1.0,
        forceLot: null,
        reverseTrading: false,
      });

      res.json({
        message: 'Pending account successfully converted to master (copying disabled by default)',
        accountId,
        account: masterAccount,
        status: 'converted_to_master',
        copyingEnabled: false,
      });
      // Trigger background linking after conversion to master (only if not already running)
      try {
        if (!linkPlatformsController.isLinking) {
          linkPlatformsController.findAndSyncMQLFoldersManual();
        } else {
        }
      } catch {}
    } else {
      res.status(500).json({ error: 'Failed to save account configuration' });
    }
  } catch (error) {
    console.error('Error converting pending to master:', error);
    res.status(500).json({ error: 'Failed to convert pending account to master' });
  }
};

// Convert pending account to slave
export const convertPendingToSlave = async (req, res) => {
  const { accountId } = req.params;
  const { name, description, broker, platform, masterAccountId } = req.body;
  const apiKey = req.apiKey;
  if (!apiKey) {
    return res
      .status(401)
      .json({ error: 'API Key required - use requireValidSubscription middleware' });
  }
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  try {
    const userAccounts = getUserAccounts(apiKey);
    // Check if account exists in pending
    if (!userAccounts.pendingAccounts || !userAccounts.pendingAccounts[accountId]) {
      return res.status(404).json({ error: `Pending account ${accountId} not found` });
    }
    // Check if account already exists as master or slave
    if (
      (userAccounts.masterAccounts && userAccounts.masterAccounts[accountId]) ||
      (userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId])
    ) {
      return res
        .status(409)
        .json({ error: `Account ${accountId} already exists as master or slave` });
    }
    // If masterAccountId provided, validate it exists
    if (
      masterAccountId &&
      (!userAccounts.masterAccounts || !userAccounts.masterAccounts[masterAccountId])
    ) {
      return res.status(400).json({ error: `Master account ${masterAccountId} not found` });
    }
    // Get pending account data
    const pendingAccount = userAccounts.pendingAccounts[accountId];
    // Create slave account
    const slaveAccount = {
      id: accountId,
      name: name || pendingAccount.name,
      description: description || pendingAccount.description,
      broker: broker || 'Unknown',
      platform: platform || 'MT5',
      registeredAt: new Date().toISOString(),
      convertedFrom: 'pending',
      firstSeen: pendingAccount.firstSeen,
      lastActivity: pendingAccount.lastActivity || new Date().toISOString(), // Set current time if no lastActivity
      status: 'active',
    };
    // Move from pending to slave
    if (!userAccounts.slaveAccounts) userAccounts.slaveAccounts = {};
    userAccounts.slaveAccounts[accountId] = slaveAccount;
    if (userAccounts.pendingAccounts) delete userAccounts.pendingAccounts[accountId];
    // If masterAccountId provided, establish connection
    if (masterAccountId) {
      if (!userAccounts.connections) userAccounts.connections = {};
      userAccounts.connections[accountId] = masterAccountId;
    }
    if (saveUserAccounts(apiKey, userAccounts)) {
      createDisabledSlaveConfig(accountId);

      // Update CSV file to reflect the slave account conversion using new CSV2 format
      try {
        await updateCSVAccountToSlave(accountId, slaveAccount.platform, masterAccountId);
      } catch (error) {
        console.error('Error updating CSV for slave conversion:', error);
        // Continue with success response even if CSV update fails
      }

      // Notify about account conversion
      notifyAccountConverted(accountId, 'pending', 'slave', apiKey);

      // Prepare response with deployment information
      const responseData = {
        message: `Pending account successfully converted to slave${masterAccountId ? ' and connected to master' : ''} (copying disabled by default)`,
        accountId,
        account: slaveAccount,
        connectedTo: masterAccountId || null,
        status: 'converted_to_slave',
        copyingEnabled: false,
      };

      // Add deployment information if connected to master
      if (masterAccountId) {
        responseData.deployed = true;
        responseData.deploymentMessage = `Pending account ${accountId} has been converted to slave and deployed under master ${masterAccountId}`;
      }

      res.json(responseData);
      // Trigger background linking after conversion to slave (only if not already running)
      try {
        if (!linkPlatformsController.isLinking) {
          ('🔄 Triggering background Link Platforms after conversion to slave');
          linkPlatformsController.findAndSyncMQLFoldersManual();
        } else {
        }
      } catch {}
    } else {
      res.status(500).json({ error: 'Failed to save account configuration' });
    }
  } catch (error) {
    console.error('Error converting pending to slave:', error);
    res.status(500).json({ error: 'Failed to convert pending account to slave' });
  }
};

// Delete pending account
export const deletePendingAccount = (req, res) => {
  const { accountId } = req.params;
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  try {
    const userAccounts = getUserAccounts(apiKey);

    if (!userAccounts.pendingAccounts || !userAccounts.pendingAccounts[accountId]) {
      return res.status(404).json({
        error: `Pending account ${accountId} not found`,
      });
    }

    // Remove from pending accounts
    delete userAccounts.pendingAccounts[accountId];

    if (saveUserAccounts(apiKey, userAccounts)) {
      res.json({
        message: 'Pending account deleted successfully',
        accountId,
        status: 'deleted',
      });
    } else {
      res.status(500).json({ error: 'Failed to save account configuration' });
    }
  } catch (error) {
    console.error('Error deleting pending account:', error);
    res.status(500).json({ error: 'Failed to delete pending account' });
  }
};

// Get all accounts for admin UI (no authentication required)
export const getAllAccountsForAdmin = (req, res) => {
  try {
    const config = loadAccountsConfig();

    // Build the response in the same format as getAllAccounts but without auth
    const response = {
      masterAccounts: {},
      unconnectedSlaves: [],
      totalMasterAccounts: 0,
      totalSlaveAccounts: 0,
      totalConnections: 0,
    };

    // Process master accounts - add null checks
    response.totalMasterAccounts = config.masterAccounts
      ? Object.keys(config.masterAccounts).length
      : 0;

    // Process master accounts if they exist
    if (config.masterAccounts) {
      for (const [accountId, account] of Object.entries(config.masterAccounts)) {
        // Find connected slaves for this master
        const connectedSlaves = config.connections
          ? Object.entries(config.connections)
              .filter(([, masterId]) => masterId === accountId)
              .map(([slaveId]) => config.slaveAccounts && config.slaveAccounts[slaveId])
              .filter(Boolean)
          : [];

        response.masterAccounts[accountId] = {
          ...account,
          connectedSlaves,
          totalSlaves: connectedSlaves.length,
        };
      }
    }

    // Process unconnected slaves - add null checks
    if (config.slaveAccounts && config.connections) {
      response.unconnectedSlaves = Object.values(config.slaveAccounts)
        .filter(slave => !config.connections[slave.id])
        .map(slave => ({ id: slave.id, ...slave }));
    } else if (config.slaveAccounts) {
      // If no connections exist, all slaves are unconnected
      response.unconnectedSlaves = Object.values(config.slaveAccounts).map(slave => ({
        id: slave.id,
        ...slave,
      }));
    }

    // Count totals with null checks
    response.totalSlaveAccounts = config.slaveAccounts
      ? Object.keys(config.slaveAccounts).length
      : 0;
    response.totalConnections = config.connections ? Object.keys(config.connections).length : 0;

    res.json(response);
  } catch (error) {
    console.error('Error getting accounts for admin:', error);
    res.status(500).json({ error: 'Failed to get accounts for admin interface' });
  }
};

// Get account activity statistics
export const getAccountActivityStats = (req, res) => {
  try {
    const config = loadAccountsConfig();
    const now = new Date();
    const stats = {
      total: 0,
      synchronized: 0,
      pending: 0,
      offline: 0,
      error: 0,
      masters: {
        total: 0,
        synchronized: 0,
        pending: 0,
        offline: 0,
        error: 0,
      },
      slaves: {
        total: 0,
        synchronized: 0,
        pending: 0,
        offline: 0,
        error: 0,
      },
      activityDetails: [],
    };

    // Process master accounts with null checks
    if (config.masterAccounts) {
      for (const [accountId, account] of Object.entries(config.masterAccounts)) {
        stats.total++;
        stats.masters.total++;

        let status = account.status || 'active';

        // Check if master has connected slaves (real synchronization)
        const connectedSlaves = config.connections
          ? Object.entries(config.connections)
              .filter(([, masterId]) => masterId === accountId)
              .map(([slaveId]) => slaveId)
          : [];

        // Master is synchronized if it has at least one connected slave
        if (connectedSlaves.length > 0) {
          status = 'synchronized';
        } else if (status === 'active') {
          status = 'pending'; // Master without slaves is pending
        }

        stats[status] = (stats[status] || 0) + 1;
        stats.masters[status] = (stats.masters[status] || 0) + 1;

        // Calculate time since last activity
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.activityDetails.push({
          accountId,
          type: 'master',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
          connectedSlaves: connectedSlaves.length,
        });
      }
    }

    // Process slave accounts with null checks
    if (config.slaveAccounts) {
      for (const [accountId, account] of Object.entries(config.slaveAccounts)) {
        stats.total++;
        stats.slaves.total++;

        let status = account.status || 'active';

        // Check if slave is connected to a master (real synchronization)
        const connectedToMaster = config.connections && config.connections[accountId];

        // Slave is synchronized if it's connected to a master
        if (connectedToMaster) {
          status = 'synchronized';
        } else if (status === 'active') {
          status = 'pending'; // Slave without master is pending
        }

        stats[status] = (stats[status] || 0) + 1;
        stats.slaves[status] = (stats.slaves[status] || 0) + 1;

        // Calculate time since last activity
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.activityDetails.push({
          accountId,
          type: 'slave',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
          connectedTo: connectedToMaster || null,
        });
      }
    }

    // Process pending accounts with null checks
    if (config.pendingAccounts) {
      for (const [accountId, account] of Object.entries(config.pendingAccounts)) {
        stats.total++;

        let status = account.status || 'pending';

        stats[status] = (stats[status] || 0) + 1;

        // Calculate time since last activity
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.activityDetails.push({
          accountId,
          type: 'pending',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
        });
      }
    }

    res.json({
      message: 'Account activity statistics retrieved successfully',
      stats,
      activityTimeout: ACTIVITY_TIMEOUT,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error getting account activity stats:', error);
    res.status(500).json({ error: 'Failed to get account activity statistics' });
  }
};

// Simple ping endpoint for accounts to report activity
export const pingAccount = (req, res) => {
  // This endpoint will automatically update activity through the authenticateAccount middleware
  try {
    const accountInfo = req.accountInfo;

    res.json({
      message: 'Ping successful',
      accountId: accountInfo.accountId,
      accountType: accountInfo.type,
      timestamp: new Date().toISOString(),
      status: 'active',
    });
  } catch (error) {
    console.error('Error in ping endpoint:', error);
    res.status(500).json({ error: 'Failed to process ping' });
  }
};

export { checkAccountActivity };

// Get connectivity statistics (real synchronization status)
export const getConnectivityStats = (req, res) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key required - use requireValidSubscription middleware',
      });
    }

    const userAccounts = getUserAccounts(apiKey);
    const now = new Date();
    let userHasChanges = false;

    const stats = {
      total: 0,
      synchronized: 0,
      pending: 0,
      offline: 0,
      error: 0,
      masters: {
        total: 0,
        synchronized: 0,
        pending: 0,
        offline: 0,
        error: 0,
      },
      slaves: {
        total: 0,
        synchronized: 0,
        pending: 0,
        offline: 0,
        error: 0,
      },
      connectivityDetails: [],
    };

    // Process master accounts
    if (userAccounts.masterAccounts) {
      for (const [accountId, account] of Object.entries(userAccounts.masterAccounts)) {
        stats.total++;
        stats.masters.total++;

        // Check if master has connected slaves (real synchronization)
        const connectedSlaves = Object.entries(userAccounts.connections || {})
          .filter(([, masterId]) => masterId === accountId)
          .map(([slaveId]) => slaveId);

        // First check if account is offline due to inactivity
        // Prioritize recent activity over stored status
        const timeSinceActivity = account.lastActivity
          ? now - new Date(account.lastActivity)
          : null;
        const isOffline = timeSinceActivity && timeSinceActivity > ACTIVITY_TIMEOUT;

        // Update account status in database if it has recent activity
        if (
          timeSinceActivity &&
          timeSinceActivity < ACTIVITY_TIMEOUT &&
          account.status === 'offline'
        ) {
          account.status = 'active';
          userHasChanges = true;
        }

        // Check if copy trading is disabled for this master (for reference only)
        const copierStatus = loadUserCopierStatus(apiKey);
        const isCopyTradingDisabled =
          copierStatus.masterAccounts && copierStatus.masterAccounts[accountId] === false;

        let status;
        if (isOffline) {
          status = 'offline';
        } else if (connectedSlaves.length > 0) {
          status = 'synchronized';
        } else {
          status = 'active'; // Master without slaves is active (not connected)
        }

        stats[status] = (stats[status] || 0) + 1;
        stats.masters[status] = (stats.masters[status] || 0) + 1;

        stats.connectivityDetails.push({
          accountId,
          type: 'master',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
          connectedSlaves: connectedSlaves.length,
          connectedSlaveIds: connectedSlaves,
        });
      }
    }

    // Process slave accounts
    if (userAccounts.slaveAccounts) {
      for (const [accountId, account] of Object.entries(userAccounts.slaveAccounts)) {
        stats.total++;
        stats.slaves.total++;

        // Check if slave is connected to a master (real synchronization)
        const connectedToMaster = userAccounts.connections && userAccounts.connections[accountId];

        // First check if account is offline due to inactivity
        // Prioritize recent activity over stored status
        const timeSinceActivity = account.lastActivity
          ? now - new Date(account.lastActivity)
          : null;
        const isOffline = timeSinceActivity && timeSinceActivity > ACTIVITY_TIMEOUT;

        // Update account status in database if it has recent activity
        if (
          timeSinceActivity &&
          timeSinceActivity < ACTIVITY_TIMEOUT &&
          account.status === 'offline'
        ) {
          account.status = 'active';
          userHasChanges = true;
        }

        // Check if copy trading is disabled for this slave (for reference only)
        const slaveConfigs = loadSlaveConfigs();
        const isCopyTradingDisabled =
          slaveConfigs[accountId] && slaveConfigs[accountId].enabled === false;

        let status;
        if (isOffline) {
          status = 'offline';
        } else if (connectedToMaster) {
          status = 'synchronized';
        } else {
          status = 'pending'; // Slave without master is pending (not connected)
        }

        stats[status] = (stats[status] || 0) + 1;
        stats.slaves[status] = (stats.slaves[status] || 0) + 1;

        stats.connectivityDetails.push({
          accountId,
          type: 'slave',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
          connectedTo: connectedToMaster || null,
        });
      }
    }

    // Process pending accounts
    if (userAccounts.pendingAccounts) {
      for (const [accountId, account] of Object.entries(userAccounts.pendingAccounts)) {
        stats.total++;

        // For pending accounts, we need to respect their actual status
        // If they are offline, count them as offline, not pending
        let status = account.status || 'pending';

        stats[status] = (stats[status] || 0) + 1;

        // Calculate time since last activity
        let timeSinceActivity = null;
        if (account.lastActivity) {
          timeSinceActivity = now - new Date(account.lastActivity);
        }

        stats.connectivityDetails.push({
          accountId,
          type: 'pending',
          status,
          lastActivity: account.lastActivity,
          timeSinceActivity,
          isRecent: timeSinceActivity ? timeSinceActivity < ACTIVITY_TIMEOUT : false,
        });
      }
    }

    // Save changes if any were made
    if (userHasChanges) {
      saveUserAccounts(apiKey, userAccounts);
    }

    res.json({
      message: 'Connectivity statistics retrieved successfully',
      stats,
      activityTimeout: ACTIVITY_TIMEOUT,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error getting connectivity stats:', error);
    res.status(500).json({ error: 'Failed to get connectivity statistics' });
  }
};

// Unified endpoint that returns all account data in one call
export const getUnifiedAccountData = async (req, res) => {
  try {
    const startTime = Date.now();

    // SINGLE CSV READ: Get all data from csvManager in one call (reads all CSV files once)
    const allAccounts = await csvManager.getAllActiveAccounts();

    // Process all data from the single CSV read
    const currentTime = Math.floor(Date.now() / 1000);

    // Process pending accounts with timestamp validation
    const allPendingAccounts = [];
    const pendingAccountIds = new Set(); // Track pending account IDs to avoid duplicates

    for (const account of allAccounts.pendingAccounts || []) {
      const accountTimestamp = parseInt(account.timestamp);
      const timeDifference = currentTime - accountTimestamp;

      // RULE 1: If more than 1 hour (3600 seconds) has passed, DON'T return the account
      if (timeDifference > 3600) {
        continue; // Skip this account
      }

      // RULE 2: For pending accounts, respect their original status from CSV
      // Don't override the status based on timestamp difference
      let finalStatus = account.status || 'online';

      // Only apply timestamp-based logic if the account doesn't have a specific status
      if (!account.status) {
        if (timeDifference > 3) {
          finalStatus = 'offline';
        } else {
          finalStatus = 'online';
        }
      }

      const pendingAccount = {
        account_id: account.account_id,
        platform: account.platform,
        status: finalStatus,
        current_status: finalStatus,
        timestamp: accountTimestamp,
        timeDifference: timeDifference,
        filePath: account.filePath,
        lastActivity: new Date(accountTimestamp * 1000).toISOString(),
      };

      allPendingAccounts.push(pendingAccount);
      pendingAccountIds.add(account.account_id);
    }

    // Clean master accounts - remove invalid IDs like "ENABLED", "DISABLED", etc.
    const cleanMasterAccounts = {};
    Object.keys(allAccounts.masterAccounts || {}).forEach(masterId => {
      // Only include valid master account IDs (numeric or alphanumeric, not configuration values)
      const isValidMasterId =
        masterId &&
        masterId !== 'ENABLED' &&
        masterId !== 'DISABLED' &&
        masterId !== 'ON' &&
        masterId !== 'OFF' &&
        masterId !== 'NULL' &&
        !isNaN(parseInt(masterId)); // Must be a number

      if (isValidMasterId) {
        // Skip if this master account is already in pending accounts
        if (pendingAccountIds.has(masterId)) {
          return;
        }

        cleanMasterAccounts[masterId] = allAccounts.masterAccounts[masterId];

        const masterConfig = allAccounts.masterAccounts[masterId]?.config;
      }
    });

    // Clean unconnected slaves - remove duplicates and invalid configurations
    const cleanUnconnectedSlaves = [];
    const seenSlaveIds = new Set();

    (allAccounts.unconnectedSlaves || []).forEach(slave => {
      // Skip if we've already seen this slave ID
      if (seenSlaveIds.has(slave.id)) {
        return;
      }

      // Skip if this account is already in pending accounts
      if (pendingAccountIds.has(slave.id)) {
        // Only log once per session to avoid spam
        if (!this._loggedPendingSlaveSkips) {
          this._loggedPendingSlaveSkips = new Set();
        }
        if (!this._loggedPendingSlaveSkips.has(slave.id)) {
          this._loggedPendingSlaveSkips.add(slave.id);
        }
        return;
      }

      // Validate slave configuration
      const masterId = slave.config?.masterId;

      // Check if masterId is invalid
      const isInvalidMasterId =
        masterId &&
        (masterId === 'ENABLED' ||
          masterId === 'DISABLED' ||
          masterId === 'ON' ||
          masterId === 'OFF' ||
          masterId === 'NULL' ||
          isNaN(parseInt(masterId)));

      if (isInvalidMasterId) {
        return; // Skip this slave
      }

      // Clean the slave config if it has invalid masterId (shouldn't happen now, but just in case)
      if (
        masterId &&
        (masterId === 'ENABLED' ||
          masterId === 'DISABLED' ||
          masterId === 'ON' ||
          masterId === 'OFF' ||
          masterId === 'NULL')
      ) {
        slave.config.masterId = null;
      }

      cleanUnconnectedSlaves.push(slave);
      seenSlaveIds.add(slave.id);
    });

    // Clean slave accounts - remove duplicates with pending accounts
    const cleanSlaveAccounts = {};
    Object.keys(allAccounts.slaveAccounts || {}).forEach(slaveId => {
      // Skip if this slave account is already in pending accounts
      if (pendingAccountIds.has(slaveId)) {
        return;
      }

      cleanSlaveAccounts[slaveId] = allAccounts.slaveAccounts[slaveId];
    });

    // Get copier status from the cleaned data
    const copierStatus = csvManager.getCopierStatusFromAccounts({
      ...allAccounts,
      masterAccounts: cleanMasterAccounts,
      slaveAccounts: cleanSlaveAccounts,
    });

    // Calculate server statistics from the cleaned data
    const serverStats = {
      totalCSVFiles: csvManager.csvFiles.size,
      totalPendingAccounts: allPendingAccounts.length,

      // Count online accounts (all types)
      totalOnlineAccounts:
        // Pending accounts online
        allPendingAccounts.filter(acc => acc.status === 'online').length +
        // Master accounts online
        Object.values(cleanMasterAccounts).filter(acc => acc.status === 'online').length +
        // Slave accounts online (both connected and unconnected)
        Object.values(cleanSlaveAccounts).filter(acc => acc.status === 'online').length +
        cleanUnconnectedSlaves.filter(acc => acc.status === 'online').length,

      // Count offline accounts (all types)
      totalOfflineAccounts:
        // Pending accounts offline
        allPendingAccounts.filter(acc => acc.status === 'offline').length +
        // Master accounts offline
        Object.values(cleanMasterAccounts).filter(acc => acc.status === 'offline').length +
        // Slave accounts offline (both connected and unconnected)
        Object.values(cleanSlaveAccounts).filter(acc => acc.status === 'offline').length +
        cleanUnconnectedSlaves.filter(acc => acc.status === 'offline').length,

      totalMasterAccounts: Object.keys(cleanMasterAccounts).length,
      totalSlaveAccounts: Object.keys(cleanSlaveAccounts).length + cleanUnconnectedSlaves.length,
      totalUnconnectedSlaves: cleanUnconnectedSlaves.length,
    };

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        // Pending accounts with validation applied
        pendingAccounts: allPendingAccounts,

        // Configured accounts (masters and slaves) - ensure proper structure
        configuredAccounts: {
          masterAccounts: cleanMasterAccounts,
          slaveAccounts: cleanSlaveAccounts,
          unconnectedSlaves: cleanUnconnectedSlaves,
        },

        // Copier status and configuration
        copierStatus: {
          globalStatus: copierStatus.globalStatus || false,
          globalStatusText: copierStatus.globalStatusText || 'OFF',
          masterAccounts: copierStatus.masterAccounts || {},
          totalMasterAccounts: copierStatus.totalMasterAccounts || 0,
        },

        // Server statistics
        serverStats: serverStats,
      },

      // Metadata
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      csvFilesAccessed: csvManager.csvFiles.size,
      singleReadOperation: true, // Indicates this was a single CSV read operation
    });
  } catch (error) {
    console.error('❌ [UNIFIED] Error getting unified account data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unified account data',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
