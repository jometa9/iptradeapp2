import fetch from 'node-fetch';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30';

console.log('🧪 Testing RAPID calls to catch MT4/MT5 alternation...');

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
    
    console.log(`📞 CALL #${callNumber} - ${new Date().toLocaleTimeString()}`);
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

const runRapidTest = async () => {
  console.log('🚀 Making 10 RAPID calls with 1-second intervals...\n');
  
  const results = [];
  
  for (let i = 1; i <= 10; i++) {
    const result = await callPendingEndpoint(i);
    if (result) {
      results.push(result);
    }
    
    if (i < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
    }
  }
  
  // Analyze results
  console.log('\n📊 ANALYSIS:');
  const uniqueAccounts = new Set();
  results.forEach((result, index) => {
    if (result.pendingAccounts) {
      Object.keys(result.pendingAccounts).forEach(accountId => {
        uniqueAccounts.add(accountId);
      });
    }
  });
  
  console.log(`🔍 Unique accounts found across all calls: ${uniqueAccounts.size}`);
  uniqueAccounts.forEach(accountId => {
    console.log(`   - ${accountId}`);
  });
  
  if (uniqueAccounts.size > 1) {
    console.log('\n✅ SUCCESS: Multiple accounts detected! The bots are alternating.');
    console.log('🔧 SOLUTION: The endpoint now properly refreshes and reads all CSV files.');
  } else {
    console.log('\n⚠️  Only one unique account found.');
    console.log('💡 The bots might be writing to the same file and overwriting each other.');
  }
};

runRapidTest();
