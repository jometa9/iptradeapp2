import { EventSource } from 'eventsource';
import { setTimeout } from 'timers/promises';

global.EventSource = EventSource;

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const SERVER_URL = 'http://localhost:30';

console.log('🧪 TESTING FULL PENDING ACCOUNTS FLOW\n');

// Test SSE initial_data
console.log('🔌 Connecting to SSE to check initial_data...');

const sseUrl = `${SERVER_URL}/api/csv/events?apiKey=${API_KEY}`;
const eventSource = new EventSource(sseUrl);

let receivedInitialData = false;
let pendingAccountsInInitialData = 0;

eventSource.onopen = () => {
  console.log('✅ SSE connection opened');
};

eventSource.onmessage = event => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === 'initial_data') {
      receivedInitialData = true;
      console.log('\n📨 Received initial_data event!');
      console.log('📊 Structure:', Object.keys(data));

      if (data.accounts) {
        console.log('📦 Accounts structure:', Object.keys(data.accounts));

        if (data.accounts.pendingAccounts) {
          pendingAccountsInInitialData = data.accounts.pendingAccounts.length;
          console.log(`✅ Pending accounts in initial_data: ${pendingAccountsInInitialData}`);

          data.accounts.pendingAccounts.forEach(acc => {
            console.log(
              `  • ${acc.account_id || acc.id} (${acc.platform}): ${acc.status || acc.current_status}`
            );
          });
        } else {
          console.log('❌ No pendingAccounts field in initial_data');
        }
      }
    }
  } catch (err) {
    console.error('Error parsing SSE data:', err);
  }
};

eventSource.onerror = error => {
  console.error('❌ SSE error:', error);
};

// Wait for initial_data
await setTimeout(3000);
eventSource.close();

// Summary
console.log('\n📊 RESULTS SUMMARY:');
console.log('==================\n');

if (receivedInitialData) {
  console.log('✅ SSE sends initial_data');

  if (pendingAccountsInInitialData > 0) {
    console.log(`✅ Initial data includes ${pendingAccountsInInitialData} pending accounts`);
    console.log('✅ Frontend should display pending accounts immediately!');
  } else {
    console.log('❌ Initial data does NOT include pending accounts');
    console.log('⚠️  Frontend will need to wait for pendingAccountsUpdate events');
  }
} else {
  console.log('❌ No initial_data received');
}

console.log('\n💡 TO CHECK IN BROWSER:');
console.log('1. Open browser console (F12)');
console.log('2. Look for: "📨 Received initial_data with pending accounts via SSE"');
console.log('3. Look for: "📊 Initial data contains X pending accounts"');
console.log('4. Pending accounts should appear immediately in the UI');

console.log('\n🔄 If not working:');
console.log('1. Restart the server (Ctrl+C and npm run electron:dev)');
console.log('2. Clear browser cache and reload');
console.log('3. Check for JavaScript errors in console');
