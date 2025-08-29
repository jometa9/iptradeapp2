import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Configuration paths
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
export const loadAccountsConfig = () => {
  initializeAccountsConfig();
  try {
    const data = readFileSync(accountsFilePath, 'utf8');
    const config = JSON.parse(data);

    // Migrate old structure if needed
    if (!config.userAccounts && (config.masterAccounts || config.slaveAccounts)) {
      const migratedConfig = {
        userAccounts: {},
        globalData: {
          lastMigration: new Date().toISOString(),
          version: '2.0',
        },
      };

      // Save migrated structure (old data will be lost since we don't know which user it belongs to)
      writeFileSync(accountsFilePath, JSON.stringify(migratedConfig, null, 2));
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
export const saveAccountsConfig = config => {
  try {
    writeFileSync(accountsFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving accounts config:', error);
    return false;
  }
};

// Get user-specific accounts structure
export const getUserAccounts = apiKey => {
  if (!apiKey) {
    console.error('❌ getUserAccounts called with undefined apiKey');
    return {
      masterAccounts: {},
      slaveAccounts: {},
      pendingAccounts: {},
      connections: {},
      lastActivity: new Date().toISOString(),
    };
  }

  const config = loadAccountsConfig();

  if (!config.userAccounts[apiKey]) {
    config.userAccounts[apiKey] = {
      masterAccounts: {},
      slaveAccounts: {},
      pendingAccounts: {},
      connections: {}, // slaveId -> masterAccountId mapping
      lastActivity: new Date().toISOString(),
    };
    saveAccountsConfig(config);
  }

  return config.userAccounts[apiKey];
};

// Save user-specific accounts
export const saveUserAccounts = (apiKey, userAccounts) => {
  if (!apiKey) {
    console.error('❌ saveUserAccounts called with undefined apiKey');
    return false;
  }

  const config = loadAccountsConfig();

  // Ensure we only save the core account structure, not additional metadata
  config.userAccounts[apiKey] = {
    masterAccounts: userAccounts.masterAccounts || {},
    slaveAccounts: userAccounts.slaveAccounts || {},
    pendingAccounts: userAccounts.pendingAccounts || {},
    connections: userAccounts.connections || {},
    lastActivity: new Date().toISOString(),
  };

  return saveAccountsConfig(config);
};
