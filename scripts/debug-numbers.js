const https = require('https');
const http = require('http');

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const req = client.request(url, options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}

async function debugNumbers() {
  console.log('🔍 Debugging number discrepancies...\n');

  try {
    // Test connectivity endpoint
    console.log('📡 Testing connectivity endpoint...');
    const connectivityResponse = await makeRequest(
      'http://localhost:30/api/accounts/connectivity',
      {
        method: 'GET',
        headers: {
          'x-api-key': 'iptrade_6616c788f776a3b114f0',
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📊 Connectivity Response Status:', connectivityResponse.status);

    if (connectivityResponse.status === 200) {
      const connectivityData = JSON.parse(connectivityResponse.data);
      console.log('✅ Connectivity Data:', JSON.stringify(connectivityData.stats, null, 2));
    } else {
      console.log('❌ Connectivity Error:', connectivityResponse.data);
    }

    // Test accounts endpoint
    console.log('\n📡 Testing accounts endpoint...');
    const accountsResponse = await makeRequest('http://localhost:30/api/accounts/all', {
      method: 'GET',
      headers: {
        'x-api-key': 'iptrade_6616c788f776a3b114f0',
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Accounts Response Status:', accountsResponse.status);

    if (accountsResponse.status === 200) {
      const accountsData = JSON.parse(accountsResponse.data);
      console.log('✅ Accounts Data:');
      console.log('   Master Accounts:', Object.keys(accountsData.masterAccounts || {}).length);
      console.log('   Unconnected Slaves:', (accountsData.unconnectedSlaves || []).length);

      // Count connected slaves
      let totalConnectedSlaves = 0;
      Object.values(accountsData.masterAccounts || {}).forEach(master => {
        if (master.connectedSlaves) {
          totalConnectedSlaves += master.connectedSlaves.length;
        }
      });
      console.log('   Connected Slaves:', totalConnectedSlaves);
      console.log(
        '   Total Accounts:',
        Object.keys(accountsData.masterAccounts || {}).length +
          (accountsData.unconnectedSlaves || []).length +
          totalConnectedSlaves
      );
    } else {
      console.log('❌ Accounts Error:', accountsResponse.data);
    }

    console.log('\n📋 Expected vs Actual:');
    console.log('   Expected Total: 15');
    console.log('   Expected Connected: 2');
    console.log('   Expected Not Connected: 12');
    console.log('   Expected Offline: 1');
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Wait for server to start
setTimeout(debugNumbers, 3000);
