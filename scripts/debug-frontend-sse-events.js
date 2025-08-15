#!/usr/bin/env node

console.log('🧪 Frontend SSE Events Debugging Guide\n');

console.log('📋 Steps to debug SSE events in the frontend:\n');

console.log('1. 📱 Open Frontend in Browser');
console.log('   - Navigate to the pending accounts section');
console.log('   - Open Browser DevTools (F12)');
console.log('   - Go to Console tab');

console.log('\n2. 🔗 Check SSE Connection Status');
console.log('   Run in browser console:');
console.log('   ```javascript');
console.log('   // Check if SSE is connected');
console.log('   console.log("SSE Connected:", window.SSEService?.isConnected());');
console.log('   ```');

console.log('\n3. 📡 Monitor SSE Events');
console.log('   Run in browser console:');
console.log('   ```javascript');
console.log('   // Add a debug listener to see all SSE events');
console.log('   const debugListenerId = window.SSEService?.addListener((data) => {');
console.log('     console.log("🔍 DEBUG SSE Event:", data);');
console.log('     if (data.type === "pendingAccountsUpdate") {');
console.log('       console.log("📤 Pending Accounts Update:", data.accounts);');
console.log('       data.accounts?.forEach(acc => {');
console.log(
  '         console.log(`   Account ${acc.account_id}: status=${acc.status}, current_status=${acc.current_status}`);'
);
console.log('       });');
console.log('     }');
console.log('   });');
console.log('   console.log("Debug listener ID:", debugListenerId);');
console.log('   ```');

console.log('\n4. 🌐 Check Network Tab');
console.log('   - Go to Network tab in DevTools');
console.log('   - Look for "/csv/events" request');
console.log('   - Check if its status is "200" and type is "eventsource"');
console.log('   - Click on it and check the "EventStream" tab');

console.log('\n5. 🔍 Debug Pending Accounts Hook');
console.log('   Run in browser console:');
console.log('   ```javascript');
console.log('   // Check current pending data state');
console.log('   window.React.createElement = window.React.createElement || (() => {});');
console.log('   // If you have access to the component state, check:');
console.log(
  '   // pendingData.accounts.forEach(acc => console.log(acc.account_id, acc.current_status));'
);
console.log('   ```');

console.log('\n6. ⚠️ Common Issues to Check:');
console.log('   ❌ SSE connection failed → Check server is running');
console.log('   ❌ Events not arriving → Check Network tab for EventStream');
console.log('   ❌ Events arriving but UI not updating → Check React state updates');
console.log('   ❌ Wrong field names → Verify current_status vs status');
console.log('   ❌ Hidden accounts filtering → Check useHiddenPendingAccounts');

console.log('\n7. 📊 Expected Event Structure:');
console.log('   ```json');
console.log('   {');
console.log('     "type": "pendingAccountsUpdate",');
console.log('     "accounts": [');
console.log('       {');
console.log('         "account_id": "11219046",');
console.log('         "platform": "MT5",');
console.log('         "status": "offline",');
console.log('         "current_status": "offline",');
console.log('         "timestamp": "1754866078",');
console.log('         "timeSinceLastPing": 7.1');
console.log('       }');
console.log('     ],');
console.log('     "summary": {');
console.log('       "totalAccounts": 1,');
console.log('       "offlineAccounts": 1');
console.log('     }');
console.log('   }');
console.log('   ```');

console.log('\n8. 🎯 Visual Debugging');
console.log('   In browser console, check the current DOM:');
console.log('   ```javascript');
console.log('   // Check if pending account divs have correct classes');
console.log('   document.querySelectorAll("[class*=\\"bg-orange-50\\"]").forEach(el => {');
console.log('     console.log("Offline account div:", el);');
console.log('   });');
console.log('   ');
console.log('   document.querySelectorAll("[class*=\\"bg-green-50\\"]").forEach(el => {');
console.log('     console.log("Online account div:", el);');
console.log('   });');
console.log('   ```');

console.log('\n✅ This debugging should help identify where the issue is:');
console.log('   - SSE connection problems');
console.log('   - Event reception issues');
console.log('   - State update problems');
console.log('   - UI rendering issues');

console.log('\n🚀 Next Steps:');
console.log('   1. Run these commands in browser console');
console.log('   2. Monitor the logs for 30 seconds');
console.log('   3. Check if events arrive when accounts go offline');
console.log('   4. Verify if state updates correctly');
console.log('   5. Confirm if UI renders the new state');
