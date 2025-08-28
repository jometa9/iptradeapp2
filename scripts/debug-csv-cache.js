import csvManager from '../server/src/services/csvManager.js';

console.log('🔍 Debugging CSV cache and multiple file handling...');

const debugCSVCache = () => {
  console.log('\n📋 CSV Files in Cache:');
  console.log(`📊 Total files cached: ${csvManager.csvFiles.size}`);
  
  if (csvManager.csvFiles.size === 0) {
    console.log('❌ No CSV files in cache!');
    
    // Try to load from cache
    console.log('\n🔄 Attempting to load from cache...');
    const cachedPaths = csvManager.loadCSVPathsFromCache();
    console.log(`📁 Found ${cachedPaths.length} cached paths:`);
    cachedPaths.forEach((path, index) => {
      console.log(`   ${index + 1}. ${path}`);
    });
    
    return;
  }
  
  // Show all cached files
  let fileIndex = 1;
  csvManager.csvFiles.forEach((fileData, filePath) => {
    console.log(`\n📄 File ${fileIndex}: ${filePath}`);
    console.log(`   📅 Last Modified: ${fileData.lastModified}`);
    console.log(`   📊 Data rows: ${fileData.data.length}`);
    
    fileData.data.forEach((row, rowIndex) => {
      if (row.account_id) {
        console.log(`      ${rowIndex + 1}. ${row.account_id} (${row.platform || 'Unknown'}) - ${row.account_type} - ${row.status || 'Unknown'}`);
      }
    });
    
    fileIndex++;
  });
  
  const allAccounts = csvManager.getAllActiveAccounts();
  console.log(`📊 Total pending accounts found: ${allAccounts.pendingAccounts.length}`);
  
  allAccounts.pendingAccounts.forEach((account, index) => {
    console.log(`   ${index + 1}. ${account.account_id} (${account.platform}) - ${account.status} - File: ${account.filePath}`);
  });
};

debugCSVCache();
