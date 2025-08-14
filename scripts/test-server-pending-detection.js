// Now test the API endpoint
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';

console.log('🧪 Testing server pending accounts detection...\n');

console.log('⏳ Waiting for server to fully initialize (5 seconds)...');
await setTimeout(5000);

console.log('\n📡 Checking server logs...');
console.log('You should see in the server logs:');
console.log('- 👀 Starting file watching for 2 CSV files...');
console.log('- 📤 Emitting pending accounts update with 2 accounts');
console.log('   - 250062001: online');
console.log('   - 11219046: online');

console.log('\n🔍 If you only see 1 account, the MT5 file UTF-16 fix might not be working.');
console.log('🔍 If you see 0 accounts, the CSV files might not be detected.\n');

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const SERVER_URL = 'http://localhost:30';

console.log('📡 Testing /api/accounts/pending endpoint...');

try {
  const response = await fetch(`${SERVER_URL}/api/accounts/pending`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (response.ok) {
    const data = await response.json();
    console.log('\n✅ API Response:');
    console.log(`- Total pending: ${data.totalPending}`);
    console.log(`- Message: ${data.message}`);

    if (data.totalPending > 0) {
      console.log('\n📋 Pending accounts found:');
      Object.entries(data.pendingAccounts || {}).forEach(([id, account]) => {
        console.log(`  • ${id} (${account.platform}): ${account.status}`);
      });
    }
  } else {
    console.error('❌ API error:', response.status);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n💡 If accounts are detected by the API but not shown in frontend:');
console.log('1. Check browser console for SSE connection');
console.log('2. Check for "📨 Received pending accounts update via SSE" messages');
console.log('3. Verify no JavaScript errors in browser console');
