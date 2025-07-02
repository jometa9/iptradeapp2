import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Accounts management file
const configBaseDir = join(process.cwd(), 'server', 'config');
const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

// Initialize accounts configuration
const initializeAccountsConfig = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(accountsFilePath)) {
    const defaultConfig = {
      masterAccounts: {},
      slaveAccounts: {},
      pendingAccounts: {},
      connections: {}, // slaveId -> masterAccountId mapping
    };
    writeFileSync(accountsFilePath, JSON.stringify(defaultConfig, null, 2));
  }
};

// Load accounts configuration
const loadAccountsConfig = () => {
  initializeAccountsConfig();
  try {
    const data = readFileSync(accountsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading accounts config:', error);
    return {
      masterAccounts: {},
      slaveAccounts: {},
      connections: {},
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

// Validation helpers
export const isMasterAccountRegistered = masterAccountId => {
  const config = loadAccountsConfig();
  return masterAccountId in config.masterAccounts;
};

export const isSlaveAccountRegistered = slaveAccountId => {
  const config = loadAccountsConfig();
  return slaveAccountId in config.slaveAccounts;
};

export const getSlaveConnection = slaveAccountId => {
  const config = loadAccountsConfig();
  return config.connections[slaveAccountId] || null;
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

    // Check master accounts
    for (const [accountId, account] of Object.entries(config.masterAccounts)) {
      if (account.lastActivity) {
        const lastActivity = new Date(account.lastActivity);
        const timeSinceActivity = now - lastActivity;

        if (timeSinceActivity > ACTIVITY_TIMEOUT) {
          if (account.status !== 'offline') {
            account.status = 'offline';
            hasChanges = true;
            console.log(
              `📴 Master account ${accountId} marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
            );
          }
        } else {
          if (account.status === 'offline') {
            account.status = 'active';
            hasChanges = true;
            console.log(`📡 Master account ${accountId} back online`);
          }
        }
      }
    }

    // Check slave accounts
    for (const [accountId, account] of Object.entries(config.slaveAccounts)) {
      if (account.lastActivity) {
        const lastActivity = new Date(account.lastActivity);
        const timeSinceActivity = now - lastActivity;

        if (timeSinceActivity > ACTIVITY_TIMEOUT) {
          if (account.status !== 'offline') {
            account.status = 'offline';
            hasChanges = true;
            console.log(
              `📴 Slave account ${accountId} marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
            );
          }
        } else {
          if (account.status === 'offline') {
            account.status = 'active';
            hasChanges = true;
            console.log(`📡 Slave account ${accountId} back online`);
          }
        }
      }
    }

    // Check pending accounts
    for (const [accountId, account] of Object.entries(config.pendingAccounts)) {
      if (account.lastActivity) {
        const lastActivity = new Date(account.lastActivity);
        const timeSinceActivity = now - lastActivity;

        if (timeSinceActivity > ACTIVITY_TIMEOUT) {
          if (account.status !== 'offline') {
            account.status = 'offline';
            hasChanges = true;
            console.log(
              `📴 Pending account ${accountId} marked as offline (${Math.round(timeSinceActivity / 1000)}s inactive)`
            );
          }
        } else {
          if (account.status === 'offline') {
            account.status = 'pending';
            hasChanges = true;
            console.log(`📡 Pending account ${accountId} back online`);
          }
        }
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
startActivityMonitoring();

// Register new master account
export const registerMasterAccount = (req, res) => {
  const { masterAccountId, name, description, broker, platform } = req.body;

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

  const config = loadAccountsConfig();

  if (config.masterAccounts[masterAccountId]) {
    return res.status(409).json({
      error: `Master account ${masterAccountId} is already registered`,
    });
  }

  config.masterAccounts[masterAccountId] = {
    id: masterAccountId,
    name: name || masterAccountId,
    description: description || '',
    broker: broker || '',
    platform: platform || '',
    registeredAt: new Date().toISOString(),
    lastActivity: null,
    status: 'active',
  };

  if (saveAccountsConfig(config)) {
    console.log(`Master account registered: ${masterAccountId}`);
    res.json({
      message: 'Master account registered successfully',
      account: config.masterAccounts[masterAccountId],
      status: 'success',
    });
  } else {
    res.status(500).json({ error: 'Failed to register master account' });
  }
};

// Register new slave account
export const registerSlaveAccount = (req, res) => {
  const { slaveAccountId, name, description, broker, platform, masterAccountId } = req.body;

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

  const config = loadAccountsConfig();

  if (config.slaveAccounts[slaveAccountId]) {
    return res.status(409).json({
      error: `Slave account ${slaveAccountId} is already registered`,
    });
  }

  // If masterAccountId is provided, validate it exists
  if (masterAccountId) {
    if (!config.masterAccounts[masterAccountId]) {
      return res.status(400).json({
        error: `Master account ${masterAccountId} is not registered`,
      });
    }
  }

  config.slaveAccounts[slaveAccountId] = {
    id: slaveAccountId,
    name: name || slaveAccountId,
    description: description || '',
    broker: broker || '',
    platform: platform || '',
    registeredAt: new Date().toISOString(),
    lastActivity: null,
    status: 'active',
  };

  // Set connection if masterAccountId is provided
  if (masterAccountId) {
    config.connections[slaveAccountId] = masterAccountId;
  }

  if (saveAccountsConfig(config)) {
    console.log(
      `Slave account registered: ${slaveAccountId}${masterAccountId ? ` -> ${masterAccountId}` : ''}`
    );
    res.json({
      message: 'Slave account registered successfully',
      account: config.slaveAccounts[slaveAccountId],
      connectedTo: masterAccountId || null,
      status: 'success',
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

// Get master account details
export const getMasterAccount = (req, res) => {
  const { masterAccountId } = req.params;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const config = loadAccountsConfig();
  const account = config.masterAccounts[masterAccountId];

  if (!account) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} not found`,
    });
  }

  // Find connected slaves
  const connectedSlaves = Object.entries(config.connections)
    .filter(([, masterId]) => masterId === masterAccountId)
    .map(([slaveId]) => slaveId);

  res.json({
    account,
    connectedSlaves,
    totalSlaves: connectedSlaves.length,
  });
};

// Get slave account details
export const getSlaveAccount = (req, res) => {
  const { slaveAccountId } = req.params;

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const config = loadAccountsConfig();
  const account = config.slaveAccounts[slaveAccountId];

  if (!account) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found`,
    });
  }

  const connectedTo = config.connections[slaveAccountId] || null;

  res.json({
    account,
    connectedTo,
    masterAccount: connectedTo ? config.masterAccounts[connectedTo] : null,
  });
};

// Get all accounts overview
export const getAllAccounts = (req, res) => {
  const config = loadAccountsConfig();

  const masterAccountsWithSlaves = {};
  Object.entries(config.masterAccounts).forEach(([masterId, masterData]) => {
    const connectedSlaves = Object.entries(config.connections)
      .filter(([, connectedMasterId]) => connectedMasterId === masterId)
      .map(([slaveId]) => ({
        id: slaveId,
        ...config.slaveAccounts[slaveId],
      }));

    masterAccountsWithSlaves[masterId] = {
      ...masterData,
      connectedSlaves,
      totalSlaves: connectedSlaves.length,
    };
  });

  const unconnectedSlaves = Object.entries(config.slaveAccounts)
    .filter(([slaveId]) => !config.connections[slaveId])
    .map(([slaveId, slaveData]) => ({ id: slaveId, ...slaveData }));

  res.json({
    masterAccounts: masterAccountsWithSlaves,
    unconnectedSlaves,
    totalMasterAccounts: Object.keys(config.masterAccounts).length,
    totalSlaveAccounts: Object.keys(config.slaveAccounts).length,
    totalConnections: Object.keys(config.connections).length,
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

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const config = loadAccountsConfig();

  if (!config.masterAccounts[masterAccountId]) {
    return res.status(404).json({
      error: `Master account ${masterAccountId} not found`,
    });
  }

  // Find and disconnect all connected slaves
  const connectedSlaves = Object.entries(config.connections)
    .filter(([, masterId]) => masterId === masterAccountId)
    .map(([slaveId]) => slaveId);

  connectedSlaves.forEach(slaveId => {
    delete config.connections[slaveId];
  });

  delete config.masterAccounts[masterAccountId];

  if (saveAccountsConfig(config)) {
    console.log(
      `Master account deleted: ${masterAccountId}, disconnected slaves: ${connectedSlaves.join(', ')}`
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

  if (!slaveAccountId) {
    return res.status(400).json({ error: 'Slave account ID is required' });
  }

  const config = loadAccountsConfig();

  if (!config.slaveAccounts[slaveAccountId]) {
    return res.status(404).json({
      error: `Slave account ${slaveAccountId} not found`,
    });
  }

  const wasConnectedTo = config.connections[slaveAccountId];
  delete config.connections[slaveAccountId];
  delete config.slaveAccounts[slaveAccountId];

  if (saveAccountsConfig(config)) {
    console.log(
      `Slave account deleted: ${slaveAccountId}${wasConnectedTo ? ` (was connected to ${wasConnectedTo})` : ''}`
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
      console.log(`✅ Pending account ${accountId} converted to master`);
      res.json({
        message: 'Pending account successfully converted to master',
        accountId,
        account: masterAccount,
        status: 'converted_to_master',
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
      console.log(
        `✅ Pending account ${accountId} converted to slave${masterAccountId ? ` and connected to master ${masterAccountId}` : ''}`
      );
      res.json({
        message: `Pending account successfully converted to slave${masterAccountId ? ' and connected to master' : ''}`,
        accountId,
        account: slaveAccount,
        connectedTo: masterAccountId || null,
        status: 'converted_to_slave',
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
