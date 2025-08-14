import csvManager from '../server/src/services/csvManager.js';

const mt4Path =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';
const mt5Path =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

console.log('🧪 Testing both MT4 and MT5 pending accounts...\n');

// Simular el escaneo del csvManager
csvManager.csvFiles.set(mt4Path, {
  lastModified: Date.now(),
  data: csvManager.parseCSVFile(mt4Path),
});

csvManager.csvFiles.set(mt5Path, {
  lastModified: Date.now(),
  data: csvManager.parseCSVFile(mt5Path),
});

// Obtener todas las cuentas
const allAccounts = await csvManager.getAllActiveAccounts();

console.log('📊 All active accounts:');
console.log(`- Masters: ${Object.keys(allAccounts.masterAccounts).length}`);
console.log(`- Slaves: ${Object.keys(allAccounts.slaveAccounts).length}`);
console.log(`- Pending: ${allAccounts.pendingAccounts.length}`);

console.log('\n📋 Pending accounts found:');
allAccounts.pendingAccounts.forEach(acc => {
  console.log(`  ✅ ${acc.account_id} (${acc.platform}): ${acc.status}`);
});

// Simular la emisión de eventos
console.log('\n🔄 Simulating scanAndEmitPendingUpdates...');
csvManager.once('pendingAccountsUpdate', data => {
  console.log('\n📨 Event received with accounts:');
  data.accounts.forEach(acc => {
    console.log(`  ✅ ${acc.account_id} (${acc.platform}): ${acc.status}`);
  });
});

await csvManager.scanAndEmitPendingUpdates();

console.log('\n✅ Test completed!');
