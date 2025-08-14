import fetch from 'node-fetch';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const SERVER_URL = 'http://localhost:30';

console.log('🧪 Testing /api/accounts/all endpoint...\n');

async function testAccountsEndpoint() {
  try {
    console.log('📡 Calling /api/accounts/all...');

    const response = await fetch(`${SERVER_URL}/api/accounts/all`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Response error:', response.status, response.statusText);
      const error = await response.text();
      console.error('Error details:', error);
      return;
    }

    const data = await response.json();

    console.log('\n✅ Response received:');
    console.log(`- Total Master Accounts: ${data.totalMasterAccounts}`);
    console.log(`- Total Slave Accounts: ${data.totalSlaveAccounts}`);
    console.log(`- Total Connections: ${data.totalConnections}`);

    console.log('\n📊 Master Accounts:');
    Object.entries(data.masterAccounts || {}).forEach(([id, master]) => {
      console.log(`  - ${id} (${master.platform}): ${master.status || 'offline'}`);
      if (master.connectedSlaves && master.connectedSlaves.length > 0) {
        console.log(`    Connected slaves: ${master.connectedSlaves.length}`);
      }
    });

    console.log('\n📊 Unconnected Slaves:');
    (data.unconnectedSlaves || []).forEach(slave => {
      console.log(`  - ${slave.id} (${slave.platform}): ${slave.status || 'offline'}`);
    });

    console.log('\n✅ Endpoint is working with CSV data!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testAccountsEndpoint();
