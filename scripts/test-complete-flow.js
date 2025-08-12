// Test script to simulate the complete flow with delayed Link Platforms
// This simulates the new behavior where Link Platforms waits for frontend
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

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Flow with Delayed Link Platforms\n');

  try {
    // Step 1: Simulate server startup
    console.log('🚀 Step 1: Server starting up...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);

    // Step 2: Set up event listeners (simulating frontend connection)
    console.log('\n📡 Step 2: Setting up event listeners (simulating frontend connection)...');

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

    // Step 3: Wait 3 seconds (simulating the delay)
    console.log('\n⏰ Step 3: Waiting 3 seconds (simulating delay for frontend connection)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Execute Link Platforms (simulating delayed auto-start)
    console.log('\n🧩 Step 4: Executing delayed Link Platforms...');

    const result = await linkPlatformsController.findAndSyncMQLFoldersManual();

    console.log('✅ Delayed Link Platforms result:', result);
    console.log('- MQL4 folders found:', result.mql4Folders.length);
    console.log('- MQL5 folders found:', result.mql5Folders.length);
    console.log('- CSV files found:', result.csvFiles.length);
    console.log('- Errors:', result.errors.length);

    // Step 5: Check state after execution
    console.log('\n📊 Step 5: Checking state after delayed execution...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Heartbeat interval active:', !!csvManager.heartbeatInterval);

    // Step 6: Wait for real-time updates to see if events are emitted
    console.log('\n⏰ Step 6: Waiting for real-time updates (10 seconds)...');
    console.log('This will show if the delayed execution properly emits events...');

    // Wait for some real-time updates
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log('- Delayed Link Platforms executed:', !!result);
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
testCompleteFlow();
