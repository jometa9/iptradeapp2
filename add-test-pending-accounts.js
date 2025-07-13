// Using built-in fetch (Node.js 18+)

const API_BASE_URL = 'http://localhost:30/api';
const API_KEY = 'IPTRADE_APIKEY';

// Test account IDs to register as pending
const testAccounts = [
  {
    id: 'PENDING_TEST_001',
    name: 'Test Pending Account 001',
    description: 'High frequency scalping EA detected',
    platform: 'MT4',
    broker: 'IC Markets',
  },
  {
    id: 'PENDING_TEST_002',
    name: 'Test Pending Account 002',
    description: 'Swing trading EA - awaiting configuration',
    platform: 'MT5',
    broker: 'FTMO',
  },
  {
    id: 'PENDING_TEST_003',
    name: 'Test Pending Account 003',
    description: 'Grid trading strategy detected',
    platform: 'cTrader',
    broker: 'Pepperstone',
  },
  {
    id: 'PENDING_TEST_004',
    name: 'Test Pending Account 004',
    description: 'Single pair focused trading bot',
    platform: 'MT4',
    broker: 'XM',
  },
  {
    id: 'PENDING_TEST_005',
    name: 'Test Pending Account 005',
    description: 'Portfolio management EA with 8 pairs',
    platform: 'MT5',
    broker: 'Admiral Markets',
  },
];

// Function to register an account as pending by making an API call
const registerPendingAccount = async accountId => {
  try {
    console.log(`🔄 Registering account: ${accountId}`);

    // Make a call to the orders endpoint to trigger automatic registration
    const response = await fetch(`${API_BASE_URL}/orders/account-type`, {
      method: 'GET',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Successfully registered ${accountId} as pending`);
      console.log(`   📋 Response: ${data.message}`);
      return true;
    } else {
      const error = await response.json();
      console.error(`❌ Failed to register ${accountId}:`, error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error registering ${accountId}:`, error.message);
    return false;
  }
};

// Function to verify pending accounts were created
const verifyPendingAccounts = async () => {
  try {
    console.log('\n🔍 Verifying pending accounts...');

    const response = await fetch(`${API_BASE_URL}/accounts/pending`, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Found ${data.totalPending} pending accounts`);

      if (data.pendingAccounts) {
        Object.entries(data.pendingAccounts).forEach(([id, account]) => {
          console.log(`   • ${id}: ${account.name || 'Unnamed Account'}`);
        });
      }

      return data.totalPending;
    } else {
      console.error('❌ Failed to verify pending accounts');
      return 0;
    }
  } catch (error) {
    console.error('❌ Error verifying pending accounts:', error.message);
    return 0;
  }
};

// Main function
const main = async () => {
  console.log('🚀 Adding 5 test pending accounts via API...\n');

  // Check if server is running
  try {
    const healthCheck = await fetch(`${API_BASE_URL}/status`);
    if (!healthCheck.ok) {
      console.error('❌ Server is not running. Please start the server first:');
      console.error('   cd server && npm start');
      process.exit(1);
    }
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Cannot connect to server. Please start the server first:');
    console.error('   cd server && npm start');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  // Register each test account
  for (const account of testAccounts) {
    const success = await registerPendingAccount(account.id);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📈 Registration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  // Verify the accounts were created
  const totalPending = await verifyPendingAccounts();

  console.log(`\n🎉 Process completed!`);
  console.log(`📊 Total pending accounts in system: ${totalPending}`);

  if (successCount > 0) {
    console.log(`\n🌐 You can now test the following features:`);
    console.log(`   1. View pending accounts in the UI at http://localhost:5173`);
    console.log(`   2. Convert pending accounts to Master accounts`);
    console.log(`   3. Convert pending accounts to Slave accounts`);
    console.log(`   4. Connect slaves to existing masters`);
    console.log(`   5. Test copier controls with the new accounts`);
  }
};

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
