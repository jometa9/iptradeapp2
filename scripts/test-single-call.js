import fetch from 'node-fetch';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30';

console.log('🧪 Testing single call to see endpoint logs...');

const callPendingEndpoint = async () => {
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
    console.error(`❌ Error:`, error.message);
    return null;
  }
};

callPendingEndpoint();
