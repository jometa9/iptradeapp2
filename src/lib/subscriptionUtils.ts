// Subscription utility functions for frontend

export interface SubscriptionLimits {
  maxAccounts: number | null;
  maxLotSize: number | null;
  features: string[];
}

export interface AccountCounts {
  total: number;
  masters: number;
  slaves: number;
}

export interface UserInfo {
  userId: string;
  email: string;
  name: string;
  subscriptionStatus: string | null;
  planName: string | null;
  isActive: boolean;
  expiryDate: string | null;
  daysRemaining: number;
  statusChanged: boolean;
  subscriptionType: string;
}

// Plan limits configuration - must match backend
export const PLAN_LIMITS: Record<string, SubscriptionLimits> = {
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

// Get subscription limits for a plan
export const getSubscriptionLimits = (planName: string | null): SubscriptionLimits => {
  const key = planName || 'null';
  return PLAN_LIMITS[key] || PLAN_LIMITS['null'];
};

// Check if user can create more accounts
export const canCreateMoreAccounts = (userInfo: UserInfo, currentAccountCount: number): boolean => {
  const limits = getSubscriptionLimits(userInfo.planName);

  // If no limit (unlimited plan), allow creation
  if (limits.maxAccounts === null) {
    return true;
  }

  return currentAccountCount < limits.maxAccounts;
};

// Get remaining account slots
export const getRemainingAccountSlots = (
  userInfo: UserInfo,
  currentAccountCount: number
): number | null => {
  const limits = getSubscriptionLimits(userInfo.planName);

  // If no limit (unlimited plan), return null
  if (limits.maxAccounts === null) {
    return null;
  }

  return Math.max(0, limits.maxAccounts - currentAccountCount);
};

// Check if user can set custom lot sizes
export const canSetCustomLotSizes = (userInfo: UserInfo): boolean => {
  const limits = getSubscriptionLimits(userInfo.planName);
  return limits.maxLotSize === null;
};

// Get maximum allowed lot size
export const getMaxAllowedLotSize = (userInfo: UserInfo): number | null => {
  const limits = getSubscriptionLimits(userInfo.planName);
  return limits.maxLotSize;
};

// Validate lot size for user's plan
export const validateLotSize = (
  userInfo: UserInfo,
  lotSize: number
): { valid: boolean; error?: string } => {
  const limits = getSubscriptionLimits(userInfo.planName);

  // If no limit, allow any positive lot size
  if (limits.maxLotSize === null) {
    return { valid: lotSize > 0 };
  }

  // For free users, only allow 0.01
  if (lotSize !== limits.maxLotSize) {
    return {
      valid: false,
      error: `Your ${userInfo.planName || 'Free'} plan only allows lot size of ${limits.maxLotSize}`,
    };
  }

  return { valid: true };
};

// Check if user has a specific feature
export const hasFeature = (userInfo: UserInfo, feature: string): boolean => {
  const limits = getSubscriptionLimits(userInfo.planName);
  return limits.features.includes(feature);
};

// Get plan display name
export const getPlanDisplayName = (planName: string | null): string => {
  if (!planName) return 'Free';
  return planName;
};

// Get plan badge color
export const getPlanBadgeColor = (planName: string | null): string => {
  switch (planName) {
    case 'IPTRADE Premium':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'IPTRADE Unlimited':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'IPTRADE Managed VPS':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Check if subscription limits card should be shown
export const shouldShowSubscriptionLimitsCard = (planName: string | null): boolean => {
  // Hide the card for premium plans that don't need to show limits
  const plansToHide = ['IPTRADE Premium', 'IPTRADE Unlimited', 'IPTRADE Managed VPS'];
  return !plansToHide.includes(planName || '');
};

// Check if subscription is valid
export const isValidSubscription = (userInfo: UserInfo): boolean => {
  const validStatuses = ['active', 'trialing', 'admin_assigned'];

  // Handle free users (null subscription status)
  if (userInfo.subscriptionStatus === null) {
    return userInfo.isActive;
  }

  return validStatuses.includes(userInfo.subscriptionStatus) && userInfo.isActive;
};

// Get subscription status display text
export const getSubscriptionStatusText = (subscriptionStatus: string | null): string => {
  if (subscriptionStatus === null) {
    return 'Free';
  }

  switch (subscriptionStatus) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'admin_assigned':
      return 'Admin';
    case 'canceled':
      return 'Canceled';
    case 'expired':
      return 'Expired';
    case 'past_due':
      return 'Past Due';
    default:
      return 'Unknown';
  }
};

// Get account creation limit message
export const getAccountLimitMessage = (userInfo: UserInfo, currentAccountCount: number): string => {
  const limits = getSubscriptionLimits(userInfo.planName);
  const planName = getPlanDisplayName(userInfo.planName);

  if (limits.maxAccounts === null) {
    return `Your ${planName} plan allows unlimited accounts. You currently have ${currentAccountCount} accounts.`;
  }

  const remaining = getRemainingAccountSlots(userInfo, currentAccountCount);
  return `Your ${planName} plan allows ${limits.maxAccounts} accounts. You have ${remaining} slots remaining.`;
};

// Get lot size restriction message
export const getLotSizeMessage = (userInfo: UserInfo): string => {
  const limits = getSubscriptionLimits(userInfo.planName);
  const planName = getPlanDisplayName(userInfo.planName);

  if (limits.maxLotSize === null) {
    return `Your ${planName} plan allows custom lot sizes.`;
  }

  return `Your ${planName} plan restricts lot size to ${limits.maxLotSize}.`;
};

// Format account count for display
export const formatAccountCount = (counts: AccountCounts): string => {
  if (counts.total === 0) {
    return 'No accounts';
  }

  const parts: string[] = [];
  if (counts.masters > 0) {
    parts.push(`${counts.masters} master${counts.masters > 1 ? 's' : ''}`);
  }
  if (counts.slaves > 0) {
    parts.push(`${counts.slaves} slave${counts.slaves > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
};
