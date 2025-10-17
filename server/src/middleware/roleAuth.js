import { getUserAccounts, saveUserAccounts } from '../controllers/configManager.js';

// Update account activity timestamp
const updateAccountActivity = (accountId, accountType, apiKey) => {
  try {
    const userAccounts = getUserAccounts(apiKey);
    const now = new Date().toISOString();

    if (
      accountType === 'master' &&
      userAccounts.masterAccounts &&
      userAccounts.masterAccounts[accountId]
    ) {
      userAccounts.masterAccounts[accountId].lastActivity = now;
    } else if (
      accountType === 'slave' &&
      userAccounts.slaveAccounts &&
      userAccounts.slaveAccounts[accountId]
    ) {
      userAccounts.slaveAccounts[accountId].lastActivity = now;
    } else if (
      accountType === 'pending' &&
      userAccounts.pendingAccounts &&
      userAccounts.pendingAccounts[accountId]
    ) {
      userAccounts.pendingAccounts[accountId].lastActivity = now;
    }

    saveUserAccounts(apiKey, userAccounts);
    return true;
  } catch (error) {
    console.error('Error updating account activity:', error);
    return false;
  }
};

// Middleware to authenticate account and check if it exists
export const authenticateAccount = (req, res, next) => {
  const accountId = req.headers['x-account-id'] || req.query.accountId || req.body.accountId;
  const apiKey = req.headers['x-api-key'];

  if (!accountId) {
    return res.status(401).json({
      error: 'Account ID is required',
      message: 'Please provide accountId in headers (x-account-id), query params, or request body',
    });
  }

  // For now, use a temporary API key - this should be replaced with proper user-based authentication
  const tempApiKey = apiKey || 'iptrade_89536f5b9e643c043sa31';

  const userAccounts = getUserAccounts(tempApiKey);

  // Check if account exists as master, slave, or pending
  const isMaster = userAccounts.masterAccounts && userAccounts.masterAccounts[accountId];
  const isSlave = userAccounts.slaveAccounts && userAccounts.slaveAccounts[accountId];
  const isPending = userAccounts.pendingAccounts && userAccounts.pendingAccounts[accountId];

  // Determine platform based on account ID pattern or default to MT5
  let platform = 'MT5'; // Default platform
  if (accountId.includes('MT4') || accountId.includes('mt4')) {
    platform = 'MT4';
  } else if (accountId.includes('MT5') || accountId.includes('mt5')) {
    platform = 'MT5';
  } else if (accountId.includes('CTRADER') || accountId.includes('cTrader')) {
    platform = 'cTrader';
  } else if (accountId.includes('NINJA') || accountId.includes('NinjaTrader')) {
    platform = 'NinjaTrader';
  } else if (accountId.includes('TV') || accountId.includes('TradingView')) {
    platform = 'TradingView';
  }

  // If account doesn't exist anywhere, register as pending
  if (!isMaster && !isSlave && !isPending) {
    const newPendingAccount = {
      id: accountId,
      name: `Account ${accountId}`,
      description: 'Automatically detected account - awaiting configuration',
      firstSeen: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: platform,
      broker: 'Unknown',
      apiKey: tempApiKey,
    };

    if (!userAccounts.pendingAccounts) {
      userAccounts.pendingAccounts = {};
    }
    userAccounts.pendingAccounts[accountId] = newPendingAccount;
    saveUserAccounts(tempApiKey, userAccounts);
  } else if (isPending && userAccounts.pendingAccounts[accountId]) {
    // Update existing pending account with platform information if missing
    const pendingAccount = userAccounts.pendingAccounts[accountId];
    if (!pendingAccount.platform || pendingAccount.platform === null) {
      pendingAccount.platform = platform;
      pendingAccount.broker = pendingAccount.broker || 'Unknown';
      saveUserAccounts(tempApiKey, userAccounts);
    }
  }

  // Determine account type
  const accountType = isMaster ? 'master' : isSlave ? 'slave' : 'pending';

  // Update activity timestamp for this request
  updateAccountActivity(accountId, accountType, tempApiKey);

  // Add account info to request object
  req.accountInfo = {
    accountId,
    type: accountType,
    account: isMaster || isSlave || isPending || userAccounts.pendingAccounts[accountId],
  };

  // Add API key to request for use in other middleware
  req.apiKey = tempApiKey;

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
