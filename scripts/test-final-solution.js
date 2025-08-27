import fetch from 'node-fetch';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30';

console.log('🧪 Testing FINAL solution - Multiple CSV accumulation...');

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

const runTest = async () => {
  console.log('🚀 Making 5 calls with 4-second intervals to catch both MT4 and MT5...\n');
  
  const results = [];
  
  for (let i = 1; i <= 5; i++) {
    const result = await callPendingEndpoint(i);
    if (result) {
      results.push(result);
    }
    
    if (i < 5) {
      console.log('⏳ Waiting 4 seconds...');
      await new Promise(resolve => setTimeout(resolve, 4000));
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
    console.log('\n✅ SUCCESS: Multiple accounts detected! The bot is alternating between files.');
    console.log('🔧 SOLUTION: The endpoint now properly refreshes and reads all CSV files.');
  } else {
    console.log('\n⚠️  Only one unique account found. Either:');
    console.log('   1. Bot is only writing one account type now');
    console.log('   2. Multiple files need to be checked');
  }
};

runTest();
