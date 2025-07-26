const axios = require('axios');

async function debugOfflineCount() {
  try {
    console.log('🔍 DEBUGGING OFFLINE COUNT...\n');

    // Fetch connectivity data
    const connectivityResponse = await axios.get(
      'http://localhost:3001/api/accounts/connectivity',
      {
        headers: {
          'x-api-key': 'admin-key-123',
        },
      }
    );

    const connectivityData = connectivityResponse.data;
    console.log('📊 CONNECTIVITY DATA:');
    console.log(JSON.stringify(connectivityData.stats, null, 2));

    // Fetch all accounts data
    const allAccountsResponse = await axios.get('http://localhost:3001/api/accounts/all', {
      headers: {
        'x-api-key': 'admin-key-123',
      },
    });

    const allAccountsData = allAccountsResponse.data;
    console.log('\n📋 ALL ACCOUNTS DATA:');
    console.log(JSON.stringify(allAccountsData, null, 2));

    // Analyze each account individually
    console.log('\n🔍 DETAILED ACCOUNT ANALYSIS:');

    if (connectivityData.stats.connectivityDetails) {
      for (const account of connectivityData.stats.connectivityDetails) {
        console.log(`\n--- Account ${account.accountId} (${account.type}) ---`);
        console.log(`Status: ${account.status}`);
        console.log(`Last Activity: ${account.lastActivity}`);
        console.log(`Time Since Activity: ${account.timeSinceActivity}ms`);
        console.log(`Is Recent: ${account.isRecent}`);
        console.log(`ACTIVITY_TIMEOUT: ${connectivityData.activityTimeout}ms`);

        // Check if should be offline
        const shouldBeOffline =
          account.timeSinceActivity && account.timeSinceActivity > connectivityData.activityTimeout;
        console.log(`Should be offline: ${shouldBeOffline}`);

        if (account.type === 'master') {
          console.log(`Connected Slaves: ${account.connectedSlaves}`);
        } else if (account.type === 'slave') {
          console.log(`Connected To: ${account.connectedTo}`);
        }
      }
    }

    // Manual count
    console.log('\n📈 MANUAL COUNT:');
    const offlineCount =
      connectivityData.stats.connectivityDetails?.filter(acc => acc.status === 'offline').length ||
      0;
    const pendingCount =
      connectivityData.stats.connectivityDetails?.filter(acc => acc.status === 'pending').length ||
      0;
    const synchronizedCount =
      connectivityData.stats.connectivityDetails?.filter(acc => acc.status === 'synchronized')
        .length || 0;

    console.log(`Offline accounts: ${offlineCount}`);
    console.log(`Pending accounts: ${pendingCount}`);
    console.log(`Synchronized accounts: ${synchronizedCount}`);
    console.log(`Total accounts: ${connectivityData.stats.total}`);

    console.log('\n🔴 EXPECTED: 2 offline accounts');
    console.log(`🔵 ACTUAL: ${offlineCount} offline accounts`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

debugOfflineCount();
