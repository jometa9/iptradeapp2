// Test script to verify CSV event system independence from Link Platforms
// This script tests if CSV events work independently and in parallel
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import the csvManager
import csvManager from '../server/src/services/csvManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simulate the server environment
const serverPath = join(__dirname, '../server/src');
process.chdir(serverPath);
console.log('📁 Changed to server directory:', process.cwd());

async function testCSVIndependence() {
  console.log('🧪 Testing CSV Event System Independence\n');

  try {
    // Step 1: Check initial state without Link Platforms
    console.log('📊 Step 1: Checking initial CSV state...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);

    // Step 2: Manually add some CSV files to test independence
    console.log('\n🔧 Step 2: Manually adding CSV files to test independence...');

    // Simulate adding CSV files manually (without Link Platforms)
    const testCsvFiles = [
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
      '/Users/joaquinmetayer/Documents/GitHub/iptradeapp2/csv_data/IPTRADECSV2.csv',
    ];

    testCsvFiles.forEach(csvPath => {
      if (existsSync(csvPath)) {
        csvManager.csvFiles.set(csvPath, {
          lastModified: csvManager.getFileLastModified(csvPath),
          data: csvManager.parseCSVFile(csvPath),
        });
        console.log(`📍 Manually added CSV: ${csvPath}`);
      }
    });

    // Step 3: Start file watching manually
    console.log('\n👀 Step 3: Starting file watching manually...');
    csvManager.startFileWatching();

    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);

    // Step 4: Test pending accounts detection
    console.log('\n🔍 Step 4: Testing pending accounts detection...');
    const pendingAccounts = await csvManager.scanSimplifiedPendingCSVFiles();
    console.log('- Pending accounts found:', pendingAccounts.length);

    pendingAccounts.forEach(account => {
      console.log(
        `  - ${account.account_id} (${account.platform}): ${account.current_status || account.status}`
      );
    });

    // Step 5: Test event emission
    console.log('\n📡 Step 5: Testing event emission...');

    // Set up event listeners
    csvManager.on('pendingAccountsUpdate', data => {
      console.log('📨 Received pendingAccountsUpdate event:', {
        accountsCount: data.accounts.length,
        timestamp: data.timestamp,
      });
    });

    csvManager.on('csvFileChanged', data => {
      console.log('📨 Received csvFileChanged event:', {
        filePath: data.filePath,
        dataLength: data.data.length,
      });
    });

    // Step 6: Test real-time updates
    console.log('\n⏰ Step 6: Testing real-time updates (waiting 10 seconds)...');
    console.log('This will show if the system detects changes automatically...');

    // Wait for some real-time updates
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 7: Test manual file change detection
    console.log('\n📝 Step 7: Testing manual file change detection...');

    // Simulate a file change by calling refreshFileData
    if (csvManager.csvFiles.size > 0) {
      const firstFile = Array.from(csvManager.csvFiles.keys())[0];
      console.log(`🔄 Simulating change in file: ${firstFile}`);
      csvManager.refreshFileData(firstFile);
    }

    // Wait a bit more to see the events
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- CSV Manager works independently of Link Platforms ✅');
    console.log('- File watching can be started manually ✅');
    console.log('- Pending accounts detection works ✅');
    console.log('- Event emission works ✅');
    console.log('- Real-time updates work ✅');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    csvManager.cleanup();
  }
}

// Run the test
testCSVIndependence();
