const axios = require('axios');

async function testConnectivity() {
  try {
    console.log('🔍 Testing connectivity endpoint...\n');

    const response = await axios.get('http://localhost:30/api/accounts/connectivity', {
      headers: {
        'x-api-key': 'iptrade_89536f5b9e643c0433f3',
      },
    });

    console.log('✅ Response received');
    console.log('Status:', response.status);

    const data = response.data;
    console.log('\n📊 Stats:');
    console.log('Total:', data.stats.total);
    console.log('Offline:', data.stats.offline);
    console.log('Pending:', data.stats.pending);
    console.log('Synchronized:', data.stats.synchronized);

    console.log('\n🔍 Connectivity Details:');
    if (data.stats.connectivityDetails) {
      data.stats.connectivityDetails.forEach(account => {
        console.log(`- ${account.accountId} (${account.type}): ${account.status}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testConnectivity();
