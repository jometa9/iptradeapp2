// Middleware for subscription validation and authorization
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Valid subscription statuses
const VALID_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'admin_assigned'];

// Plan limits configuration
const PLAN_LIMITS = {
  null: {
    maxAccounts: 3,
    maxLotSize: 0.01,
    features: ['basic_copy_trading'],
  },
  'IPTRADE Premium': {
    maxAccounts: 5,
    maxLotSize: null, // No limit
    features: ['advanced_copy_trading', 'custom_lot_sizes'],
  },
  'IPTRADE Unlimited': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'advanced_features'],
  },
  'IPTRADE Managed VPS': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support'],
  },
};

// Validate API key using your existing validation endpoint
export const validateSubscription = async apiKey => {
  if (!apiKey) {
    return { valid: false, error: 'API Key is required' };
  }

  try {
    // Use the existing validation endpoint
    const serverPort = process.env.PORT || 3000;
    const response = await fetch(
      `http://localhost:${serverPort}/api/validate-subscription?apiKey=${encodeURIComponent(apiKey)}`
    );

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Invalid API Key' };
      }
      const errorData = await response.json();
      return { valid: false, error: errorData.error || 'Validation failed' };
    }

    const userData = await response.json();

    // Check subscription status
    if (!VALID_SUBSCRIPTION_STATUSES.includes(userData.subscriptionStatus) || !userData.isActive) {
      return {
        valid: false,
        error: 'Invalid subscription status',
        subscriptionStatus: userData.subscriptionStatus,
        isActive: userData.isActive,
      };
    }

    // Check if subscription is expired
    if (userData.expiryDate) {
      const now = new Date();
      const expiry = new Date(userData.expiryDate);
      if (now > expiry) {
        return {
          valid: false,
          error: 'Subscription expired',
          expiryDate: userData.expiryDate,
        };
      }
    }

    return { valid: true, userData };
  } catch (error) {
    console.error('Error validating subscription:', error);
    return { valid: false, error: 'Validation service error' };
  }
};

// Get subscription limits for a user
export const getSubscriptionLimits = planName => {
  return PLAN_LIMITS[planName] || PLAN_LIMITS[null];
};

// Count existing accounts for a specific user (by apiKey)
export const countUserAccounts = apiKey => {
  try {
    const accountsConfigPath = join(process.cwd(), 'config', 'registered_accounts.json');

    if (!existsSync(accountsConfigPath)) {
      return { total: 0, masters: 0, slaves: 0 };
    }

    const accountsConfig = JSON.parse(readFileSync(accountsConfigPath, 'utf8'));

    // Handle new user-based structure
    if (accountsConfig.userAccounts && accountsConfig.userAccounts[apiKey]) {
      const userAccounts = accountsConfig.userAccounts[apiKey];

      const masterCount = Object.keys(userAccounts.masterAccounts || {}).length;
      const slaveCount = Object.keys(userAccounts.slaveAccounts || {}).length;

      return {
        total: masterCount + slaveCount,
        masters: masterCount,
        slaves: slaveCount,
      };
    }

    // No accounts for this user
    return { total: 0, masters: 0, slaves: 0 };
  } catch (error) {
    console.error('Error counting user accounts:', error);
    return { total: 0, masters: 0, slaves: 0 };
  }
};

// Extract API key from request
export const extractApiKey = req => {
  return req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey;
};

// Middleware to validate subscription and attach user info to request
export const requireValidSubscription = async (req, res, next) => {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key required',
      message:
        'Please provide a valid API key in headers (x-api-key), query params, or request body',
    });
  }

  const validation = await validateSubscription(apiKey);

  if (!validation.valid) {
    return res.status(401).json({
      error: validation.error,
      details: validation,
    });
  }

  // Attach user info, subscription limits, and apiKey to request
  req.user = validation.userData;
  req.subscriptionLimits = getSubscriptionLimits(validation.userData.planName);
  req.apiKey = apiKey; // Add apiKey for account isolation

  next();
};

// Middleware to check account limits before creating new accounts
export const checkAccountLimits = (req, res, next) => {
  if (!req.user || !req.subscriptionLimits || !req.apiKey) {
    return res.status(401).json({
      error: 'Subscription validation required',
      message: 'Please use requireValidSubscription middleware first',
    });
  }

  const limits = req.subscriptionLimits;

  // If no account limit (unlimited plan), allow creation
  if (limits.maxAccounts === null) {
    return next();
  }

  // Count existing accounts for this specific user
  const accountCounts = countUserAccounts(req.apiKey);

  if (accountCounts.total >= limits.maxAccounts) {
    return res.status(403).json({
      error: 'Account limit exceeded',
      message: `Your ${req.user.planName || 'Free'} plan allows maximum ${limits.maxAccounts} accounts. You currently have ${accountCounts.total} accounts.`,
      limits: {
        maxAccounts: limits.maxAccounts,
        currentAccounts: accountCounts.total,
        planName: req.user.planName || 'Free',
      },
    });
  }

  next();
};

// Middleware to enforce lot size restrictions
export const enforceLotSizeRestrictions = (req, res, next) => {
  if (!req.user || !req.subscriptionLimits) {
    return res.status(401).json({
      error: 'Subscription validation required',
      message: 'Please use requireValidSubscription middleware first',
    });
  }

  const limits = req.subscriptionLimits;

  // For null plan (free users), force lot size to 0.01
  if (req.user.planName === null && limits.maxLotSize === 0.01) {
    // Check if this is a slave configuration or order creation
    if (req.body.forceLot !== undefined) {
      req.body.forceLot = 0.01;
    }
    if (req.body.lotMultiplier !== undefined) {
      req.body.lotMultiplier = 1.0; // Reset multiplier to 1.0 for free users
    }

    // For order creation endpoints
    let i = 0;
    while (req.body[`lot${i}`] !== undefined) {
      req.body[`lot${i}`] = '0.01';
      i++;
    }
  }

  next();
};

export default {
  validateSubscription,
  getSubscriptionLimits,
  countUserAccounts,
  requireValidSubscription,
  checkAccountLimits,
  enforceLotSizeRestrictions,
};
