import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
    createDisabledMasterConfig,
    loadCopierStatus,
    saveCopierStatus,
} from './copierStatusController.js';
import {
    createDisabledSlaveConfig,
    loadSlaveConfigs,
    saveSlaveConfigs,
} from './slaveConfigController.js';

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

// Load accounts configuration
const loadAccountsConfig = () => {
  initializeAccountsConfig();
  try {
    const data = readFileSync(accountsFilePath, 'utf8');
    const config = JSON.parse(data);

    // Migrate old structure if needed
    if (!config.userAccounts && (config.masterAccounts || config.slaveAccounts)) {
      console.log('⚠️  Detected old account structure, migrating to user-based structure...');
      const migratedConfig = {
        userAccounts: {},
        globalData: {
          lastMigration: new Date().toISOString(),
          version: '2.0',
        },
      };

      // Save migrated structure (old data will be lost since we don't know which user it belongs to)
      writeFileSync(accountsFilePath, JSON.stringify(migratedConfig, null, 2));
      console.log(
        '✅ Migration completed. Old account data has been cleared due to lack of user association.'
      );
      return migratedConfig;
    }

    return config;
  } catch (error) {
    console.error('Error loading accounts config:', error);
    return {
      userAccounts: {},
      globalData: {
        lastMigration: null,
        version: '2.0',
      },
    };
  }
};

// Save accounts configuration
const saveAccountsConfig = config => {
  try {
    writeFileSync(accountsFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving accounts config:', error);
    return false;
  }
};

// Get user-specific accounts structure
const getUserAccounts = apiKey => {
  const config = loadAccountsConfig();
  if (!config.userAccounts[apiKey]) {
    config.userAccounts[apiKey] = {
      masterAccounts: {},
      slaveAccounts: {},
      pendingAccounts: {},
      connections: {}, // slaveId -> masterAccountId mapping
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    saveAccountsConfig(config);
  }
  return config.userAccounts[apiKey];
};

// Save user-specific accounts
const saveUserAccounts = (apiKey, userAccounts) => {
  const config = loadAccountsConfig();
  config.userAccounts[apiKey] = {
    ...userAccounts,
    lastActivity: new Date().toISOString(),
  };
  return saveAccountsConfig(config);
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

// Define supported platforms
const SUPPORTED_PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'NinjaTrader', 'Other'];

// Activity monitoring configuration
const ACTIVITY_TIMEOUT = 5000; // 5 seconds in milliseconds

// Check and update account status based on activity
const checkAccountActivity = () => {
  try {
    const config = loadAccountsConfig();
    let hasChanges = false;
    const now = new Date();

    // Check all users' accounts
    for (const [apiKey, userAccounts] of Object.entries(config.userAccounts)) {
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
                `📴 Master account ${accountId} (user: ${apiKey.substring(0, 8)}...) marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
              );

              // Disable copy trading for offline master
              const copierStatus = loadCopierStatus();
              if (copierStatus.masterAccounts[accountId] !== false) {
                copierStatus.masterAccounts[accountId] = false;
                saveCopierStatus(copierStatus);
                console.log(`🚫 Copy trading disabled for offline master ${accountId}`);
              }
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'active';
              userHasChanges = true;
              console.log(
                `📡 Master account ${accountId} (user: ${apiKey.substring(0, 8)}...) back online`
              );
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            userHasChanges = true;
            console.log(
              `📴 Master account ${accountId} (user: ${apiKey.substring(0, 8)}...) has no activity, marked as offline`
            );

            // Disable copy trading for offline master
            const copierStatus = loadCopierStatus();
            if (copierStatus.masterAccounts[accountId] !== false) {
              copierStatus.masterAccounts[accountId] = false;
              saveCopierStatus(copierStatus);
              console.log(`🚫 Copy trading disabled for offline master ${accountId}`);
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
                `📴 Slave account ${accountId} (user: ${apiKey.substring(0, 8)}...) marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
              );

              // Disable copy trading for offline slave
              const slaveConfigs = loadSlaveConfigs();
              if (slaveConfigs[accountId] && slaveConfigs[accountId].enabled !== false) {
                slaveConfigs[accountId].enabled = false;
                saveSlaveConfigs(slaveConfigs);
                console.log(`🚫 Copy trading disabled for offline slave ${accountId}`);
              }
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'active';
              userHasChanges = true;
              console.log(
                `📡 Slave account ${accountId} (user: ${apiKey.substring(0, 8)}...) back online`
              );
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            userHasChanges = true;
            console.log(
              `📴 Slave account ${accountId} (user: ${apiKey.substring(0, 8)}...) has no activity, marked as offline`
            );

            // Disable copy trading for offline slave
            const slaveConfigs = loadSlaveConfigs();
            if (slaveConfigs[accountId] && slaveConfigs[accountId].enabled !== false) {
              slaveConfigs[accountId].enabled = false;
              saveSlaveConfigs(slaveConfigs);
              console.log(`🚫 Copy trading disabled for offline slave ${accountId}`);
            }
          }
        }
      }

      // Check pending accounts for this user
      for (const [accountId, account] of Object.entries(userAccounts.pendingAccounts)) {
        if (account.lastActivity) {
          const lastActivity = new Date(account.lastActivity);
          const timeSinceActivity = now - lastActivity;

          if (timeSinceActivity > ACTIVITY_TIMEOUT) {
            if (account.status !== 'offline') {
              account.status = 'offline';
              userHasChanges = true;
              console.log(
                `📴 Pending account ${accountId} (user: ${apiKey.substring(0, 8)}...) marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
              );
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'pending';
              userHasChanges = true;
              console.log(
                `📡 Pending account ${accountId} (user: ${apiKey.substring(0, 8)}...) back online`
              );
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            userHasChanges = true;
            console.log(
              `📴 Pending account ${accountId} (user: ${apiKey.substring(0, 8)}...) has no activity, marked as offline`
            );
          }
        }
      }

      if (userHasChanges) {
        hasChanges = true;
      }
    }

    // Save changes if any were made
    if (hasChanges) {
      saveAccountsConfig(config);
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
    createDisabledMasterConfig(masterAccountId);

    console.log(
      `Master account registered: ${masterAccountId} (user: ${apiKey.substring(0, 8)}...) (copying disabled by default)`
    );
    res.json({
      message: 'Master account registered successfully (copying disabled by default)',
      account: userAccounts.masterAccounts[masterAccountId],
      status: 'success',
      copyingEnabled: false,
    });
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
      `Slave account registered: ${slaveAccountId}${masterAccountId ? ` -> ${masterAccountId}` : ''} (user: ${apiKey.substring(0, 8)}...) (copying disabled by default)`
    );
    res.json({
      message: 'Slave account registered successfully (copying disabled by default)',
      account: userAccounts.slaveAccounts[slaveAccountId],
      connectedTo: masterAccountId || null,
      status: 'success',
      copyingEnabled: false,
    });
  } else {
    res.status(500).json({ error: 'Failed to register slave account' });
  }
};

// Connect slave to master account
export const connectSlaveToMaster = (req, res) => {
  const { slaveAccountId, masterAccountId } = req.body;

  if (!slaveAccountId || !masterAccountId) {
    return res.status(400).json({
      error: 'Both slaveAccountId and masterAccountId are required',
    });
  }

  const config = loadAccountsConfig();

  if (!config.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} is not registered`,
    });
  }

  if (!config.masterAccounts[masterAccountId]) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} is not registered`,
    });
  }

  config.connections[slaveAccountId] = masterAccountId;

  if (saveAccountsConfig(config)) {
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

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const config = loadAccountsConfig();

  if (!config.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} is not registered`,
    });
  }

  const previousConnection = config.connections[slaveAccountId];
  delete config.connections[slaveAccountId];

  if (saveAccountsConfig(config)) {
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
export const getAllAccounts = (req, res) => {
  const apiKey = req.apiKey; // Should be set by requireValidSubscription middleware

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required - use requireValidSubscription middleware',
    });
  }

  // Get user-specific accounts
  const userAccounts = getUserAccounts(apiKey);

  const masterAccountsWithSlaves = {};
  Object.entries(userAccounts.masterAccounts).forEach(([masterId, masterData]) => {
    const connectedSlaves = Object.entries(userAccounts.connections)
      .filter(([, connectedMasterId]) => connectedMasterId === masterId)
      .map(([slaveId]) => ({
        id: slaveId,
        ...userAccounts.slaveAccounts[slaveId],
      }));

    masterAccountsWithSlaves[masterId] = {
      ...masterData,
      connectedSlaves,
      totalSlaves: connectedSlaves.length,
    };
  });

  const unconnectedSlaves = Object.entries(userAccounts.slaveAccounts)
    .filter(([slaveId]) => !userAccounts.connections[slaveId])
    .map(([slaveId, slaveData]) => ({ id: slaveId, ...slaveData }));

  res.json({
    masterAccounts: masterAccountsWithSlaves,
    unconnectedSlaves,
    totalMasterAccounts: Object.keys(userAccounts.masterAccounts).length,
    totalSlaveAccounts: Object.keys(userAccounts.slaveAccounts).length,
    totalConnections: Object.keys(userAccounts.connections).length,
  });
};

// Update master account
export const updateMasterAccount = (req, res) => {
  const { masterAccountId } = req.params;
  const { name, description, broker, platform, status } = req.body;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const config = loadAccountsConfig();

  if (!config.masterAccounts[masterAccountId]) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} not found`,
    });
  }

  // Update fields if provided
  if (name !== undefined) config.masterAccounts[masterAccountId].name = name;
  if (description !== undefined) config.masterAccounts[masterAccountId].description = description;
  if (broker !== undefined) config.masterAccounts[masterAccountId].broker = broker;
  if (platform !== undefined) config.masterAccounts[masterAccountId].platform = platform;
  if (status !== undefined) config.masterAccounts[masterAccountId].status = status;

  config.masterAccounts[masterAccountId].lastUpdated = new Date().toISOString();

  if (saveAccountsConfig(config)) {
    console.log(`Master account updated: ${masterAccountId}`);
    res.json({
      message: 'Master account updated successfully',
      account: config.masterAccounts[masterAccountId],
      status: 'success',
    });
  } else {
    res.status(500).json({ error: 'Failed to update master account' });
  }
};

// Update slave account
export const updateSlaveAccount = (req, res) => {
  const { slaveAccountId } = req.params;
  const { name, description, broker, platform, status } = req.body;

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const config = loadAccountsConfig();

  if (!config.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found`,
    });
  }

  // Update fields if provided
  if (name !== undefined) config.slaveAccounts[slaveAccountId].name = name;
  if (description !== undefined) config.slaveAccounts[slaveAccountId].description = description;
  if (broker !== undefined) config.slaveAccounts[slaveAccountId].broker = broker;
  if (platform !== undefined) config.slaveAccounts[slaveAccountId].platform = platform;
  if (status !== undefined) config.slaveAccounts[slaveAccountId].status = status;

  config.slaveAccounts[slaveAccountId].lastUpdated = new Date().toISOString();

  if (saveAccountsConfig(config)) {
    console.log(`Slave account updated: ${slaveAccountId}`);
    res.json({
      message: 'Slave account updated successfully',
      account: config.slaveAccounts[slaveAccountId],
      status: 'success',
    });
  } else {
    res.status(500).json({ error: 'Failed to update slave account' });
  }
};

// Delete master account
export const deleteMasterAccount = (req, res) => {
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
      `Master account deleted: ${masterAccountId} (user: ${apiKey.substring(0, 8)}...), disconnected slaves: ${connectedSlaves.join(', ')}`
    );
    res.json({
      message: 'Master account deleted successfully',
      masterAccountId,
      disconnectedSlaves: connectedSlaves,
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
      `Slave account deleted: ${slaveAccountId} (user: ${apiKey.substring(0, 8)}...)${wasConnectedTo ? ` (was connected to ${wasConnectedTo})` : ''}`
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
export const getPendingAccounts = (req, res) => {
  try {
    const config = loadAccountsConfig();
    const pendingAccounts = config.pendingAccounts || {};
    const pendingCount = Object.keys(pendingAccounts).length;

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

// Convert pending account to master
export const convertPendingToMaster = (req, res) => {
  const { accountId } = req.params;
  const { name, description, broker, platform } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  try {
    const config = loadAccountsConfig();

    // Check if account exists in pending
    if (!config.pendingAccounts[accountId]) {
      return res.status(404).json({
        error: `Pending account ${accountId} not found`,
      });
    }

    // Check if account already exists as master or slave
    if (config.masterAccounts[accountId] || config.slaveAccounts[accountId]) {
      return res.status(409).json({
        error: `Account ${accountId} already exists as master or slave`,
      });
    }

    // Get pending account data
    const pendingAccount = config.pendingAccounts[accountId];

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
      lastActivity: pendingAccount.lastActivity,
      status: 'active',
    };

    // Move from pending to master
    config.masterAccounts[accountId] = masterAccount;
    delete config.pendingAccounts[accountId];

    if (saveAccountsConfig(config)) {
      // Create disabled master configuration for copy control
      createDisabledMasterConfig(accountId);

      console.log(
        `✅ Pending account ${accountId} converted to master (copying disabled by default)`
      );
      res.json({
        message: 'Pending account successfully converted to master (copying disabled by default)',
        accountId,
        account: masterAccount,
        status: 'converted_to_master',
        copyingEnabled: false,
      });
    } else {
      res.status(500).json({ error: 'Failed to save account configuration' });
    }
  } catch (error) {
    console.error('Error converting pending to master:', error);
    res.status(500).json({ error: 'Failed to convert pending account to master' });
  }
};

// Convert pending account to slave
export const convertPendingToSlave = (req, res) => {
  const { accountId } = req.params;
  const { name, description, broker, platform, masterAccountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  try {
    const config = loadAccountsConfig();

    // Check if account exists in pending
    if (!config.pendingAccounts[accountId]) {
      return res.status(404).json({
        error: `Pending account ${accountId} not found`,
      });
    }

    // Check if account already exists as master or slave
    if (config.masterAccounts[accountId] || config.slaveAccounts[accountId]) {
      return res.status(409).json({
        error: `Account ${accountId} already exists as master or slave`,
      });
    }

    // If masterAccountId provided, validate it exists
    if (masterAccountId && !config.masterAccounts[masterAccountId]) {
      return res.status(400).json({
        error: `Master account ${masterAccountId} not found`,
      });
    }

    // Get pending account data
    const pendingAccount = config.pendingAccounts[accountId];

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
      lastActivity: pendingAccount.lastActivity,
      status: 'active',
    };

    // Move from pending to slave
    config.slaveAccounts[accountId] = slaveAccount;
    delete config.pendingAccounts[accountId];

    // If masterAccountId provided, establish connection
    if (masterAccountId) {
      config.connections[accountId] = masterAccountId;
    }

    if (saveAccountsConfig(config)) {
      // Create disabled slave configuration for copy control
      createDisabledSlaveConfig(accountId);

      console.log(
        `✅ Pending account ${accountId} converted to slave${masterAccountId ? ` and connected to master ${masterAccountId}` : ''} (copying disabled by default)`
      );
      res.json({
        message: `Pending account successfully converted to slave${masterAccountId ? ' and connected to master' : ''} (copying disabled by default)`,
        accountId,
        account: slaveAccount,
        connectedTo: masterAccountId || null,
        status: 'converted_to_slave',
        copyingEnabled: false,
      });
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

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  try {
    const config = loadAccountsConfig();

    if (!config.pendingAccounts[accountId]) {
      return res.status(404).json({
        error: `Pending account ${accountId} not found`,
      });
    }

    // Remove from pending accounts
    delete config.pendingAccounts[accountId];

    if (saveAccountsConfig(config)) {
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

    // Process master accounts
    response.totalMasterAccounts = Object.keys(config.masterAccounts).length;

    for (const [accountId, account] of Object.entries(config.masterAccounts)) {
      // Find connected slaves for this master
      const connectedSlaves = Object.entries(config.connections)
        .filter(([, masterId]) => masterId === accountId)
        .map(([slaveId]) => config.slaveAccounts[slaveId])
        .filter(Boolean);

      response.masterAccounts[accountId] = {
        ...account,
        connectedSlaves,
        totalSlaves: connectedSlaves.length,
      };
    }

    // Process unconnected slaves
    response.unconnectedSlaves = Object.values(config.slaveAccounts)
      .filter(slave => !config.connections[slave.id])
      .map(slave => ({ id: slave.id, ...slave }));

    // Count totals
    response.totalSlaveAccounts = Object.keys(config.slaveAccounts).length;
    response.totalConnections = Object.keys(config.connections).length;

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

    // Process master accounts
    for (const [accountId, account] of Object.entries(config.masterAccounts)) {
      stats.total++;
      stats.masters.total++;

      let status = account.status || 'active';
      if (status === 'active') status = 'synchronized';

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
      });
    }

    // Process slave accounts
    for (const [accountId, account] of Object.entries(config.slaveAccounts)) {
      stats.total++;
      stats.slaves.total++;

      let status = account.status || 'active';
      if (status === 'active') status = 'synchronized';

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
        connectedTo: config.connections[accountId] || null,
      });
    }

    // Process pending accounts
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
