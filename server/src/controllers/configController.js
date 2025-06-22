import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Configuration file management
const configBaseDir = join(process.cwd(), 'config');
const configFilePath = join(configBaseDir, 'slave_master_mapping.json');

// Initialize config directory and file if they don't exist
const initializeConfig = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(configFilePath)) {
    writeFileSync(configFilePath, JSON.stringify({}, null, 2));
  }
};

// Load slave-master mappings from configuration file
const loadConfig = () => {
  initializeConfig();
  try {
    const data = readFileSync(configFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading config:', error);
    return {};
  }
};

// Save slave-master mappings to configuration file
const saveConfig = config => {
  try {
    writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
};

// Get master account for a specific slave account
export const getMasterForSlave = (req, res) => {
  const { slaveId } = req.params;

  if (!slaveId) {
    return res.status(400).json({ error: 'Slave ID is required' });
  }

  const config = loadConfig();
  const masterAccount = config[slaveId];

  if (!masterAccount) {
    return res.status(404).json({
      error: `No master account configured for slave: ${slaveId}`,
      slaveId: slaveId,
      masterAccount: null,
    });
  }

  res.json({
    slaveId: slaveId,
    masterAccount: masterAccount,
    status: 'configured',
  });
};

// Set master account for a specific slave account
export const setMasterForSlave = (req, res) => {
  const { slaveId, masterAccount } = req.body;

  if (!slaveId || !masterAccount) {
    return res.status(400).json({
      error: 'Both slaveId and masterAccount are required',
    });
  }

  const config = loadConfig();
  config[slaveId] = masterAccount;

  if (saveConfig(config)) {
    console.log(`Configuration updated: Slave ${slaveId} -> Master ${masterAccount}`);
    res.json({
      message: 'Configuration saved successfully',
      slaveId: slaveId,
      masterAccount: masterAccount,
      status: 'configured',
    });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
};

// Remove slave-master mapping
export const removeSlaveMasterMapping = (req, res) => {
  const { slaveId } = req.params;

  if (!slaveId) {
    return res.status(400).json({ error: 'Slave ID is required' });
  }

  const config = loadConfig();

  if (!config[slaveId]) {
    return res.status(404).json({
      error: `No configuration found for slave: ${slaveId}`,
    });
  }

  delete config[slaveId];

  if (saveConfig(config)) {
    console.log(`Configuration removed for slave: ${slaveId}`);
    res.json({
      message: 'Configuration removed successfully',
      slaveId: slaveId,
      status: 'removed',
    });
  } else {
    res.status(500).json({ error: 'Failed to remove configuration' });
  }
};

// Get all slave-master mappings
export const getAllConfigurations = (req, res) => {
  const config = loadConfig();

  res.json({
    mappings: config,
    totalMappings: Object.keys(config).length,
  });
};

// Export helper function for use in other controllers
export const findMasterForSlave = slaveId => {
  const config = loadConfig();
  return config[slaveId] || null;
};
