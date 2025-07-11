// Test script for plan name mapping functionality

// Mock response from the API with the format shown in the user query
const mockApiResponses = [
  {
    userId: "b7b33906-8a9f-437c-a001-8cd8adbd09d6",
    email: "joaquinmetayer@gmail.com",
    name: "Joaquin Metayer",
    subscriptionStatus: "active",
    planName: "managed_vps",
    isActive: true,
    statusChanged: false,
    subscriptionType: "admin"
  },
  {
    userId: "user123",
    email: "user@example.com",
    name: "Regular User",
    subscriptionStatus: "active",
    planName: "premium",
    isActive: true,
    statusChanged: false,
    subscriptionType: "customer"
  },
  {
    userId: "user456",
    email: "free@example.com",
    name: "Free User",
    subscriptionStatus: "active",
    planName: "free",
    isActive: true,
    statusChanged: false,
    subscriptionType: "customer"
  }
];

// Map API plan names to internal plan names (copy of the function from the code)
const mapPlanName = (apiPlanName, subscriptionType) => {
  // Check if the user is an admin, give them IPTRADE Managed VPS regardless of plan
  if (subscriptionType === 'admin') {
    console.log('🔑 User is admin, mapping to IPTRADE Managed VPS');
    return 'IPTRADE Managed VPS';
  }

  // Map API plan names to our internal plan names
  const planMap = {
    'free': null,
    'premium': 'IPTRADE Premium',
    'unlimited': 'IPTRADE Unlimited',
    'managed_vps': 'IPTRADE Managed VPS'
  };

  // If plan name is found in our map, use it
  if (apiPlanName && planMap[apiPlanName]) {
    return planMap[apiPlanName];
  }

  // Default to free plan
  return null;
};

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

// Get subscription limits for a plan
const getSubscriptionLimits = (planName) => {
  // If planName is null, undefined, or not found, return free plan limits
  if (planName === null || planName === undefined || !PLAN_LIMITS[planName]) {
    return PLAN_LIMITS[null]; // Free plan limits
  }
  return PLAN_LIMITS[planName];
};

// Test the plan name mapping and limits
console.log("===== TESTING PLAN NAME MAPPING =====");

mockApiResponses.forEach((userData, index) => {
  console.log(`\n📝 TEST CASE #${index + 1}: ${userData.name} (${userData.subscriptionType})`);
  console.log("Original API response:", userData);
  
  // Map the plan name
  const originalPlanName = userData.planName;
  userData.planName = mapPlanName(userData.planName, userData.subscriptionType);
  console.log(`🔄 Mapped plan name: "${originalPlanName}" => "${userData.planName}"`);
  
  // Get subscription limits
  const limits = getSubscriptionLimits(userData.planName);
  console.log("📊 Plan limits:", limits);
  
  // Check account limits specifically
  console.log(`🔢 Max accounts: ${limits.maxAccounts === null ? "UNLIMITED" : limits.maxAccounts}`);
  console.log(`📏 Max lot size: ${limits.maxLotSize === null ? "UNLIMITED" : limits.maxLotSize}`);
  
  // Verify if the user would be able to add more accounts
  const exampleCurrentAccounts = 10;
  const canAddMore = limits.maxAccounts === null || exampleCurrentAccounts < limits.maxAccounts;
  console.log(`🟢 Can add more accounts (with ${exampleCurrentAccounts} existing): ${canAddMore ? "YES" : "NO"}`);
});

console.log("\n✅ TEST COMPLETED"); 