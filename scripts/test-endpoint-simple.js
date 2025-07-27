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

async function testEndpoint() {
  console.log('🧪 Testing connectivity endpoint...\n');

  try {
    const response = await makeRequest('http://localhost:30/api/accounts/connectivity', {
      method: 'GET',
      headers: {
        'x-api-key': 'iptrade_6616c788f776a3b114f0',
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', response.headers);

    if (response.status === 200) {
      const data = JSON.parse(response.data);
      console.log('✅ Success! Data:', JSON.stringify(data, null, 2));

      if (data.stats) {
        console.log('\n📊 Stats:');
        console.log(`   Total: ${data.stats.total}`);
        console.log(`   Connected: ${data.stats.synchronized}`);
        console.log(`   Not Connected: ${data.stats.pending}`);
        console.log(`   Offline: ${data.stats.offline}`);
        console.log(`   Error: ${data.stats.error}`);
      }
    } else {
      console.log('❌ Error response:', response.data);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Wait for server to start
setTimeout(testEndpoint, 3000);
