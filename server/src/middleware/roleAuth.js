import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const configBaseDir = join(process.cwd(), 'server', 'config');
const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

// Load accounts configuration
const loadAccountsConfig = () => {
  if (!existsSync(accountsFilePath)) {
    return {
      masterAccounts: {},
      slaveAccounts: {},
      pendingAccounts: {},
      connections: {},
    };
  }

  try {
    const data = readFileSync(accountsFilePath, 'utf-8');
    const config = JSON.parse(data);
    // Ensure pendingAccounts exists for backward compatibility
    if (!config.pendingAccounts) {
      config.pendingAccounts = {};
    }
    return config;
  } catch (error) {
    console.error('Error loading accounts config:', error);
    return {
      masterAccounts: {},
      slaveAccounts: {},
      pendingAccounts: {},
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

// Update account activity timestamp
const updateAccountActivity = (accountId, accountType) => {
  try {
    const config = loadAccountsConfig();
    const now = new Date().toISOString();

    if (accountType === 'master' && config.masterAccounts[accountId]) {
      config.masterAccounts[accountId].lastActivity = now;
    } else if (accountType === 'slave' && config.slaveAccounts[accountId]) {
      config.slaveAccounts[accountId].lastActivity = now;
    } else if (accountType === 'pending' && config.pendingAccounts[accountId]) {
      config.pendingAccounts[accountId].lastActivity = now;
    }

    saveAccountsConfig(config);
    return true;
  } catch (error) {
    console.error('Error updating account activity:', error);
    return false;
  }
};

// Middleware to authenticate account and check if it exists
export const authenticateAccount = (req, res, next) => {
  const accountId = req.headers['x-account-id'] || req.query.accountId || req.body.accountId;

  if (!accountId) {
    return res.status(401).json({
      error: 'Account ID is required',
      message: 'Please provide accountId in headers (x-account-id), query params, or request body',
    });
  }

  const config = loadAccountsConfig();

  // Check if account exists as master, slave, or pending
  const isMaster = config.masterAccounts[accountId];
  const isSlave = config.slaveAccounts[accountId];
  const isPending = config.pendingAccounts[accountId];

  // If account doesn't exist anywhere, register as pending
  if (!isMaster && !isSlave && !isPending) {
    const newPendingAccount = {
      id: accountId,
      name: `Account ${accountId}`,
      description: 'Automatically detected account - awaiting configuration',
      firstSeen: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
    };

    config.pendingAccounts[accountId] = newPendingAccount;
    saveAccountsConfig(config);

    console.log(`🔄 New account detected and registered as pending: ${accountId}`);
  }

  // Determine account type
  const accountType = isMaster ? 'master' : isSlave ? 'slave' : 'pending';

  // Update activity timestamp for this request
  updateAccountActivity(accountId, accountType);

  // Add account info to request object
  req.accountInfo = {
    accountId,
    type: accountType,
    account: isMaster || isSlave || isPending || config.pendingAccounts[accountId],
  };

  next();
};

// Middleware to ensure only master accounts can access
export const requireMaster = (req, res, next) => {
  if (!req.accountInfo) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.accountInfo.type !== 'master') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This endpoint is only available for master accounts',
      accountType: req.accountInfo.type,
    });
  }

  next();
};

// Middleware to ensure only slave accounts can access
export const requireSlave = (req, res, next) => {
  if (!req.accountInfo) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.accountInfo.type !== 'slave') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This endpoint is only available for slave accounts',
      accountType: req.accountInfo.type,
    });
  }

  next();
};

// Combined middleware that applies role restrictions based on HTTP method
export const roleBasedAccess = (req, res, next) => {
  if (!req.accountInfo) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const accountType = req.accountInfo.type;
  const method = req.method.toLowerCase();

  // Pending accounts cannot access trading endpoints
  if (accountType === 'pending') {
    return res.status(403).json({
      error: 'Account pending configuration',
      message:
        'This account is pending configuration. Please contact administrator to set up as master or slave.',
      accountType: 'pending',
      status: 'awaiting_configuration',
      nextSteps: [
        'Contact administrator',
        'Account will be configured as master or slave',
        'Then EA can begin trading operations',
      ],
    });
  }

  // POST requests: only masters
  if (method === 'post' && accountType !== 'master') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'POST requests (sending trades) are only allowed for master accounts',
      accountType,
      allowedMethods: ['GET'],
    });
  }

  // GET requests: only slaves
  if (method === 'get' && accountType !== 'slave') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'GET requests (receiving trades) are only allowed for slave accounts',
      accountType,
      allowedMethods: ['POST'],
    });
  }

  next();
};
