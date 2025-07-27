import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getUserAccounts, loadAccountsConfig, saveUserAccounts } from './configManager.js';

// Copier status configuration file management
const configBaseDir = join(process.cwd(), 'config');
const copierStatusFilePath = join(configBaseDir, 'copier_status.json');

// Initialize config directory if it doesn't exist
const initializeCopierStatus = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(copierStatusFilePath)) {
    const defaultConfig = {
      globalStatus: true, // Copier global ON/OFF
      masterAccounts: {}, // Per-master account ON/OFF
    };
    writeFileSync(copierStatusFilePath, JSON.stringify(defaultConfig, null, 2));
  }
};

// Load copier status configuration (now only for global status)
const loadCopierStatus = () => {
  initializeCopierStatus();
  try {
    const data = readFileSync(copierStatusFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading copier status:', error);
    return {
      globalStatus: true,
      masterAccounts: {},
    };
  }
};

// Save copier status configuration (now only for global status)
const saveCopierStatus = config => {
  try {
    writeFileSync(copierStatusFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving copier status:', error);
    return false;
  }
};

// Load user-specific copier status
export const loadUserCopierStatus = apiKey => {
  const userAccounts = getUserAccounts(apiKey);
  return (
    userAccounts.copierStatus || {
      globalStatus: true,
      masterAccounts: {},
      userApiKey: apiKey,
    }
  );
};

// Save user-specific copier status
export const saveUserCopierStatus = (apiKey, copierStatus) => {
  const userAccounts = loadAccountsConfig().userAccounts[apiKey] || {
    masterAccounts: {},
    slaveAccounts: {},
    pendingAccounts: {},
  };

  userAccounts.copierStatus = copierStatus;
  return saveUserAccounts(apiKey, userAccounts);
};

// Check if copier is enabled for specific master account (user-based)
export const isCopierEnabled = (masterAccountId, apiKey) => {
  const userCopierStatus = loadUserCopierStatus(apiKey);
  const globalConfig = loadCopierStatus();

  // Check global status first
  if (!globalConfig.globalStatus) {
    return false;
  }

  // Check user-specific global status
  if (!userCopierStatus.globalStatus) {
    return false;
  }

  // Check if account is offline - CRITICAL: Never allow copy trading for offline accounts
  const userAccounts = getUserAccounts(apiKey);
  const masterAccount = userAccounts.masterAccounts[masterAccountId];
  if (masterAccount && masterAccount.status === 'offline') {
    return false;
  }

  // Check specific master account status (default to false if not configured)
  const masterStatus = userCopierStatus.masterAccounts[masterAccountId];
  return masterStatus === true;
};

// Create disabled master configuration for new account (user-based)
export const createDisabledMasterConfig = (masterAccountId, apiKey) => {
  if (!apiKey) {
    console.error(
      `❌ Cannot create master copier configuration: apiKey is undefined for ${masterAccountId}`
    );
    return false;
  }

  const userCopierStatus = loadUserCopierStatus(apiKey);

  // Only create if it doesn't exist
  if (!userCopierStatus.masterAccounts.hasOwnProperty(masterAccountId)) {
    userCopierStatus.masterAccounts[masterAccountId] = false; // Disabled by default for new accounts from pending

    if (saveUserCopierStatus(apiKey, userCopierStatus)) {
      console.log(
        `✅ Created disabled master copier configuration for ${masterAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...)`
      );
      return true;
    } else {
      console.error(
        `❌ Failed to create master copier configuration for ${masterAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...)`
      );
      return false;
    }
  }

  return true; // Already exists
};

// Get global copier status
export const getGlobalStatus = (req, res) => {
  const config = loadCopierStatus();

  res.json({
    globalStatus: config.globalStatus,
    status: config.globalStatus ? 'ON' : 'OFF',
    message: `Copier is globally ${config.globalStatus ? 'ENABLED' : 'DISABLED'}`,
  });
};

// Set global copier status
export const setGlobalStatus = (req, res) => {
  const { enabled } = req.body;

  if (enabled === undefined) {
    return res.status(400).json({
      error: 'enabled parameter is required (true/false)',
    });
  }

  const config = loadCopierStatus();
  config.globalStatus = Boolean(enabled);

  if (saveCopierStatus(config)) {
    const status = config.globalStatus ? 'ON' : 'OFF';
    console.log(`Global copier status changed to: ${status}`);
    res.json({
      message: `Global copier status set to ${status}`,
      globalStatus: config.globalStatus,
      status,
    });
  } else {
    res.status(500).json({ error: 'Failed to save global copier status' });
  }
};

// Get copier status for specific master account (user-based)
export const getMasterStatus = (req, res) => {
  const { masterAccountId } = req.params;
  const apiKey = req.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key required' });
  }

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const userCopierStatus = loadUserCopierStatus(apiKey);
  const globalConfig = loadCopierStatus();

  const globalStatus = globalConfig.globalStatus;
  const userGlobalStatus = userCopierStatus.globalStatus;
  const masterStatus = userCopierStatus.masterAccounts[masterAccountId];
  // Default to false if no config exists (new accounts should be disabled by default)
  const effectiveStatus = masterStatus === true;
  const finalStatus = globalStatus && userGlobalStatus && effectiveStatus;

  res.json({
    masterAccountId,
    globalStatus,
    userGlobalStatus,
    masterStatus: effectiveStatus,
    effectiveStatus: finalStatus,
    status: finalStatus ? 'ON' : 'OFF',
    message: `Copier for ${masterAccountId} is ${finalStatus ? 'ENABLED' : 'DISABLED'}`,
  });
};

// Set copier status for specific master account (user-based)
export const setMasterStatus = (req, res) => {
  const { masterAccountId, enabled } = req.body;
  const apiKey = req.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key required' });
  }

  if (!masterAccountId) {
    return res.status(400).json({
      error: 'masterAccountId is required',
    });
  }

  if (enabled === undefined) {
    return res.status(400).json({
      error: 'enabled parameter is required (true/false)',
    });
  }

  // Check if account is offline before enabling
  if (enabled) {
    const userAccounts = getUserAccounts(apiKey);
    const masterAccount = userAccounts.masterAccounts[masterAccountId];

    if (masterAccount && masterAccount.status === 'offline') {
      return res.status(400).json({
        error: 'Cannot enable copy trading for offline account',
        message: 'Account must be online to enable copy trading',
        accountStatus: 'offline',
      });
    }
  }

  const userCopierStatus = loadUserCopierStatus(apiKey);
  userCopierStatus.masterAccounts[masterAccountId] = Boolean(enabled);

  if (saveUserCopierStatus(apiKey, userCopierStatus)) {
    const status = userCopierStatus.masterAccounts[masterAccountId] ? 'ON' : 'OFF';
    const globalConfig = loadCopierStatus();
    const effectiveStatus =
      globalConfig.globalStatus &&
      userCopierStatus.globalStatus &&
      userCopierStatus.masterAccounts[masterAccountId];

    console.log(
      `Copier status for ${masterAccountId} (user: ${apiKey ? apiKey.substring(0, 8) : 'unknown'}...) changed to: ${status}`
    );
    res.json({
      message: `Copier status for ${masterAccountId} set to ${status}`,
      masterAccountId,
      masterStatus: userCopierStatus.masterAccounts[masterAccountId],
      globalStatus: globalConfig.globalStatus,
      userGlobalStatus: userCopierStatus.globalStatus,
      effectiveStatus,
      status: effectiveStatus ? 'ON' : 'OFF',
    });
  } else {
    res.status(500).json({ error: 'Failed to save master account copier status' });
  }
};

// Get all copier statuses (user-based)
export const getAllStatuses = (req, res) => {
  const apiKey = req.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key required' });
  }

  const userCopierStatus = loadUserCopierStatus(apiKey);
  const globalConfig = loadCopierStatus();
  const userAccounts = getUserAccounts(apiKey);

  // Calculate effective status for ALL master accounts (not just configured ones)
  const masterAccountsWithEffectiveStatus = {};

  // Process all master accounts from userAccounts
  for (const [masterAccountId, accountData] of Object.entries(userAccounts.masterAccounts || {})) {
    const masterStatus = userCopierStatus.masterAccounts[masterAccountId];
    // Default to false if no config exists (new accounts should be disabled by default)
    const defaultMasterStatus = masterStatus === true;
    const accountStatus = accountData ? accountData.status : 'offline';

    masterAccountsWithEffectiveStatus[masterAccountId] = {
      masterStatus: defaultMasterStatus,
      effectiveStatus:
        globalConfig.globalStatus &&
        userCopierStatus.globalStatus &&
        defaultMasterStatus &&
        accountStatus !== 'offline',
      status: accountStatus, // Include the actual account status (online/offline)
      copierStatus:
        globalConfig.globalStatus &&
        userCopierStatus.globalStatus &&
        defaultMasterStatus &&
        accountStatus !== 'offline'
          ? 'ON'
          : 'OFF',
    };
  }

  res.json({
    globalStatus: globalConfig.globalStatus,
    userGlobalStatus: userCopierStatus.globalStatus,
    globalStatusText: globalConfig.globalStatus ? 'ON' : 'OFF',
    masterAccounts: masterAccountsWithEffectiveStatus,
    totalMasterAccounts: Object.keys(userAccounts.masterAccounts || {}).length,
  });
};

// Remove copier status for specific master account (reset to default)
export const removeMasterStatus = (req, res) => {
  const { masterAccountId } = req.params;
  const apiKey = req.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key required' });
  }

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const userCopierStatus = loadUserCopierStatus(apiKey);

  if (!(masterAccountId in userCopierStatus.masterAccounts)) {
    return res.status(404).json({
      error: `No specific status found for master account: ${masterAccountId}`,
    });
  }

  delete userCopierStatus.masterAccounts[masterAccountId];

  if (saveUserCopierStatus(apiKey, userCopierStatus)) {
    console.log(
      `Copier status removed for master account: ${masterAccountId} (reset to default: ON)`
    );
    res.json({
      message: `Copier status for ${masterAccountId} reset to default (ON)`,
      masterAccountId,
      masterStatus: true, // Default value
      globalStatus: globalConfig.globalStatus,
      userGlobalStatus: userCopierStatus.globalStatus,
      effectiveStatus: globalConfig.globalStatus,
      status: globalConfig.globalStatus ? 'ON' : 'OFF',
    });
  } else {
    res.status(500).json({ error: 'Failed to remove master account copier status' });
  }
};

// Emergency: Turn OFF all copiers (global + all masters)
export const emergencyShutdown = (req, res) => {
  const config = loadCopierStatus();
  config.globalStatus = false;

  // Also turn off all individual master accounts
  for (const masterAccountId in config.masterAccounts) {
    config.masterAccounts[masterAccountId] = false;
  }

  if (saveCopierStatus(config)) {
    console.log('EMERGENCY SHUTDOWN: All copiers turned OFF');
    res.json({
      message: 'EMERGENCY SHUTDOWN: All copiers turned OFF',
      globalStatus: false,
      affectedMasterAccounts: Object.keys(config.masterAccounts),
      status: 'ALL OFF',
    });
  } else {
    res.status(500).json({ error: 'Failed to execute emergency shutdown' });
  }
};

// Reset all statuses to ON
export const resetAllToOn = (req, res) => {
  const config = loadCopierStatus();
  config.globalStatus = true;

  // Turn on all individual master accounts
  for (const masterAccountId in config.masterAccounts) {
    config.masterAccounts[masterAccountId] = true;
  }

  if (saveCopierStatus(config)) {
    console.log('All copier statuses reset to ON');
    res.json({
      message: 'All copier statuses reset to ON',
      globalStatus: true,
      affectedMasterAccounts: Object.keys(config.masterAccounts),
      status: 'ALL ON',
    });
  } else {
    res.status(500).json({ error: 'Failed to reset all statuses' });
  }
};

// Export internal functions for use in other controllers
export { loadCopierStatus, saveCopierStatus };
