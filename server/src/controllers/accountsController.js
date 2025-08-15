import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import csvManager from '../services/csvManager.js';
import {
  getUserAccounts,
  loadAccountsConfig,
  saveAccountsConfig,
  saveUserAccounts,
} from './configManager.js';
import {
  createDisabledMasterConfig,
  loadUserCopierStatus,
  saveUserCopierStatus,
} from './copierStatusController.js';
import {
  notifyAccountConverted,
  notifyAccountCreated,
  notifyTradingConfigCreated,
} from './eventNotifier.js';
import linkPlatformsController from './linkPlatformsController.js';
import {
  createDisabledSlaveConfig,
  loadSlaveConfigs,
  saveSlaveConfigs,
} from './slaveConfigController.js';
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
const checkAccountActivity = () => {
  try {
    const config = loadAccountsConfig();
    let hasChanges = false;
    const now = new Date();

    // Check all users' accounts
    for (const [apiKey, userAccounts] of Object.entries(config.userAccounts)) {
      // Skip if apiKey is undefined or null
      if (!apiKey) {
        console.warn('⚠️ Skipping user accounts with undefined apiKey');
        continue;
      }

      let userHasChanges = false;

      // Check master accounts for this user
      for (const [accountId, account] of Object.entries(userAccounts.masterAccounts)) {
        if (account.lastActivity) {
          const lastActivity = new Date(account.lastActivity);
          const timeSinceActivity = now - lastActivity;

          if (timeSinceActivity > ACTIVITY_TIMEOUT) {
            if (account.status !== 'offline') {
              account.status = 'offline';
              userHasChanges = true;
              console.log(
                `📴 Master account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
              );

              // Disable copy trading for offline master
              const copierStatus = loadUserCopierStatus(apiKey);
              if (copierStatus.masterAccounts[accountId] !== false) {
                copierStatus.masterAccounts[accountId] = false;
                saveUserCopierStatus(apiKey, copierStatus);
                console.log(`🚫 Copy trading disabled for offline master ${accountId}`);
              }

              // Disable copy trading for all connected slaves
              const connectedSlaves = Object.entries(userAccounts.connections || {})
                .filter(([, masterId]) => masterId === accountId)
                .map(([slaveId]) => slaveId);

              if (connectedSlaves.length > 0) {
                const slaveConfigs = loadSlaveConfigs();
                let slavesUpdated = false;

                connectedSlaves.forEach(slaveId => {
                  if (slaveConfigs[slaveId] && slaveConfigs[slaveId].enabled === true) {
                    slaveConfigs[slaveId].enabled = false;
                    slavesUpdated = true;
                    console.log(
                      `🚫 Copy trading disabled for connected slave ${slaveId} (master ${accountId} offline)`
                    );
                  }
                });

                if (slavesUpdated) {
                  saveSlaveConfigs(slaveConfigs);
                }
                console.log(
                  `📴 Disabled ${connectedSlaves.length} connected slave(s) for offline master ${accountId}`
                );
              }
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'active';
              userHasChanges = true;
              console.log(
                `📡 Master account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) back online`
              );
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            userHasChanges = true;
            console.log(
              `📴 Master account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) has no activity, marked as offline`
            );

            // Disable copy trading for offline master
            const copierStatus = loadUserCopierStatus(apiKey);
            if (copierStatus.masterAccounts[accountId] !== false) {
              copierStatus.masterAccounts[accountId] = false;
              saveUserCopierStatus(apiKey, copierStatus);
              console.log(`🚫 Copy trading disabled for offline master ${accountId}`);
            }

            // Disable copy trading for all connected slaves
            const connectedSlaves = Object.entries(userAccounts.connections || {})
              .filter(([, masterId]) => masterId === accountId)
              .map(([slaveId]) => slaveId);

            if (connectedSlaves.length > 0) {
              const slaveConfigs = loadSlaveConfigs();
              let slavesUpdated = false;

              connectedSlaves.forEach(slaveId => {
                if (slaveConfigs[slaveId] && slaveConfigs[slaveId].enabled === false) {
                  slaveConfigs[slaveId].enabled = false;
                  slavesUpdated = true;
                  console.log(
                    `🚫 Copy trading disabled for connected slave ${slaveId} (master ${accountId} offline)`
                  );
                }
              });

              if (slavesUpdated) {
                saveSlaveConfigs(slaveConfigs);
              }
              console.log(
                `📴 Disabled ${connectedSlaves.length} connected slave(s) for offline master ${accountId}`
              );
            }
          }
        }
      }

      // Check slave accounts for this user
      for (const [accountId, account] of Object.entries(userAccounts.slaveAccounts)) {
        if (account.lastActivity) {
          const lastActivity = new Date(account.lastActivity);
          const timeSinceActivity = now - lastActivity;

          if (timeSinceActivity > ACTIVITY_TIMEOUT) {
            if (account.status !== 'offline') {
              account.status = 'offline';
              userHasChanges = true;
              console.log(
                `📴 Slave account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
              );

              // Disable copy trading for offline slave
              const slaveConfigs = loadSlaveConfigs();
              if (
                slaveConfigs[accountId] &&
                slaveConfigs[accountId].config &&
                slaveConfigs[accountId].config.enabled === true
              ) {
                slaveConfigs[accountId].config.enabled = false;
                slaveConfigs[accountId].lastUpdated = new Date().toISOString();
                saveSlaveConfigs(slaveConfigs);
                console.log(`🚫 Copy trading disabled for offline slave ${accountId}`);
              }
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'active';
              userHasChanges = true;
              console.log(
                `📡 Slave account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) back online`
              );
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            userHasChanges = true;
            console.log(
              `📴 Slave account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) has no activity, marked as offline`
            );

            // Disable copy trading for offline slave
            const slaveConfigs = loadSlaveConfigs();
            if (
              slaveConfigs[accountId] &&
              slaveConfigs[accountId].config &&
              slaveConfigs[accountId].config.enabled === true
            ) {
              slaveConfigs[accountId].config.enabled = false;
              slaveConfigs[accountId].lastUpdated = new Date().toISOString();
              saveSlaveConfigs(slaveConfigs);
              console.log(`🚫 Copy trading disabled for offline slave ${accountId}`);
            }
          }
        }
      }

      // Check pending accounts for this user
      const accountsToDelete = [];

      for (const [accountId, account] of Object.entries(userAccounts.pendingAccounts)) {
        if (account.lastActivity) {
          const lastActivity = new Date(account.lastActivity);
          const timeSinceActivity = now - lastActivity;

          // Check if account should be deleted (1 hour offline)
          if (timeSinceActivity > PENDING_DELETION_TIMEOUT) {
            accountsToDelete.push(accountId);
            console.log(
              `🗑️ Pending account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) marked for deletion (${Math.round(timeSinceActivity / 1000 / 60)} minutes inactive)`
            );
          } else if (timeSinceActivity > ACTIVITY_TIMEOUT) {
            if (account.status !== 'offline') {
              account.status = 'offline';
              userHasChanges = true;
              console.log(
                `📴 Pending account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
              );
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'pending';
              userHasChanges = true;
              console.log(
                `📡 Pending account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) back online`
              );
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            userHasChanges = true;
            console.log(
              `📴 Pending account ${accountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) has no activity, marked as offline`
            );
          }
        }
      }

      // Delete accounts that have been offline for more than 1 hour
      for (const accountId of accountsToDelete) {
        delete userAccounts.pendingAccounts[accountId];
        userHasChanges = true;
        console.log(`🗑️ Deleted pending account ${accountId} after 1 hour of inactivity`);
      }

      if (userHasChanges) {
        hasChanges = true;
      }
    }

    // Save changes if any were made
    if (hasChanges) {
      saveAccountsConfig(config);

      // Emit event to notify frontend of pending account changes
      console.log('📢 Emitting pending accounts update due to activity changes');

      // Collect all pending accounts from all users for the update
      const allPendingAccounts = [];
      for (const [apiKey, userAccounts] of Object.entries(config.users || {})) {
        if (userAccounts.pendingAccounts) {
          for (const [accountId, account] of Object.entries(userAccounts.pendingAccounts)) {
            allPendingAccounts.push({
              account_id: accountId,
              platform: account.platform || 'Unknown',
              timestamp: account.lastActivity || account.createdAt || new Date().toISOString(),
              status: account.status || 'offline',
              current_status: account.status || 'offline',
              filePath: 'registered_accounts.json',
            });
          }
        }
      }

      // Emit the update event
      csvManager.emit('pendingAccountsUpdate', {
        accounts: allPendingAccounts,
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
  console.log('🔍 Starting account activity monitoring (5-second timeout)...');

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

    console.log(
      `Master account registered: ${masterAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) (copying disabled by default)`
    );
    res.json({
      message: 'Master account registered successfully (copying disabled by default)',
      account: userAccounts.masterAccounts[masterAccountId],
      status: 'success',
      copyingEnabled: false,
    });
    // Trigger background linking after registering master
    try {
      linkPlatformsController.findAndSyncMQLFoldersManual();
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

    console.log(
      `Slave account registered: ${slaveAccountId}${masterAccountId ? ` -> ${masterAccountId}` : ''} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) (copying disabled by default)`
    );

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
    // Trigger background linking after registering slave
    try {
      linkPlatformsController.findAndSyncMQLFoldersManual();
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
    console.log(`Connection established: ${slaveAccountId} -> ${masterAccountId}`);
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
    console.log(`Slave ${slaveAccountId} disconnected from ${previousConnection || 'unconnected'}`);
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
    // Get accounts from CSV instead of JSON
    const accounts = await csvManager.getAllActiveAccounts();

    // Calculate statistics
    const totalMasterAccounts = Object.keys(accounts.masterAccounts).length;
    const totalSlaveAccounts = Object.keys(accounts.slaveAccounts).length;
    const totalConnections = Object.values(accounts.masterAccounts).reduce(
      (sum, master) => sum + master.connectedSlaves.length,
      0
    );

    res.json({
      masterAccounts: accounts.masterAccounts,
      unconnectedSlaves: accounts.unconnectedSlaves,
      totalMasterAccounts,
      totalSlaveAccounts,
      totalConnections,
    });
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
    console.log(
      `Master account updated: ${masterAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...)`
    );
    res.json({
      message: 'Master account updated successfully',
      account: userAccounts.masterAccounts[masterAccountId],
      status: 'success',
    });
    // Trigger background linking after master update
    try {
      linkPlatformsController.findAndSyncMQLFoldersManual();
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
      console.log(`Connection established: ${slaveAccountId} -> ${masterAccountId}`);
    } else {
      // Remove connection if masterAccountId is empty, 'none', or null
      delete userAccounts.connections[slaveAccountId];
      console.log(`Connection removed for slave: ${slaveAccountId}`);
    }
  }

  if (saveUserAccounts(apiKey, userAccounts)) {
    console.log(
      `Slave account updated: ${slaveAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...)`
    );
    res.json({
      message: 'Slave account updated successfully',
      account: userAccounts.slaveAccounts[slaveAccountId],
      connectedTo: userAccounts.connections[slaveAccountId] || null,
      status: 'success',
    });
    // Trigger background linking after slave update
    try {
      linkPlatformsController.findAndSyncMQLFoldersManual();
    } catch {}
  } else {
    res.status(500).json({ error: 'Failed to update slave account' });
  }
};

// Function to write account back to CSV as PENDING using new CSV2 format
const writeAccountToCSVAsPending = async (accountId, platform = 'MT4') => {
  try {
    // Choose the appropriate CSV file based on platform
    const csvFilePath =
      platform === 'MT5'
        ? '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv'
        : '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    if (!existsSync(csvFilePath)) {
      console.log('⚠️ CSV file not found, skipping CSV write');
      return false;
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Generate new CSV2 format content for pending account (WITH SPACES)
    let csvContent = `[TYPE] [PENDING] [${platform}] [${accountId}]\n`;
    csvContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
    csvContent += `[CONFIG] [PENDING]\n`;

    // Write the pending account to CSV in new format
    writeFileSync(csvFilePath, csvContent, 'utf8');
    console.log(`📝 Wrote account ${accountId} back to CSV as PENDING using new CSV2 format:`);
    console.log(csvContent);
    return true;
  } catch (error) {
    console.error('Error writing account to CSV as pending:', error);
    return false;
  }
};

// Function to update CSV account to MASTER using new CSV2 format
const updateCSVAccountToMaster = async (accountId, platform = 'MT4') => {
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
      console.log('⚠️ No CSV file found containing this account, skipping CSV write');
      return false;
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Generate new CSV2 format content for master account (WITH SPACES)
    let csvContent = `[TYPE] [PENDING] [${platform}] [${accountId}]\n`;
    csvContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
    csvContent += `[CONFIG] [MASTER] [DISABLED] [Account ${accountId}]\n`;

    // Write the master account to CSV in new format
    writeFileSync(csvFilePath, csvContent, 'utf8');
    console.log(`📝 Updated CSV account ${accountId} to MASTER using new CSV2 format:`);
    console.log(csvContent);
    return true;
  } catch (error) {
    console.error('Error updating CSV account to master:', error);
    return false;
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
      console.log('⚠️ No CSV file found containing this account, skipping CSV write');
      return false;
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Generate new CSV2 format content for slave account (WITH SPACES)
    let csvContent = `[TYPE] [PENDING] [${platform}] [${accountId}]\n`;
    csvContent += `[STATUS] [ONLINE] [${currentTimestamp}]\n`;
    csvContent += `[CONFIG] [SLAVE] [DISABLED] [1.0] [NULL] [FALSE] [NULL] [NULL] [${masterId}]\n`;

    // Write the slave account to CSV in new format
    writeFileSync(csvFilePath, csvContent, 'utf8');
    console.log(`📝 Updated CSV account ${accountId} to SLAVE using new CSV2 format:`);
    console.log(csvContent);
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

  if (!userAccounts.masterAccounts[masterAccountId]) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} not found in your accounts`,
    });
  }

  // Get platform info before deleting
  const platform = userAccounts.masterAccounts[masterAccountId].platform || 'MT4';

  // Find and disconnect all connected slaves within user's accounts
  const connectedSlaves = Object.entries(userAccounts.connections)
    .filter(([, masterId]) => masterId === masterAccountId)
    .map(([slaveId]) => slaveId);

  connectedSlaves.forEach(slaveId => {
    delete userAccounts.connections[slaveId];
  });

  delete userAccounts.masterAccounts[masterAccountId];

  if (saveUserAccounts(apiKey, userAccounts)) {
    console.log(
      `Master account deleted: ${masterAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...), disconnected slaves: ${connectedSlaves.join(', ')}`
    );

    // Write account back to CSV as PENDING
    console.log(`🔧 Attempting to write account ${masterAccountId} back to CSV as PENDING...`);
    const csvWritten = await writeAccountToCSVAsPending(masterAccountId, platform);
    if (csvWritten) {
      console.log(`📝 Account ${masterAccountId} written back to CSV as PENDING`);
    } else {
      console.log(`❌ Failed to write account ${masterAccountId} back to CSV as PENDING`);
    }

    // Emit SSE event to notify frontend of account deletion
    try {
      const csvManager = await import('../services/csvManager.js'); // Await import
      csvManager.default.emit('accountDeleted', {
        accountId: masterAccountId,
        accountType: 'master',
        apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
        timestamp: new Date().toISOString(),
      });
      console.log(`📢 SSE: Emitted accountDeleted event for master ${masterAccountId}`);
    } catch (error) {
      console.error('Error emitting accountDeleted event:', error);
    }

    res.json({
      message: 'Master account deleted successfully and written back to CSV as PENDING',
      masterAccountId,
      disconnectedSlaves: connectedSlaves,
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
  delete userAccounts.connections[slaveAccountId];
  delete userAccounts.slaveAccounts[slaveAccountId];

  if (saveUserAccounts(apiKey, userAccounts)) {
    console.log(
      `Slave account deleted: ${slaveAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...)${wasConnectedTo ? ` (was connected to ${wasConnectedTo})` : ''}`
    );
    res.json({
      message: 'Slave account deleted successfully',
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

// Get all pending accounts
export const getPendingAccounts = async (req, res) => {
  try {
    const apiKey = req.apiKey; // Set by requireValidSubscription middleware
    if (!apiKey) {
      return res
        .status(401)
        .json({ error: 'API Key required - use requireValidSubscription middleware' });
    }

    // Get pending accounts from CSV instead of JSON
    const allAccounts = await csvManager.getAllActiveAccounts();
    const pendingAccountsArray = allAccounts.pendingAccounts || [];
    const pendingCount = pendingAccountsArray.length;

    // Convert array to object format for backward compatibility
    const pendingAccounts = {};
    pendingAccountsArray.forEach(account => {
      pendingAccounts[account.account_id] = {
        id: account.account_id,
        name: `Account ${account.account_id}`,
        platform: account.platform,
        status: account.status,
        current_status: account.current_status || account.status, // Agregar current_status para compatibilidad
        timestamp: account.timestamp,
        config: account.config,
      };
    });

    res.json({
      pendingAccounts,
      totalPending: pendingCount,
      message:
        pendingCount > 0
          ? `Found ${pendingCount} account(s) awaiting configuration`
          : 'No pending accounts found',
    });
  } catch (error) {
    console.error('Error getting pending accounts:', error);
    res.status(500).json({ error: 'Failed to get pending accounts' });
  }
};

// Get pending accounts from cache (for immediate loading on app start)
export const getPendingAccountsFromCache = async (req, res) => {
  try {
    const apiKey = req.apiKey; // Set by requireValidSubscription middleware
    if (!apiKey) {
      return res
        .status(401)
        .json({ error: 'API Key required - use requireValidSubscription middleware' });
    }

    // Forzar carga desde cache si no hay archivos cargados
    if (csvManager.csvFiles.size === 0) {
      console.log('📋 No CSV files loaded, attempting to load from cache...');
      const cachedPaths = csvManager.loadCSVPathsFromCache();
      if (cachedPaths.length > 0) {
        cachedPaths.forEach(filePath => {
          if (existsSync(filePath)) {
            csvManager.csvFiles.set(filePath, {
              lastModified: csvManager.getFileLastModified(filePath),
              data: csvManager.parseCSVFile(filePath),
            });
          }
        });
        console.log(`📋 Loaded ${csvManager.csvFiles.size} CSV files from cache`);
      }
    }

    // Get pending accounts from CSV
    const allAccounts = await csvManager.getAllActiveAccounts();
    const pendingAccountsArray = allAccounts.pendingAccounts || [];
    const pendingCount = pendingAccountsArray.length;

    // Convert array to object format for backward compatibility
    const pendingAccounts = {};
    pendingAccountsArray.forEach(account => {
      pendingAccounts[account.account_id] = {
        id: account.account_id,
        name: `Account ${account.account_id}`,
        platform: account.platform,
        status: account.status,
        current_status: account.current_status || account.status, // Agregar current_status para compatibilidad
        timestamp: account.timestamp,
        config: account.config,
      };
    });

    res.json({
      pendingAccounts,
      totalPending: pendingCount,
      message:
        pendingCount > 0
          ? `Found ${pendingCount} account(s) awaiting configuration (from cache)`
          : 'No pending accounts found',
      fromCache: csvManager.csvFiles.size > 0,
    });
  } catch (error) {
    console.error('Error getting pending accounts from cache:', error);
    res.status(500).json({ error: 'Failed to get pending accounts from cache' });
  }
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
        console.log(`✅ Updated CSV file for account ${accountId} conversion to master`);
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
      // Trigger background linking after conversion to master
      try {
        linkPlatformsController.findAndSyncMQLFoldersManual();
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
        console.log(`✅ Updated CSV file for account ${accountId} conversion to slave`);
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
      // Trigger background linking after conversion to slave
      try {
        linkPlatformsController.findAndSyncMQLFoldersManual();
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
      console.log(`🗑️ Pending account ${accountId} deleted`);
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
    console.log(`🔍 Using API key: ${apiKey.substring(0, 8)}...`);
    console.log(
      `📊 Found ${Object.keys(userAccounts.masterAccounts || {}).length} master accounts, ${Object.keys(userAccounts.slaveAccounts || {}).length} slave accounts, ${Object.keys(userAccounts.pendingAccounts || {}).length} pending accounts`
    );
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

        console.log(
          `🔍 Master ${accountId}: timeSinceActivity=${timeSinceActivity}ms, ACTIVITY_TIMEOUT=${ACTIVITY_TIMEOUT}ms, isOffline=${isOffline}, lastActivity=${account.lastActivity}`
        );

        // Update account status in database if it has recent activity
        if (
          timeSinceActivity &&
          timeSinceActivity < ACTIVITY_TIMEOUT &&
          account.status === 'offline'
        ) {
          console.log(
            `🔄 Reactivating master ${accountId} (${timeSinceActivity}ms < ${ACTIVITY_TIMEOUT}ms)`
          );
          account.status = 'active';
          userHasChanges = true;
        }

        // Check if copy trading is disabled for this master (for reference only)
        const copierStatus = loadUserCopierStatus(apiKey);
        const isCopyTradingDisabled =
          copierStatus.masterAccounts && copierStatus.masterAccounts[accountId] === false;

        console.log(
          `🔍 Master ${accountId}: isOffline=${isOffline}, isCopyTradingDisabled=${isCopyTradingDisabled}, connectedSlaves=${connectedSlaves.length}`
        );

        let status;
        if (isOffline) {
          status = 'offline';
          console.log(`📴 Master ${accountId} marked as offline: isOffline=${isOffline}`);
        } else if (connectedSlaves.length > 0) {
          status = 'synchronized';
          console.log(
            `🔗 Master ${accountId} marked as synchronized: ${connectedSlaves.length} slaves`
          );
        } else {
          status = 'active'; // Master without slaves is active (not connected)
          console.log(`✅ Master ${accountId} marked as active: no slaves connected`);
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
          console.log(
            `🔄 Reactivating slave ${accountId} (${timeSinceActivity}ms < ${ACTIVITY_TIMEOUT}ms)`
          );
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
      console.log(`💾 Saving account status changes for user ${apiKey.substring(0, 8)}...`);
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
