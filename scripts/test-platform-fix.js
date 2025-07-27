// Test script to verify platform type fixes
const API_BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3';

async function testPlatformFixes() {
  console.log('🔍 Testing platform type fixes...\n');

  try {
    // Test 1: Get supported platforms
    console.log('1. Testing supported platforms endpoint...');
    const platformsResponse = await fetch(`${API_BASE_URL}/accounts/platforms`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (platformsResponse.ok) {
      const platformsData = await platformsResponse.json();
      console.log(
        '✅ Supported platforms:',
        platformsData.platforms.map(p => `${p.value}: ${p.label}`)
      );
    } else {
      console.log('❌ Failed to get supported platforms');
    }

    // Test 2: Get pending accounts to check platform display
    console.log('\n2. Testing pending accounts platform display...');
    const pendingResponse = await fetch(`${API_BASE_URL}/accounts/pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json();
      console.log('✅ Pending accounts found:', pendingData.totalPending);

      if (pendingData.pendingAccounts) {
        // Check new accounts with platform information
        const newAccounts = Object.entries(pendingData.pendingAccounts)
          .filter(([id, account]) => id.startsWith('TEST_'))
          .slice(0, 5); // Show first 5 new accounts

        console.log('\n📋 New accounts with platform information:');
        newAccounts.forEach(([id, account]) => {
          console.log(`   - ${id}: ${account.platform || 'undefined'} (${account.status})`);
        });

        // Check old accounts (should be updated with platform info)
        const oldAccounts = Object.entries(pendingData.pendingAccounts)
          .filter(([id, account]) => !id.startsWith('TEST_'))
          .slice(0, 3); // Show first 3 old accounts

        console.log('\n📋 Old accounts (may not have platform info yet):');
        oldAccounts.forEach(([id, account]) => {
          console.log(`   - ${id}: ${account.platform || 'undefined'} (${account.status})`);
        });
      }
    } else {
      console.log('❌ Failed to get pending accounts');
    }

    // Test 3: Get all accounts to check trading configurations platform display
    console.log('\n3. Testing trading configurations platform display...');
    const accountsResponse = await fetch(`${API_BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();

      if (accountsData.masterAccounts) {
        console.log('✅ Master accounts:');
        Object.entries(accountsData.masterAccounts).forEach(([id, account]) => {
          console.log(`   - ${id}: ${account.platform} (${account.status})`);
        });
      }

      if (accountsData.unconnectedSlaves) {
        console.log('✅ Unconnected slaves:');
        accountsData.unconnectedSlaves.forEach(account => {
          console.log(`   - ${account.id}: ${account.platform} (${account.status})`);
        });
      }
    } else {
      console.log('❌ Failed to get all accounts');
    }

    console.log('\n✅ Platform type fix tests completed!');
    console.log('\n📋 Summary of fixes:');
    console.log('   - Added platform mapping function in PendingAccountsManager');
    console.log('   - Added platform mapping function in TradingAccountsConfig');
    console.log('   - Updated platform options to include all supported platforms');
    console.log('   - Updated backend SUPPORTED_PLATFORMS array');
    console.log('   - Fixed platform display in tables to show proper labels');
    console.log('   - Updated account creation logic to include platform information');
    console.log('   - Platform detection based on account ID patterns');
  } catch (error) {
    console.error('❌ Error testing platform fixes:', error.message);
  }
}

testPlatformFixes();
