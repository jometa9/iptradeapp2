const API_BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3';

async function testFrontendNumbers() {
  console.log('🧪 Testing frontend number calculations...\n');

  try {
    // Get connectivity stats
    const connectivityResponse = await fetch(`${API_BASE_URL}/accounts/connectivity`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!connectivityResponse.ok) {
      console.error('❌ Failed to fetch connectivity stats:', connectivityResponse.status);
      return;
    }

    const connectivityData = await connectivityResponse.json();

    console.log('📊 Backend Connectivity Stats:');
    console.log(`   Total: ${connectivityData.stats.total}`);
    console.log(`   Connected: ${connectivityData.stats.synchronized}`);
    console.log(`   Not Connected: ${connectivityData.stats.pending}`);
    console.log(`   Offline: ${connectivityData.stats.offline}`);
    console.log(`   Error: ${connectivityData.stats.error}`);

    // Get accounts data
    const accountsResponse = await fetch(`${API_BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!accountsResponse.ok) {
      console.error('❌ Failed to fetch accounts:', accountsResponse.status);
      return;
    }

    const accountsData = await accountsResponse.json();

    console.log('\n📋 Accounts Data:');
    console.log(`   Total Masters: ${Object.keys(accountsData.masterAccounts || {}).length}`);
    console.log(`   Total Slaves: ${accountsData.unconnectedSlaves ? accountsData.unconnectedSlaves.length : 0}`);

    // Count connected slaves
    let totalConnectedSlaves = 0;
    Object.values(accountsData.masterAccounts || {}).forEach((master: any) => {
      if (master.connectedSlaves) {
        totalConnectedSlaves += master.connectedSlaves.length;
      }
    });
    console.log(`   Connected Slaves: ${totalConnectedSlaves}`);

    // Simulate frontend calculation
    console.log('\n🔍 Simulating Frontend Calculation:');

    const accountStatusMap = new Map();
    connectivityData.stats.connectivityDetails.forEach((detail: any) => {
      accountStatusMap.set(detail.accountId, detail.status);
    });

    let frontendConnected = 0;
    let frontendNotConnected = 0;
    let frontendOffline = 0;
    let frontendError = 0;

    // Process master accounts
    Object.values(accountsData.masterAccounts || {}).forEach((master: any) => {
      const status = accountStatusMap.get(master.id) || 'pending';
      switch (status) {
        case 'synchronized':
          frontendConnected++;
          break;
        case 'pending':
          frontendNotConnected++;
          break;
        case 'offline':
          frontendOffline++;
          break;
        case 'error':
          frontendError++;
          break;
      }
    });

    // Process unconnected slaves
    (accountsData.unconnectedSlaves || []).forEach((slave: any) => {
      const status = accountStatusMap.get(slave.id) || 'pending';
      switch (status) {
        case 'synchronized':
          frontendConnected++;
          break;
        case 'pending':
          frontendNotConnected++;
          break;
        case 'offline':
          frontendOffline++;
          break;
        case 'error':
          frontendError++;
          break;
      }
    });

    // Process connected slaves
    Object.values(accountsData.masterAccounts || {}).forEach((master: any) => {
      if (master.connectedSlaves) {
        master.connectedSlaves.forEach((slave: any) => {
          const status = accountStatusMap.get(slave.id) || 'pending';
          switch (status) {
            case 'synchronized':
              frontendConnected++;
              break;
            case 'pending':
              frontendNotConnected++;
              break;
            case 'offline':
              frontendOffline++;
              break;
            case 'error':
              frontendError++;
              break;
          }
        });
      }
    });

    console.log('\n📊 Frontend Calculated Numbers:');
    console.log(`   Connected: ${frontendConnected}`);
    console.log(`   Not Connected: ${frontendNotConnected}`);
    console.log(`   Offline: ${frontendOffline}`);
    console.log(`   Error: ${frontendError}`);
    console.log(`   Total: ${frontendConnected + frontendNotConnected + frontendOffline + frontendError}`);

    console.log('\n📈 Comparison:');
    console.log(`   Connected: Backend ${connectivityData.stats.synchronized} vs Frontend ${frontendConnected}`);
    console.log(`   Not Connected: Backend ${connectivityData.stats.pending} vs Frontend ${frontendNotConnected}`);
    console.log(`   Offline: Backend ${connectivityData.stats.offline} vs Frontend ${frontendOffline}`);
    console.log(`   Error: Backend ${connectivityData.stats.error} vs Frontend ${frontendError}`);

    if (frontendConnected === connectivityData.stats.synchronized &&
        frontendNotConnected === connectivityData.stats.pending &&
        frontendOffline === connectivityData.stats.offline &&
        frontendError === connectivityData.stats.error) {
      console.log('\n✅ Numbers match! Frontend should display correct numbers.');
    } else {
      console.log('\n❌ Numbers don\'t match! There\'s still an issue.');
    }

  } catch (error) {
    console.error('❌ Error testing frontend numbers:', error.message);
  }
}

// Run the test
testFrontendNumbers();
