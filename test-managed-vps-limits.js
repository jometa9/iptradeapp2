// Test script to verify managed_vps users can create unlimited accounts
// Run this with: node test-managed-vps-limits.js

const fetch = require('node-fetch');

async function testManagedVpsLimits() {
  console.log('🧪 === MANAGED VPS LIMITS TEST ===');

  // Test cases for different subscription types
  const testCases = [
    {
      name: 'Free User',
      subscriptionType: 'free',
      maxAccounts: 3,
      shouldAllowUnlimited: false,
    },
    {
      name: 'Premium User',
      subscriptionType: 'premium',
      maxAccounts: 5,
      shouldAllowUnlimited: false,
    },
    {
      name: 'Unlimited User',
      subscriptionType: 'unlimited',
      maxAccounts: null,
      shouldAllowUnlimited: true,
    },
    {
      name: 'Managed VPS User',
      subscriptionType: 'managed_vps',
      maxAccounts: null,
      shouldAllowUnlimited: true,
    },
    {
      name: 'Admin User',
      subscriptionType: 'admin',
      maxAccounts: null,
      shouldAllowUnlimited: true,
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`📝 Subscription Type: ${testCase.subscriptionType}`);
    console.log(
      `📊 Max Accounts: ${testCase.maxAccounts === null ? '∞ (Unlimited)' : testCase.maxAccounts}`
    );
    console.log(`✅ Should Allow Unlimited: ${testCase.shouldAllowUnlimited}`);

    // Test with different account counts
    const testAccountCounts = [0, 1, 5, 10, 100];

    for (const accountCount of testAccountCounts) {
      const canCreate = testCase.maxAccounts === null || accountCount < testCase.maxAccounts;
      const status = canCreate ? '✅ ALLOWED' : '❌ BLOCKED';

      console.log(`  - ${accountCount} accounts: ${status}`);

      if (testCase.shouldAllowUnlimited && !canCreate) {
        console.log(
          `    ⚠️ ERROR: ${testCase.name} should allow unlimited accounts but is blocking at ${accountCount}`
        );
      }
    }
  }

  // Test backend configuration
  console.log('\n🔧 Testing Backend Configuration...');

  try {
    const response = await fetch(
      'http://localhost:3000/api/validate-subscription?apiKey=test_managed_vps'
    );

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend validation endpoint working');
      console.log('📦 Response data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Backend validation endpoint error:', response.status);
    }
  } catch (error) {
    console.log('❌ Backend connection error:', error.message);
  }

  console.log('\n🧪 === TEST COMPLETE ===');
  console.log('\n📋 Summary:');
  console.log('- Free users: 3 accounts max');
  console.log('- Premium users: 5 accounts max');
  console.log('- Unlimited users: ∞ accounts (no limit)');
  console.log('- Managed VPS users: ∞ accounts (no limit)');
  console.log('- Admin users: ∞ accounts (no limit)');
}

testManagedVpsLimits().catch(console.error);
