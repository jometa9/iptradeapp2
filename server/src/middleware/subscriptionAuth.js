import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Add valid subscription statuses
const VALID_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'admin_assigned'];

// Add a cache for validated subscriptions
export const subscriptionCache = new Map();
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Add a map to track ongoing validation promises to prevent duplicate requests
export const ongoingValidations = new Map();


// Map API plan names to internal plan names
const mapPlanName = (apiPlanName, subscriptionType) => {
  // Check if the user is an admin, give them IPTRADE Managed VPS regardless of plan
  if (subscriptionType === 'admin') {
    return 'IPTRADE Managed VPS';
  }

  // Map API plan names to our internal plan names
  const planMap = {
    free: null,
    premium: 'IPTRADE Premium',
    unlimited: 'IPTRADE Unlimited',
    managed_vps: 'IPTRADE Managed VPS',
  };

  // If plan name is found in our map, use it
  if (apiPlanName && planMap[apiPlanName]) {
    return planMap[apiPlanName];
  }

  // Default to free plan
  return null;
};

// Plan limits configuration based on subscription type
const PLAN_LIMITS = {
  free: {
    maxAccounts: 3,
    maxLotSize: 0.01,
    features: ['basic_copy_trading'],
  },
  premium: {
    maxAccounts: 5,
    maxLotSize: null, // No limit
    features: ['advanced_copy_trading', 'custom_lot_sizes'],
  },
  unlimited: {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'advanced_features'],
  },
  managed_vps: {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support'],
  },
  admin: {
    maxAccounts: 1, // No limit
    maxLotSize: 0.01, // Testing limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support', 'admin_access'],
  },
};

// Validate subscription against external license API
export const validateSubscription = async apiKey => {
  // Check if there's already an ongoing validation for this API key
  if (ongoingValidations.has(apiKey)) {
    return await ongoingValidations.get(apiKey);
  }

  // Create a new validation promise
  const validationPromise = performValidation(apiKey);
  ongoingValidations.set(apiKey, validationPromise);

  try {
    const result = await validationPromise;
    return result;
  } finally {
    // Clean up the ongoing validation promise
    ongoingValidations.delete(apiKey);
  }
};

// Internal function that performs the actual validation
const performValidation = async apiKey => {
  try {
    // Use the external license API URL from .env
    const licenseApiUrl =
      process.env.LICENSE_API_URL || 'https://iptradecopier.com/api/validate-subscription';

    const requestStart = Date.now();

    // Add timeout and better error handling for fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${licenseApiUrl}?apiKey=${encodeURIComponent(apiKey)}`, {});
      clearTimeout(timeoutId);
      const requestDuration = Date.now() - requestStart;

      if (!response.ok) {
        // If API key is not found in external API, fail validation
        if (response.status === 401 || response.status === 404) {
          return { valid: false, error: 'Invalid license key' };
        }

        const errorData = await response.json().catch(() => ({ error: 'Validation failed' }));
        return { valid: false, error: errorData.error || 'Validation failed' };
      }

      const userData = await response.json();

      // Check if response contains error (some APIs return 200 with error field)
      if (userData.error) {
        return { valid: false, error: userData.error || 'Invalid license' };
      }

      // Validate that we have the required fields
      if (!userData.userId || !userData.email || !userData.name || !userData.subscriptionType) {
        return { valid: false, error: 'Invalid user data format' };
      }

      // Validate subscription type
      const validSubscriptionTypes = ['free', 'premium', 'unlimited', 'managed_vps', 'admin'];
      if (!validSubscriptionTypes.includes(userData.subscriptionType)) {
        return { valid: false, error: 'Invalid subscription type' };
      }

      return { valid: true, userData };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('💥 Fetch error during subscription validation:', fetchError.message);
      return { valid: false, error: 'Validation failed' };
    }
  } catch (error) {
    console.error('💥 Error during subscription validation:', error.message);
    console.error('💥 Error stack:', error.stack);
    console.error('💥 Error details:', error);

    // Fail validation on connection error
    return { valid: false, error: 'Connection error during license validation' };
  }
};

// Get subscription limits for a user based on subscription type
export const getSubscriptionLimits = subscriptionType => {
  // If subscriptionType is null, undefined, or not found, return free plan limits
  if (
    subscriptionType === null ||
    subscriptionType === undefined ||
    !PLAN_LIMITS[subscriptionType]
  ) {
    return PLAN_LIMITS['free']; // Free plan limits
  }
  return PLAN_LIMITS[subscriptionType];
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

  try {
    // Check if we have a cached validation result that's still valid
    const cachedValidation = subscriptionCache.get(apiKey);
    const now = Date.now();

    if (cachedValidation && now - cachedValidation.timestamp < CACHE_DURATION) {
      // Use cached validation - no logging to reduce spam
      req.user = cachedValidation.userData;
      req.subscriptionLimits = getSubscriptionLimits(cachedValidation.userData.subscriptionType);
      req.apiKey = apiKey;
      return next();
    }

    // Check if there's an ongoing validation
    if (ongoingValidations.has(apiKey)) {
      const validation = await ongoingValidations.get(apiKey);

      if (validation.valid) {
        req.user = validation.userData;
        req.subscriptionLimits = getSubscriptionLimits(validation.userData.subscriptionType);
        req.apiKey = apiKey;
        return next();
      } else {
        return res.status(401).json({
          error: validation.error,
          details: validation,
        });
      }
    }

    // Perform new validation
    const validation = await validateSubscription(apiKey);

    if (!validation.valid) {
      return res.status(401).json({
        error: validation.error,
        details: validation,
      });
    }



    // Store in cache with current timestamp
    subscriptionCache.set(apiKey, {
      userData: validation.userData,
      timestamp: now,
    });

    // Attach user info, subscription limits, and apiKey to request
    req.user = validation.userData;
    req.subscriptionLimits = getSubscriptionLimits(validation.userData.subscriptionType);
    req.apiKey = apiKey; // Add apiKey for account isolation

    next();
  } catch (error) {
    console.error('❌ Error in requireValidSubscription middleware:', error);
    return res.status(500).json({
      error: 'Internal server error validating subscription',
    });
  }
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
  const displayPlanName = req.user.subscriptionType === 'free' ? 'Free' : req.user.subscriptionType;

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

// Middleware to check account limits for NEW account creation (not pending conversions)
export const checkNewAccountLimits = (req, res, next) => {
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

  // Count existing accounts for this specific user (excluding pending accounts)
  const accountCounts = countUserAccounts(req.apiKey);

  // Get user-friendly plan name
  const displayPlanName = req.user.subscriptionType === 'free' ? 'Free' : req.user.subscriptionType;

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

// Middleware to check limits for pending account conversions
export const allowPendingConversions = (req, res, next) => {
  if (!req.user || !req.subscriptionLimits || !req.apiKey) {
    return res.status(401).json({
      error: 'Subscription validation required',
      message: 'Please use requireValidSubscription middleware first',
    });
  }

  const limits = req.subscriptionLimits;

  // If no account limit (unlimited plan), allow conversion
  if (limits.maxAccounts === null) {
    return next();
  }

  // Count existing accounts for this specific user (including pending accounts)
  const accountCounts = countUserAccounts(req.apiKey);

  // Get user-friendly plan name
  const displayPlanName = req.user.subscriptionType === 'free' ? 'Free' : req.user.subscriptionType;

  if (accountCounts.total >= limits.maxAccounts) {
    return res.status(403).json({
      error: 'Account limit exceeded',
      message: `Your ${displayPlanName} plan allows maximum ${limits.maxAccounts} accounts. You currently have ${accountCounts.total} accounts. Cannot convert pending accounts.`,
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

  // For free users, force lot size to 0.01
  if (req.user.subscriptionType === 'free' && limits.maxLotSize === 0.01) {
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
  checkNewAccountLimits,
  allowPendingConversions,
  enforceLotSizeRestrictions,
  subscriptionCache,
  ongoingValidations,

};
