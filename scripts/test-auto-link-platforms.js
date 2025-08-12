// Test script to simulate exactly what dev.js does on auto-start
// This will help identify why CSV events don't work on auto-start
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import the linkPlatformsController and csvManager
import linkPlatformsController from '../server/src/controllers/linkPlatformsController.js';
import csvManager from '../server/src/services/csvManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simulate the server environment
const serverPath = join(__dirname, '../server/src');
process.chdir(serverPath);
console.log('📁 Changed to server directory:', process.cwd());

async function testAutoLinkPlatforms() {
  console.log('🧪 Testing Auto Link Platforms (simulating dev.js behavior)\n');

  try {
    // Step 1: Check initial state (like dev.js does)
    console.log('📊 Step 1: Checking initial state...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Link Platforms state before auto-start:', linkPlatformsController.isLinking);

    // Step 2: Simulate exactly what dev.js does
    console.log('\n🧩 Step 2: Auto-running Link Platforms on server start (like dev.js)...');

    // Set up event listeners BEFORE calling the function (like the real app would)
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

    // Call the exact same function that dev.js calls
    const result = await linkPlatformsController.findAndSyncMQLFoldersManual();

    console.log('✅ Auto Link Platforms result:', result);
    console.log('- MQL4 folders found:', result.mql4Folders.length);
    console.log('- MQL5 folders found:', result.mql5Folders.length);
    console.log('- CSV files found:', result.csvFiles.length);
    console.log('- Errors:', result.errors.length);
    console.log('- Link Platforms state after auto-start:', linkPlatformsController.isLinking);

    // Step 3: Check state after execution
    console.log('\n📊 Step 3: Checking state after auto-execution...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Heartbeat interval active:', !!csvManager.heartbeatInterval);

    // Step 4: Test pending accounts detection
    console.log('\n🔍 Step 4: Testing pending accounts detection...');
    const pendingAccounts = await csvManager.scanSimplifiedPendingCSVFiles();
    console.log('- Pending accounts found:', pendingAccounts.length);

    pendingAccounts.forEach(account => {
      console.log(
        `  - ${account.account_id} (${account.platform}): ${account.current_status || account.status}`
      );
    });

    // Step 5: Wait for real-time updates to see if events are emitted
    console.log('\n⏰ Step 5: Waiting for real-time updates (15 seconds)...');
    console.log('This will show if the auto-start properly configured CSV events...');

    // Wait for some real-time updates
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log('- Auto Link Platforms executed:', !!result);
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- File watching active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Events being emitted:', 'Check logs above');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    csvManager.cleanup();
  }
}

// Run the test
testAutoLinkPlatforms();
