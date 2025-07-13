// Subscription utilities for handling user plan limits and validations

interface UserInfo {
  userId: string;
  email: string;
  name: string;
  subscriptionType: string;
}

interface SubscriptionLimits {
  maxAccounts: number | null;
  maxLotSize: number | null;
  features: string[];
}

interface LotValidation {
  valid: boolean;
  error?: string;
}

// Plan limits configuration based on subscription type
export const PLAN_LIMITS: Record<string, SubscriptionLimits> = {
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
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support', 'admin_access'],
  },
};

// Get subscription limits for a user
export const getSubscriptionLimits = (subscriptionType: string): SubscriptionLimits => {
  return PLAN_LIMITS[subscriptionType] || PLAN_LIMITS['free'];
};

// Check if user has unlimited plan
export const isUnlimitedPlan = (userInfo: UserInfo): boolean => {
  if (!userInfo) {
    return false;
  }

  const unlimitedPlans = ['unlimited', 'managed_vps', 'admin'];
  return unlimitedPlans.includes(userInfo.subscriptionType);
};

// Check if user can create more accounts
export const canCreateMoreAccounts = (userInfo: UserInfo, currentAccountCount: number): boolean => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  // If no limit (unlimited plan), allow creation
  if (limits.maxAccounts === null) {
    return true;
  }

  return currentAccountCount < limits.maxAccounts;
};

// Check if user can customize lot sizes
export const canCustomizeLotSizes = (userInfo: UserInfo): boolean => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  return limits.maxLotSize === null;
};

// Validate lot size according to plan limits
export const validateLotSize = (userInfo: UserInfo, lotSize: number): LotValidation => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  // If no limit (unlimited plan), allow any lot size
  if (limits.maxLotSize === null) {
    return { valid: true };
  }

  // Check if lot size exceeds plan limit
  if (lotSize > limits.maxLotSize) {
    return {
      valid: false,
      error: `Your ${getPlanDisplayName(userInfo.subscriptionType)} plan limits lot size to ${limits.maxLotSize}`,
    };
  }

  return { valid: true };
};

// Get plan display name
export const getPlanDisplayName = (subscriptionType: string): string => {
  const displayNames: Record<string, string> = {
    free: 'Free',
    premium: 'Premium',
    unlimited: 'Unlimited',
    managed_vps: 'Managed VPS',
    admin: 'Admin',
  };

  return displayNames[subscriptionType] || 'Free';
};

// Get account limit message
export const getAccountLimitMessage = (userInfo: UserInfo, currentAccountCount: number): string => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  if (limits.maxAccounts === null) {
    return 'Unlimited accounts available.';
  }

  const remaining = limits.maxAccounts - currentAccountCount;
  if (remaining <= 0) {
    return `Account limit reached (${currentAccountCount}/${limits.maxAccounts}).`;
  }

  return `You have ${remaining} of ${limits.maxAccounts} accounts remaining.`;
};

// Get lot size message
export const getLotSizeMessage = (userInfo: UserInfo): string => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  if (limits.maxLotSize === null) {
    return 'Custom lot sizes available.';
  }

  return `Lot size limited to ${limits.maxLotSize}.`;
};

// Check if user should see subscription limits card
export const shouldShowSubscriptionLimitsCard = (userInfo: UserInfo): boolean => {
  if (!userInfo) {
    return false;
  }

  // Only show limits card for plans with restrictions
  const plansWithLimits = ['free', 'premium'];
  return plansWithLimits.includes(userInfo.subscriptionType);
};

export type { LotValidation, SubscriptionLimits, UserInfo };
