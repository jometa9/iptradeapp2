const fetch = require('node-fetch');

const SERVER_PORT = '30';
const BASE_URL = `http://localhost:${SERVER_PORT}`;

// Test API key (you'll need to replace this with a valid one)
const API_KEY = 'your-api-key-here';

async function testUpdateConfiguration() {
  console.log('🧪 Testing Update Configuration Functionality\n');

  try {
    // Test 1: Convert pending account to master
    console.log('1️⃣ Testing: Convert pending account to master');
    const masterPayload = {
      newType: 'master',
    };

    const masterResponse = await fetch(`${BASE_URL}/api/csv/pending/12345/update-type`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(masterPayload),
    });

    console.log('   Master conversion status:', masterResponse.status);
    if (masterResponse.ok) {
      const masterResult = await masterResponse.json();
      console.log('   ✅ Master conversion successful:', masterResult.message);
    } else {
      const error = await masterResponse.json();
      console.log('   ❌ Master conversion failed:', error.message);
    }

    // Test 2: Convert pending account to slave
    console.log('\n2️⃣ Testing: Convert pending account to slave');
    const slavePayload = {
      newType: 'slave',
      slaveConfig: {
        masterAccountId: '67890',
        lotCoefficient: 1.5,
        forceLot: 0.1,
        reverseTrade: false,
      },
    };

    const slaveResponse = await fetch(`${BASE_URL}/api/csv/pending/12345/update-type`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(slavePayload),
    });

    console.log('   Slave conversion status:', slaveResponse.status);
    if (slaveResponse.ok) {
      const slaveResult = await slaveResponse.json();
      console.log('   ✅ Slave conversion successful:', slaveResult.message);
    } else {
      const error = await slaveResponse.json();
      console.log('   ❌ Slave conversion failed:', error.message);
    }

    // Test 3: Convert account back to pending
    console.log('\n3️⃣ Testing: Convert account back to pending');
    const pendingResponse = await fetch(`${BASE_URL}/api/csv/convert-to-pending/12345`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    });

    console.log('   Convert to pending status:', pendingResponse.status);
    if (pendingResponse.ok) {
      const pendingResult = await pendingResponse.json();
      console.log('   ✅ Convert to pending successful:', pendingResult.message);
    } else {
      const error = await pendingResponse.json();
      console.log('   ❌ Convert to pending failed:', error.message);
    }

    console.log('\n🎉 Update configuration tests completed!');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testUpdateConfiguration();
