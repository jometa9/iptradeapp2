#!/usr/bin/env node

console.log('🧪 Testing SSE Event Emission - Backend to Frontend\n');

async function testSSEEmission() {
  try {
    const baseUrl = 'http://localhost:30';
    const apiKey = 'iptrade_6616c788f776a3b114f0';

    console.log('🔥 Step 1: Force scan-pending to trigger emission...');

    const response = await fetch(`${baseUrl}/api/csv/scan-pending`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Scan response:', {
        success: data.success,
        accountsFound: data.accounts?.length || 0,
        offlineCount: data.summary?.offlineAccounts || 0,
      });

      console.log('\n📱 Accounts details:');
      if (data.accounts) {
        data.accounts.forEach(acc => {
          console.log(
            `   ${acc.account_id}: status=${acc.status}, current_status=${acc.current_status}, timeSince=${acc.timeSinceLastPing?.toFixed(1)}s`
          );
        });
      }

      console.log('\n🎯 In server logs, you should see:');
      console.log('   - 📤 [CSV MANAGER] Emitting pending accounts update...');
      console.log('   - 🚀 [CSV MANAGER] Emitting pendingAccountsUpdate event...');
      console.log('   - ✅ [CSV MANAGER] pendingAccountsUpdate event emitted');
      console.log('   - 🔥 [SSE BACKEND] handlePendingUpdate called...');
      console.log('   - 🚀 [SSE BACKEND] Sending pendingAccountsUpdate to X connections');
      console.log('   - ✅ [SSE BACKEND] pendingAccountsUpdate event sent successfully');

      console.log('\n🌐 In browser console, you should see:');
      console.log('   - 📡 [SSE RAW] {type: "pendingAccountsUpdate", ...}');
      console.log('   - 🎯 [SSE IMPORTANT] pendingAccountsUpdate event received!');
      console.log('   - 🎯 [PENDING UPDATE] Processing pending accounts update...');
    } else {
      console.log('❌ Server error:', response.status);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

console.log('🚀 Testing SSE emission chain...');
testSSEEmission();

// Test again in 5 seconds
setTimeout(() => {
  console.log('\n⏰ Testing again after 5 seconds...');
  testSSEEmission();
}, 5000);
