const fetch = require('node-fetch');

async function testConnectivity() {
  try {
    const response = await fetch('http://localhost:30/api/accounts/connectivity', {
      headers: {
        'x-api-key': 'iptrade_89536f5b9e643c0433f3',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Connectivity endpoint working:');
      console.log('Stats:', data.stats);
      console.log('Pending should be:', data.stats.pending);
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testConnectivity();
