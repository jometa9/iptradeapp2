const axios = require('axios');

async function testNewPendingFormat() {
  try {
    console.log('🔍 Testing new pending accounts format...\n');

    const response = await axios.get('http://localhost:3000/api/csv/scan-pending', {
      headers: {
        'x-api-key': 'iptrade_89536f5b9e643c0433f3',
      },
    });

    console.log('✅ Response received');
    console.log('Status:', response.status);

    const data = response.data;
    console.log('\n📊 Pending Accounts Data:');
    console.log('Total Accounts:', data.summary.totalAccounts);
    console.log('Online Accounts:', data.summary.onlineAccounts);
    console.log('Offline Accounts:', data.summary.offlineAccounts);
    console.log('Message:', data.message);

    console.log('\n🔍 Individual Accounts:');
    if (data.accounts && data.accounts.length > 0) {
      data.accounts.forEach((account, index) => {
        console.log(`\n${index + 1}. Account ID: ${account.account_id}`);
        console.log(`   Platform: ${account.platform}`);
        console.log(`   Status: ${account.current_status || account.status}`);
        console.log(
          `   Time Diff: ${account.timeDiff ? account.timeDiff.toFixed(1) + 's ago' : 'N/A'}`
        );
        console.log(`   Timestamp: ${account.timestamp}`);
        if (account.pending_indicator) {
          console.log(`   Pending Indicator: ${account.pending_indicator}`);
        }
      });
    } else {
      console.log('No accounts found');
    }

    console.log('\n📈 Platform Statistics:');
    if (data.summary.platformStats) {
      Object.entries(data.summary.platformStats).forEach(([platform, stats]) => {
        console.log(
          `- ${platform}: ${stats.total} total (${stats.online} online, ${stats.offline} offline)`
        );
      });
    }

    console.log('\n🎯 Test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Ejecutar la prueba
testNewPendingFormat();
