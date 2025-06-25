import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const configBaseDir = join(process.cwd(), 'server', 'config');
const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

// Load accounts configuration
const loadAccountsConfig = () => {
  if (!existsSync(accountsFilePath)) {
    return { masterAccounts: {}, slaveAccounts: {}, connections: {} };
  }

  try {
    const data = readFileSync(accountsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading accounts config:', error);
    return { masterAccounts: {}, slaveAccounts: {}, connections: {} };
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

  // Check if account exists as master or slave
  const isMaster = config.masterAccounts[accountId];
  const isSlave = config.slaveAccounts[accountId];

  if (!isMaster && !isSlave) {
    return res.status(403).json({
      error: 'Account not found',
      message: `Account ${accountId} is not registered as master or slave`,
    });
  }

  // Add account info to request object
  req.accountInfo = {
    accountId,
    type: isMaster ? 'master' : 'slave',
    account: isMaster || isSlave,
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

  const method = req.method.toLowerCase();

  // POST requests: only masters
  if (method === 'post' && req.accountInfo.type !== 'master') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'POST requests (sending trades) are only allowed for master accounts',
      accountType: req.accountInfo.type,
      allowedMethods: ['GET'],
    });
  }

  // GET requests: only slaves
  if (method === 'get' && req.accountInfo.type !== 'slave') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'GET requests (receiving trades) are only allowed for slave accounts',
      accountType: req.accountInfo.type,
      allowedMethods: ['POST'],
    });
  }

  next();
};
