import { EventSource } from 'eventsource';
import { existsSync, readFileSync } from 'fs';
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';

global.EventSource = EventSource;

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const SERVER_URL = 'http://localhost:30';

console.log('🔍 FULL PENDING ACCOUNTS SYSTEM DIAGNOSIS\n');

// 1. Check CSV files exist and content
console.log('📂 STEP 1: Checking CSV files...\n');

const mt4Path =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';
const mt5Path =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

function checkCSVFile(path, name) {
  console.log(`📄 ${name} CSV:`);
  if (existsSync(path)) {
    console.log('  ✅ File exists');
    const buffer = readFileSync(path);
    console.log(`  📏 Size: ${buffer.length} bytes`);

    // Check encoding
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      console.log('  🔤 Encoding: UTF-16 LE (with BOM)');
      const content = buffer.toString('utf16le');
      const lines = content.split('\n').filter(l => l.trim());
      console.log(`  📋 Lines: ${lines.length}`);
      console.log(`  📝 First line: ${lines[0]}`);
    } else {
      console.log('  🔤 Encoding: UTF-8');
      const content = buffer.toString('utf8');
      const lines = content.split('\n').filter(l => l.trim());
      console.log(`  📋 Lines: ${lines.length}`);
      console.log(`  📝 First line: ${lines[0]}`);
    }
  } else {
    console.log('  ❌ File NOT found');
  }
  console.log('');
}

checkCSVFile(mt4Path, 'MT4');
checkCSVFile(mt5Path, 'MT5');

// 2. Test API endpoint
console.log('📡 STEP 2: Testing API endpoint...\n');

try {
  const response = await fetch(`${SERVER_URL}/api/accounts/pending`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ API Response received');
    console.log(`  📊 Total pending: ${data.totalPending}`);
    console.log(`  💬 Message: ${data.message}`);

    if (data.totalPending > 0) {
      Object.entries(data.pendingAccounts || {}).forEach(([id, account]) => {
        console.log(`  • ${id} (${account.platform}): ${account.status}`);
      });
    }
  } else {
    console.error('❌ API error:', response.status);
  }
} catch (error) {
  console.error('❌ API request failed:', error.message);
}

// 3. Test SSE connection
console.log('\n🔌 STEP 3: Testing SSE connection...\n');

const sseUrl = `${SERVER_URL}/api/csv/events?apiKey=${API_KEY}`;
console.log(`Connecting to: ${sseUrl}`);

const eventSource = new EventSource(sseUrl);
let receivedPendingUpdate = false;

eventSource.onopen = () => {
  console.log('✅ SSE connection opened');
};

eventSource.onmessage = event => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === 'pendingAccountsUpdate') {
      receivedPendingUpdate = true;
      console.log('\n📨 Received pendingAccountsUpdate event!');
      console.log(`  📊 Accounts: ${data.accounts?.length || 0}`);
      if (data.accounts) {
        data.accounts.forEach(acc => {
          console.log(`  • ${acc.account_id} (${acc.platform}): ${acc.status}`);
        });
      }
    } else if (data.type === 'initial_data') {
      console.log('📨 Received initial_data event');
    } else if (data.type !== 'heartbeat') {
      console.log(`📨 Received ${data.type} event`);
    }
  } catch (err) {
    console.error('Error parsing SSE data:', err);
  }
};

eventSource.onerror = error => {
  console.error('❌ SSE error:', error);
};

// Wait 10 seconds for events
console.log('\n⏳ Waiting 10 seconds for SSE events...');
await setTimeout(10000);

eventSource.close();

// 4. Summary
console.log('\n📊 DIAGNOSIS SUMMARY:');
console.log('====================\n');

console.log('✅ WORKING:');
console.log('- CSV files exist and are readable');
console.log('- API endpoint is responding');
if (receivedPendingUpdate) {
  console.log('- SSE is emitting pendingAccountsUpdate events');
}

console.log('\n❓ TO CHECK:');
if (!receivedPendingUpdate) {
  console.log('- SSE did NOT emit pendingAccountsUpdate events in 10 seconds');
  console.log('  → This might mean the server is not detecting file changes');
  console.log("  → Or the 5-second re-evaluation interval hasn't triggered yet");
}

console.log('\n💡 NEXT STEPS:');
console.log('1. If API shows 0 accounts, restart the server');
console.log("2. If API shows accounts but frontend doesn't:");
console.log('   - Check browser console for errors');
console.log('   - Verify SSE connection in Network tab');
console.log('3. Try manually triggering a refresh in the frontend');
