// Test script for subscription limits card visibility logic

// Mock the subscription utils function
const mockUserInfo = (planName, subscriptionType = 'regular') => ({
  userId: 'test-user',
  email: 'test@example.com',
  name: 'Test User',
  subscriptionStatus: 'active',
  planName: planName,
  isActive: true,
  expiryDate: null,
  daysRemaining: 30,
  statusChanged: false,
  subscriptionType: subscriptionType
});

// Import the functions from the subscriptionUtils module
const path = require('path');
const fs = require('fs');

// Read the subscriptionUtils.ts file
const subscriptionUtilsPath = path.join(__dirname, 'src', 'lib', 'subscriptionUtils.ts');
const fileContent = fs.readFileSync(subscriptionUtilsPath, 'utf8');

// Extract the shouldShowSubscriptionLimitsCard function
const shouldShowSubscriptionLimitsCardFunction = fileContent.match(
  /export const shouldShowSubscriptionLimitsCard = \(.*?\) => \{[\s\S]*?return.*?;[\s\S]*?\};/
)[0];

// Extract the isUnlimitedPlan function
const isUnlimitedPlanFunction = fileContent.match(
  /export const isUnlimitedPlan = \(.*?\) => \{[\s\S]*?return.*?;[\s\S]*?\};/
)[0];

// Evaluate the functions in the current context
eval(`
  const UserInfo = {};
  ${shouldShowSubscriptionLimitsCardFunction}
  ${isUnlimitedPlanFunction}
`);

// Define test cases
const testCases = [
  { planName: null, subscriptionType: 'regular', expectedShow: true, description: 'Free plan (null)' },
  { planName: 'IPTRADE Premium', subscriptionType: 'regular', expectedShow: true, description: 'Premium plan' },
  { planName: 'IPTRADE Unlimited', subscriptionType: 'regular', expectedShow: false, description: 'Unlimited plan' },
  { planName: 'IPTRADE Managed VPS', subscriptionType: 'regular', expectedShow: false, description: 'Managed VPS plan' },
  { planName: 'Other Plan', subscriptionType: 'regular', expectedShow: false, description: 'Other plan (not in show list)' },
  { planName: 'IPTRADE Premium', subscriptionType: 'admin', expectedShow: false, description: 'Admin user with Premium plan' },
  { planName: null, subscriptionType: 'admin', expectedShow: false, description: 'Admin user with Free plan' },
];

// Run tests for shouldShowSubscriptionLimitsCard
console.log('\n=== Testing shouldShowSubscriptionLimitsCard ===');
let passedTests = 0;
let failedTests = 0;

testCases.forEach(test => {
  const result = shouldShowSubscriptionLimitsCard(test.planName, test.subscriptionType);
  const testPassed = result === test.expectedShow;
  
  console.log(`${testPassed ? '✅' : '❌'} ${test.description}: ${testPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`  - Plan: ${test.planName || 'null'}, Type: ${test.subscriptionType}`);
  console.log(`  - Expected: ${test.expectedShow ? 'Show card' : 'Hide card'}, Actual: ${result ? 'Show card' : 'Hide card'}`);
  
  if (testPassed) {
    passedTests++;
  } else {
    failedTests++;
  }
});

// Run tests for isUnlimitedPlan
console.log('\n=== Testing isUnlimitedPlan ===');
testCases.forEach(test => {
  const user = mockUserInfo(test.planName, test.subscriptionType);
  const result = isUnlimitedPlan(user);
  const expected = test.planName === 'IPTRADE Unlimited' || 
                 test.planName === 'IPTRADE Managed VPS' || 
                 test.subscriptionType === 'admin';
  const testPassed = result === expected;
  
  console.log(`${testPassed ? '✅' : '❌'} ${test.description}: ${testPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`  - Plan: ${test.planName || 'null'}, Type: ${test.subscriptionType}`);
  console.log(`  - Expected: ${expected ? 'Unlimited' : 'Limited'}, Actual: ${result ? 'Unlimited' : 'Limited'}`);
  
  if (testPassed) {
    passedTests++;
  } else {
    failedTests++;
  }
});

// Print summary
console.log('\n=== Test Results ===');
console.log(`Total tests: ${testCases.length * 2}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Success rate: ${Math.round((passedTests / (testCases.length * 2)) * 100)}%`); 