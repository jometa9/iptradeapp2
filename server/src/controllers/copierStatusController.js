import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

// Load copier status configuration
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

// Save copier status configuration
const saveCopierStatus = config => {
  try {
    writeFileSync(copierStatusFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving copier status:', error);
    return false;
  }
};

// Check if copier is enabled for specific master account
export const isCopierEnabled = masterAccountId => {
  const config = loadCopierStatus();

  // Check global status first
  if (!config.globalStatus) {
    return false;
  }

  // Check specific master account status (default to true if not configured)
  const masterStatus = config.masterAccounts[masterAccountId];
  return masterStatus !== undefined ? masterStatus : true;
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

// Get copier status for specific master account
export const getMasterStatus = (req, res) => {
  const { masterAccountId } = req.params;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const config = loadCopierStatus();
  const globalStatus = config.globalStatus;
  const masterStatus = config.masterAccounts[masterAccountId];
  const effectiveStatus = masterStatus !== undefined ? masterStatus : true;
  const finalStatus = globalStatus && effectiveStatus;

  res.json({
    masterAccountId,
    globalStatus,
    masterStatus: effectiveStatus,
    effectiveStatus: finalStatus,
    status: finalStatus ? 'ON' : 'OFF',
    message: `Copier for ${masterAccountId} is ${finalStatus ? 'ENABLED' : 'DISABLED'}`,
  });
};

// Set copier status for specific master account
export const setMasterStatus = (req, res) => {
  const { masterAccountId, enabled } = req.body;

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

  const config = loadCopierStatus();
  config.masterAccounts[masterAccountId] = Boolean(enabled);

  if (saveCopierStatus(config)) {
    const status = config.masterAccounts[masterAccountId] ? 'ON' : 'OFF';
    const effectiveStatus = config.globalStatus && config.masterAccounts[masterAccountId];

    console.log(`Copier status for ${masterAccountId} changed to: ${status}`);
    res.json({
      message: `Copier status for ${masterAccountId} set to ${status}`,
      masterAccountId,
      masterStatus: config.masterAccounts[masterAccountId],
      globalStatus: config.globalStatus,
      effectiveStatus,
      status: effectiveStatus ? 'ON' : 'OFF',
    });
  } else {
    res.status(500).json({ error: 'Failed to save master account copier status' });
  }
};

// Get all copier statuses
export const getAllStatuses = (req, res) => {
  const config = loadCopierStatus();

  // Calculate effective status for each master account
  const masterAccountsWithEffectiveStatus = {};
  for (const [masterAccountId, masterStatus] of Object.entries(config.masterAccounts)) {
    masterAccountsWithEffectiveStatus[masterAccountId] = {
      masterStatus,
      effectiveStatus: config.globalStatus && masterStatus,
      status: config.globalStatus && masterStatus ? 'ON' : 'OFF',
    };
  }

  res.json({
    globalStatus: config.globalStatus,
    globalStatusText: config.globalStatus ? 'ON' : 'OFF',
    masterAccounts: masterAccountsWithEffectiveStatus,
    totalMasterAccounts: Object.keys(config.masterAccounts).length,
  });
};

// Remove copier status for specific master account (reset to default)
export const removeMasterStatus = (req, res) => {
  const { masterAccountId } = req.params;

  if (!masterAccountId) {
    return res.status(400).json({ error: 'Master account ID is required' });
  }

  const config = loadCopierStatus();

  if (!(masterAccountId in config.masterAccounts)) {
    return res.status(404).json({
      error: `No specific status found for master account: ${masterAccountId}`,
    });
  }

  delete config.masterAccounts[masterAccountId];

  if (saveCopierStatus(config)) {
    console.log(
      `Copier status removed for master account: ${masterAccountId} (reset to default: ON)`
    );
    res.json({
      message: `Copier status for ${masterAccountId} reset to default (ON)`,
      masterAccountId,
      masterStatus: true, // Default value
      globalStatus: config.globalStatus,
      effectiveStatus: config.globalStatus,
      status: config.globalStatus ? 'ON' : 'OFF',
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
