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

// Validate subscription against external license API
export const validateSubscription = async apiKey => {
  try {
    // Use the external license API URL from .env (port 3000)
    const licenseApiUrl =
      process.env.VITE_LICENSE_API_URL ||
      process.env.LICENSE_API_URL ||
      'http://localhost:3000/api/validate-subscription';

    console.log(`🔗 Calling external license API: ${licenseApiUrl}`);

    const response = await fetch(`${licenseApiUrl}?apiKey=${encodeURIComponent(apiKey)}`);

    if (!response.ok) {
      // If API key is not found in external API, treat as free user
      if (response.status === 401 || response.status === 404) {
        console.log('⚠️ API key not found in external API, treating as free user');
        return {
          valid: true,
          userData: {
            userId: 'user_' + apiKey.substring(0, 8),
            email: 'user@free.com',
            name: 'Free User',
            subscriptionStatus: null,
            planName: null,
            isActive: false,
            expiryDate: null,
            daysRemaining: -1,
            statusChanged: false,
            subscriptionType: 'none',
          },
        };
      }

      const errorData = await response.json().catch(() => ({ error: 'Validation failed' }));
      return { valid: false, error: errorData.error || 'Validation failed' };
    }

    const userData = await response.json();

    // Check if response contains error (some APIs return 200 with error field)
    if (userData.error) {
      console.log('⚠️ External API returned error, treating as free user:', userData.error);
      return {
        valid: true,
        userData: {
          userId: 'user_' + apiKey.substring(0, 8),
          email: 'user@free.com',
          name: 'Free User',
          subscriptionStatus: null,
          planName: null,
          isActive: false,
          expiryDate: null,
          daysRemaining: -1,
          statusChanged: false,
          subscriptionType: 'none',
        },
      };
    }

    // Check subscription status - allow null as free plan
    const isValidStatus =
      VALID_SUBSCRIPTION_STATUSES.includes(userData.subscriptionStatus) ||
      userData.subscriptionStatus === null;

    // For null subscription (free plan), allow even if isActive is false
    const isFreeUser = userData.subscriptionStatus === null;
    const shouldAllowAccess = isValidStatus && (userData.isActive || isFreeUser);

    if (!shouldAllowAccess) {
      return {
        valid: false,
        error: 'Invalid subscription status',
        subscriptionStatus: userData.subscriptionStatus,
        isActive: userData.isActive,
      };
    }

    // Check if subscription is expired (only for non-free users)
    if (!isFreeUser && userData.expiryDate) {
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
    console.error('Error validating subscription with external API:', error.message);

    // Fallback to free user on connection error
    console.log('⚠️ External API unavailable, treating as free user');
    return {
      valid: true,
      userData: {
        userId: 'user_' + apiKey.substring(0, 8),
        email: 'user@free.com',
        name: 'Free User',
        subscriptionStatus: null,
        planName: null,
        isActive: false,
        expiryDate: null,
        daysRemaining: -1,
        statusChanged: false,
        subscriptionType: 'none',
      },
    };
  }
};

// Get subscription limits for a user
export const getSubscriptionLimits = planName => {
  // If planName is null, undefined, or not found, return free plan limits
  if (planName === null || planName === undefined || !PLAN_LIMITS[planName]) {
    return PLAN_LIMITS[null]; // Free plan limits
  }
  return PLAN_LIMITS[planName];
};

// Count existing accounts for a specific user (by apiKey)
export const countUserAccounts = apiKey => {
  try {
    const accountsConfigPath = join(process.cwd(), 'server', 'config', 'registered_accounts.json');

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

  // Get user-friendly plan name
  const displayPlanName = req.user.planName === null ? 'Free' : req.user.planName;

  if (accountCounts.total >= limits.maxAccounts) {
    return res.status(403).json({
      error: 'Account limit exceeded',
      message: `Your ${displayPlanName} plan allows maximum ${limits.maxAccounts} accounts. You currently have ${accountCounts.total} accounts.`,
      limits: {
        maxAccounts: limits.maxAccounts,
        currentAccounts: accountCounts.total,
        planName: displayPlanName,
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
