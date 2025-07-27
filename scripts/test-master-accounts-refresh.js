const fetch = require('node-fetch');

const API_KEY = 'test-api-key-123';
const BASE_URL = 'http://localhost:30/api';

async function testMasterAccountsRefresh() {
  console.log('🧪 Testing Master Accounts Refresh Functionality...\n');

  try {
    // Step 1: Get initial master accounts
    console.log('📋 Step 1: Getting initial master accounts...');
    const initialResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!initialResponse.ok) {
      throw new Error(`Failed to get initial accounts: ${initialResponse.status}`);
    }

    const initialData = await initialResponse.json();
    const initialMasterCount = Object.keys(initialData.masterAccounts || {}).length;
    console.log(`✅ Initial master accounts: ${initialMasterCount}`);

    // Step 2: Convert a pending account to master
    console.log('\n📋 Step 2: Converting a pending account to master...');

    // First, get pending accounts
    const pendingResponse = await fetch(`${BASE_URL}/accounts/pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!pendingResponse.ok) {
      throw new Error(`Failed to get pending accounts: ${pendingResponse.status}`);
    }

    const pendingData = await pendingResponse.json();
    const pendingAccounts = Object.keys(pendingData.pendingAccounts || {});

    if (pendingAccounts.length === 0) {
      console.log('⚠️ No pending accounts available for testing');
      return;
    }

    const testAccountId = pendingAccounts[0];
    console.log(`✅ Using pending account: ${testAccountId}`);

    // Convert to master
    const convertResponse = await fetch(`${BASE_URL}/accounts/pending/${testAccountId}/to-master`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: `Test Master ${testAccountId}`,
        broker: 'Test Broker',
        platform: 'MT5',
      }),
    });

    if (!convertResponse.ok) {
      const error = await convertResponse.json();
      throw new Error(`Failed to convert account: ${error.message || convertResponse.status}`);
    }

    console.log('✅ Account converted to master successfully');

    // Step 3: Verify master accounts list is updated
    console.log('\n📋 Step 3: Verifying master accounts list is updated...');

    // Wait a moment for the event system to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!updatedResponse.ok) {
      throw new Error(`Failed to get updated accounts: ${updatedResponse.status}`);
    }

    const updatedData = await updatedResponse.json();
    const updatedMasterCount = Object.keys(updatedData.masterAccounts || {}).length;
    const newMaster = updatedData.masterAccounts[testAccountId];

    console.log(`✅ Updated master accounts: ${updatedMasterCount}`);
    console.log(`✅ New master account found: ${newMaster ? 'YES' : 'NO'}`);

    if (newMaster) {
      console.log(`   - ID: ${newMaster.id}`);
      console.log(`   - Name: ${newMaster.name}`);
      console.log(`   - Platform: ${newMaster.platform}`);
    }

    // Step 4: Verify the account is no longer in pending
    console.log('\n📋 Step 4: Verifying account is removed from pending...');

    const finalPendingResponse = await fetch(`${BASE_URL}/accounts/pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!finalPendingResponse.ok) {
      throw new Error(`Failed to get final pending accounts: ${finalPendingResponse.status}`);
    }

    const finalPendingData = await finalPendingResponse.json();
    const isStillPending =
      finalPendingData.pendingAccounts && finalPendingData.pendingAccounts[testAccountId];

    console.log(`✅ Account still in pending: ${isStillPending ? 'YES' : 'NO'}`);

    // Summary
    console.log('\n🎉 Test Summary:');
    console.log(`   - Initial masters: ${initialMasterCount}`);
    console.log(`   - Final masters: ${updatedMasterCount}`);
    console.log(`   - Master added: ${updatedMasterCount > initialMasterCount ? 'YES' : 'NO'}`);
    console.log(`   - Pending removed: ${!isStillPending ? 'YES' : 'NO'}`);

    if (updatedMasterCount > initialMasterCount && !isStillPending) {
      console.log('\n✅ TEST PASSED: Master accounts refresh functionality is working correctly!');
    } else {
      console.log('\n❌ TEST FAILED: Master accounts refresh functionality has issues.');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testMasterAccountsRefresh();
