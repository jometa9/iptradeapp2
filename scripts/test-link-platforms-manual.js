// Test script to verify Link Platforms manual execution behavior
// This script simulates the manual execution of Link Platforms from the UI
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import the linkPlatformsController
import linkPlatformsController from '../server/src/controllers/linkPlatformsController.js';
import csvManager from '../server/src/services/csvManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simulate the server environment
const serverPath = join(__dirname, '../server/src');
process.chdir(serverPath);
console.log('📁 Changed to server directory:', process.cwd());

async function testManualLinkPlatforms() {
  console.log('🧪 Testing Manual Link Platforms Execution\n');

  try {
    // Step 1: Check initial state
    console.log('📊 Step 1: Checking initial state...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- CSV files list:');
    csvManager.csvFiles.forEach((fileData, filePath) => {
      console.log(`  - ${filePath}`);
    });

    // Step 2: Execute manual Link Platforms
    console.log('\n🔗 Step 2: Executing manual Link Platforms...');
    const result = await linkPlatformsController.findAndSyncMQLFoldersManual();

    console.log('✅ Manual Link Platforms completed');
    console.log('- MQL4 folders found:', result.mql4Folders.length);
    console.log('- MQL5 folders found:', result.mql5Folders.length);
    console.log('- CSV files found:', result.csvFiles.length);
    console.log('- Errors:', result.errors.length);

    if (result.errors.length > 0) {
      console.log('⚠️ Errors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    // Step 3: Check state after execution
    console.log('\n📊 Step 3: Checking state after execution...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- CSV files list:');
    csvManager.csvFiles.forEach((fileData, filePath) => {
      console.log(`  - ${filePath}`);
    });

    // Step 4: Scan for pending accounts
    console.log('\n🔍 Step 4: Scanning for pending accounts...');
    const pendingAccounts = await csvManager.scanSimplifiedPendingCSVFiles();
    console.log('- Pending accounts found:', pendingAccounts.length);

    pendingAccounts.forEach(account => {
      console.log(
        `  - ${account.account_id} (${account.platform}): ${account.current_status || account.status}`
      );
    });

    // Step 5: Check if file watching is active
    console.log('\n👀 Step 5: Checking file watching status...');
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Heartbeat interval active:', !!csvManager.heartbeatInterval);

    console.log('\n🎉 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testManualLinkPlatforms();
