import fetch from 'node-fetch';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const SERVER_URL = 'http://localhost:30';

console.log('🧪 Testing pending accounts endpoints...\n');

async function testPendingEndpoints() {
  try {
    // Test 1: Main pending accounts endpoint
    console.log('📡 Test 1: Calling /api/accounts/pending...');

    const pendingResponse = await fetch(`${SERVER_URL}/api/accounts/pending`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json();
      console.log('✅ Pending accounts response:');
      console.log(`- Total: ${pendingData.totalPending}`);
      console.log(`- Message: ${pendingData.message}`);

      Object.entries(pendingData.pendingAccounts || {}).forEach(([id, account]) => {
        console.log(`  • ${id} (${account.platform}): ${account.status}`);
      });
    } else {
      console.error('❌ Pending accounts error:', pendingResponse.status);
    }

    // Test 2: CSV scan endpoint
    console.log('\n📡 Test 2: Calling /api/csv/pending-accounts/scan...');

    const scanResponse = await fetch(`${SERVER_URL}/api/csv/pending-accounts/scan`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (scanResponse.ok) {
      const scanData = await scanResponse.json();
      console.log('✅ CSV scan response:');
      console.log(`- Success: ${scanData.success}`);
      console.log(`- Total accounts: ${scanData.summary?.totalAccounts || 0}`);
      console.log(`- Online: ${scanData.summary?.onlineAccounts || 0}`);
      console.log(`- Offline: ${scanData.summary?.offlineAccounts || 0}`);
    } else {
      console.error('❌ CSV scan error:', scanResponse.status);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testPendingEndpoints();
