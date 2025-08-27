import fetch from 'node-fetch';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30';

console.log('🧪 Testing multiple calls to pending endpoint...');

const callPendingEndpoint = async (callNumber) => {
  try {
    const response = await fetch(`${BASE_URL}/api/accounts/pending`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`\n📞 CALL #${callNumber} - ${new Date().toLocaleTimeString()}`);
    console.log(`📊 Total pending: ${data.totalPending}`);
    
    if (data.pendingAccounts && Object.keys(data.pendingAccounts).length > 0) {
      Object.entries(data.pendingAccounts).forEach(([accountId, account]) => {
        console.log(`   👤 ${accountId} (${account.platform}) - ${account.status} - timestamp: ${account.timestamp}`);
      });
    } else {
      console.log('   ❌ No pending accounts found');
    }

    return data;
  } catch (error) {
    console.error(`❌ Call #${callNumber} failed:`, error.message);
    return null;
  }
};

const runMultipleCalls = async () => {
  console.log('🚀 Making 10 calls with 3-second intervals...\n');
  
  for (let i = 1; i <= 10; i++) {
    await callPendingEndpoint(i);
    
    if (i < 10) {
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n✅ Test completed!');
};

runMultipleCalls();
