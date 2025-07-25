const fetch = require('node-fetch');

async function testConnectivityFix() {
  console.log('🧪 Testing connectivity fix...\n');

  try {
    const response = await fetch('http://localhost:30/api/accounts/connectivity', {
      headers: {
        'x-api-key': 'iptrade_6616c788f776a3b114f0',
      },
    });

    if (response.ok) {
      const data = await response.json();

      console.log('📊 Backend Connectivity Stats:');
      console.log(`   Total: ${data.stats.total}`);
      console.log(`   Connected: ${data.stats.synchronized}`);
      console.log(`   Not Connected: ${data.stats.pending}`);
      console.log(`   Offline: ${data.stats.offline}`);
      console.log(`   Error: ${data.stats.error}`);

      console.log('\n📋 Expected Results:');
      console.log(`   Connected: 2 (222222 with slave, 555555 connected to master)`);
      console.log(`   Not Connected: 12 (6 masters without slaves + 6 slaves without master)`);
      console.log(`   Offline: 1 (remaining accounts)`);

      console.log('\n📈 Comparison:');
      console.log(
        `   Connected: Expected 2, Got ${data.stats.synchronized} ${data.stats.synchronized === 2 ? '✅' : '❌'}`
      );
      console.log(
        `   Not Connected: Expected 12, Got ${data.stats.pending} ${data.stats.pending === 12 ? '✅' : '❌'}`
      );

      if (data.stats.pending === 12) {
        console.log('\n🎉 SUCCESS! The numbers should now be correct in the frontend.');
      } else {
        console.log('\n❌ Still incorrect. Need to debug further.');
      }
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Wait for server to start
setTimeout(testConnectivityFix, 3000);
