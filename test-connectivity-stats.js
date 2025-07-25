const API_BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3';

async function testConnectivityStats() {
  console.log('🧪 Testing connectivity statistics endpoint...\n');

  try {
    // Test the new connectivity endpoint
    const response = await fetch(`${API_BASE_URL}/accounts/connectivity`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch connectivity stats:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('✅ Connectivity stats retrieved successfully');
    console.log('\n📊 Statistics:');
    console.log(`   Total accounts: ${data.stats.total}`);
    console.log(`   Connected (synchronized): ${data.stats.synchronized}`);
    console.log(`   Not connected (pending): ${data.stats.pending}`);
    console.log(`   Offline: ${data.stats.offline}`);
    console.log(`   Error: ${data.stats.error}`);

    console.log('\n📋 Master accounts:');
    console.log(`   Total masters: ${data.stats.masters.total}`);
    console.log(`   Connected masters: ${data.stats.masters.synchronized}`);
    console.log(`   Not connected masters: ${data.stats.masters.pending}`);
    console.log(`   Offline masters: ${data.stats.masters.offline}`);
    console.log(`   Error masters: ${data.stats.masters.error}`);

    console.log('\n📋 Slave accounts:');
    console.log(`   Total slaves: ${data.stats.slaves.total}`);
    console.log(`   Connected slaves: ${data.stats.slaves.synchronized}`);
    console.log(`   Not connected slaves: ${data.stats.slaves.pending}`);
    console.log(`   Offline slaves: ${data.stats.slaves.offline}`);
    console.log(`   Error slaves: ${data.stats.slaves.error}`);

    console.log('\n🔍 Connectivity details:');
    data.stats.connectivityDetails.forEach(detail => {
      const status =
        detail.status === 'synchronized'
          ? '✅ Connected'
          : detail.status === 'pending'
            ? '⏳ Not Connected'
            : detail.status === 'offline'
              ? '📴 Offline'
              : detail.status === 'error'
                ? '❌ Error'
                : '❓ Unknown';

      console.log(`   ${detail.accountId} (${detail.type}): ${status}`);

      if (detail.type === 'master' && detail.connectedSlaves > 0) {
        console.log(`     └─ Connected to ${detail.connectedSlaves} slave(s)`);
      } else if (detail.type === 'slave' && detail.connectedTo) {
        console.log(`     └─ Connected to master: ${detail.connectedTo}`);
      }
    });

    // Compare with old stats endpoint
    console.log('\n🔄 Comparing with old stats endpoint...');
    const oldResponse = await fetch(`${API_BASE_URL}/accounts/stats`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (oldResponse.ok) {
      const oldData = await oldResponse.json();
      console.log('\n📊 Old statistics (activity-based):');
      console.log(`   Total accounts: ${oldData.stats.total}`);
      console.log(`   Synchronized: ${oldData.stats.synchronized}`);
      console.log(`   Pending: ${oldData.stats.pending}`);
      console.log(`   Offline: ${oldData.stats.offline}`);
      console.log(`   Error: ${oldData.stats.error}`);

      console.log('\n📈 Differences:');
      console.log(
        `   Connected vs Synchronized: ${data.stats.synchronized} vs ${oldData.stats.synchronized}`
      );
      console.log(`   Not Connected vs Pending: ${data.stats.pending} vs ${oldData.stats.pending}`);
    }
  } catch (error) {
    console.error('❌ Error testing connectivity stats:', error.message);
  }
}

// Run the test
testConnectivityStats();
