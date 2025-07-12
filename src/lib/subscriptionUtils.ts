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
  subscriptionType: string;
}

// Plan limits configuration based on subscription type - must match backend
export const PLAN_LIMITS: Record<string, SubscriptionLimits> = {
  'free': {
    maxAccounts: 3,
    maxLotSize: 0.01,
    features: ['basic_copy_trading'],
  },
  'premium': {
    maxAccounts: 5,
    maxLotSize: null, // No limit
    features: ['advanced_copy_trading', 'custom_lot_sizes'],
  },
  'unlimited': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'advanced_features'],
  },
  'managed_vps': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support'],
  },
  'admin': {
    maxAccounts: null, // No limit
    maxLotSize: null, // No limit
    features: ['unlimited_copy_trading', 'managed_vps', 'priority_support', 'admin_access'],
  },
};

// Get subscription limits for a subscription type
export const getSubscriptionLimits = (subscriptionType: string): SubscriptionLimits => {
  return PLAN_LIMITS[subscriptionType] || PLAN_LIMITS['free'];
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

// Get remaining account slots
export const getRemainingAccountSlots = (
  userInfo: UserInfo,
  currentAccountCount: number
): number | null => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  // If no limit (unlimited plan), return null
  if (limits.maxAccounts === null) {
    return null;
  }

  return Math.max(0, limits.maxAccounts - currentAccountCount);
};

// Check if user can set custom lot sizes
export const canSetCustomLotSizes = (userInfo: UserInfo): boolean => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  return limits.maxLotSize === null;
};

// Get maximum allowed lot size
export const getMaxAllowedLotSize = (userInfo: UserInfo): number | null => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  return limits.maxLotSize;
};

// Validate lot size for user's plan
export const validateLotSize = (
  userInfo: UserInfo,
  lotSize: number
): { valid: boolean; error?: string } => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);

  // If no limit, allow any positive lot size
  if (limits.maxLotSize === null) {
    return { valid: lotSize > 0 };
  }

  // For free users, only allow 0.01
  if (lotSize !== limits.maxLotSize) {
    return {
      valid: false,
      error: `Your ${userInfo.subscriptionType} plan only allows lot size of ${limits.maxLotSize}`,
    };
  }

  return { valid: true };
};

// Check if user has a specific feature
export const hasFeature = (userInfo: UserInfo, feature: string): boolean => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  return limits.features.includes(feature);
};

// Get plan display name
export const getPlanDisplayName = (subscriptionType: string): string => {
  switch (subscriptionType) {
    case 'free':
      return 'Free';
    case 'premium':
      return 'Premium';
    case 'unlimited':
      return 'Unlimited';
    case 'managed_vps':
      return 'Managed VPS';
    case 'admin':
      return 'Admin';
    default:
      return 'Free';
  }
};

// Get plan badge color
export const getPlanBadgeColor = (subscriptionType: string): string => {
  switch (subscriptionType) {
    case 'premium':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'unlimited':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'managed_vps':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'admin':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Check if subscription limits card should be shown
export const shouldShowSubscriptionLimitsCard = (subscriptionType: string): boolean => {
  console.log('🔍 shouldShowSubscriptionLimitsCard - Entrada:', { subscriptionType });
  
  // Admin users should never see limits card
  if (subscriptionType === 'admin') {
    console.log('👤 Admin user detected, subscription limits card should NOT be shown');
    return false;
  }
  
  // Managed VPS users should never see limits card
  if (subscriptionType === 'managed_vps') {
    console.log('🖥️ Managed VPS user detected, subscription limits card should NOT be shown');
    return false;
  }
  
  // Unlimited users should never see limits card
  if (subscriptionType === 'unlimited') {
    console.log('💎 Unlimited user detected, subscription limits card should NOT be shown');
    return false;
  }
  
  // Only show the card for free users and Premium plan
  const typesToShow = ['free', 'premium'];
  const shouldShow = typesToShow.includes(subscriptionType);
  console.log(`${shouldShow ? '✅' : '❌'} Based on subscription type, subscription limits card ${shouldShow ? 'should' : 'should NOT'} be shown`);
  return shouldShow;
};

// Check if user has an unlimited plan (no account limits)
export const isUnlimitedPlan = (userInfo: UserInfo | null): boolean => {
  if (!userInfo) {
    console.log('🚫 isUnlimitedPlan: userInfo is null, returning false');
    return false;
  }
  
  console.log('🔍 isUnlimitedPlan - Checking user:', { 
    subscriptionType: userInfo.subscriptionType 
  });
  
  // Admin users always have unlimited plans
  if (userInfo.subscriptionType === 'admin') {
    console.log('✅ isUnlimitedPlan: User is admin, returning true');
    return true;
  }
  
  // Managed VPS users always have unlimited plans
  if (userInfo.subscriptionType === 'managed_vps') {
    console.log('✅ isUnlimitedPlan: User is managed_vps, returning true');
    return true;
  }
  
  // Unlimited users always have unlimited plans
  if (userInfo.subscriptionType === 'unlimited') {
    console.log('✅ isUnlimitedPlan: User is unlimited, returning true');
    return true;
  }
  
  console.log('❌ isUnlimitedPlan: User has limited plan, returning false');
  return false;
};

// Check if subscription is valid
export const isValidSubscription = (userInfo: UserInfo): boolean => {
  const validTypes = ['free', 'premium', 'unlimited', 'managed_vps', 'admin'];
  return validTypes.includes(userInfo.subscriptionType);
};

// Get subscription type display text
export const getSubscriptionTypeText = (subscriptionType: string): string => {
  switch (subscriptionType) {
    case 'free':
      return 'Free';
    case 'premium':
      return 'Premium';
    case 'unlimited':
      return 'Unlimited';
    case 'managed_vps':
      return 'Managed VPS';
    case 'admin':
      return 'Admin';
    default:
      return 'Unknown';
  }
};

// Get account creation limit message
export const getAccountLimitMessage = (userInfo: UserInfo, currentAccountCount: number): string => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  const planName = getPlanDisplayName(userInfo.subscriptionType);

  if (limits.maxAccounts === null) {
    return `Your ${planName} plan allows unlimited accounts. You currently have ${currentAccountCount} accounts.`;
  }

  const remaining = getRemainingAccountSlots(userInfo, currentAccountCount);
  return `Your ${planName} plan allows ${limits.maxAccounts} accounts. You have ${remaining} slots remaining.`;
};

// Get lot size restriction message
export const getLotSizeMessage = (userInfo: UserInfo): string => {
  const limits = getSubscriptionLimits(userInfo.subscriptionType);
  const planName = getPlanDisplayName(userInfo.subscriptionType);

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
