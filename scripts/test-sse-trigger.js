// Test script to simulate the new flow where Link Platforms is triggered by SSE connection
// This simulates the frontend connecting to SSE and triggering auto Link Platforms
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

async function testSSETrigger() {
  console.log('🧪 Testing SSE-Triggered Link Platforms\n');

  try {
    // Step 1: Simulate server startup (no Link Platforms yet)
    console.log('🚀 Step 1: Server starting up...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);

    // Step 2: Set up event listeners (simulating frontend setup)
    console.log('\n📡 Step 2: Setting up event listeners (simulating frontend setup)...');

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

    // Step 3: Simulate frontend connecting to SSE (this should trigger Link Platforms)
    console.log('\n🔌 Step 3: Simulating frontend connecting to SSE...');
    console.log('This should trigger auto Link Platforms...');

    // Simulate the SSE connection logic from csvRoutes.js
    const activeSSEConnections = 1; // Simulate first connection

    if (activeSSEConnections === 1) {
      console.log('🎯 First frontend connection detected - triggering auto Link Platforms...');

      // Import and execute Link Platforms asynchronously (like in the real code)
      const { default: linkPlatformsController } = await import(
        '../server/src/controllers/linkPlatformsController.js'
      );

      const result = await linkPlatformsController.findAndSyncMQLFoldersManual();
      console.log('✅ Auto Link Platforms completed after frontend connection:', {
        mql4Folders: result.mql4Folders.length,
        mql5Folders: result.mql5Folders.length,
        csvFiles: result.csvFiles.length,
        errors: result.errors.length,
      });
    }

    // Step 4: Check state after SSE-triggered execution
    console.log('\n📊 Step 4: Checking state after SSE-triggered execution...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Heartbeat interval active:', !!csvManager.heartbeatInterval);

    // Step 5: Test pending accounts detection
    console.log('\n🔍 Step 5: Testing pending accounts detection...');
    const pendingAccounts = await csvManager.scanSimplifiedPendingCSVFiles();
    console.log('- Pending accounts found:', pendingAccounts.length);

    pendingAccounts.forEach(account => {
      console.log(
        `  - ${account.account_id} (${account.platform}): ${account.current_status || account.status}`
      );
    });

    // Step 6: Wait for real-time updates to see if events are emitted
    console.log('\n⏰ Step 6: Waiting for real-time updates (10 seconds)...');
    console.log('This will show if the SSE-triggered execution properly emits events...');

    // Wait for some real-time updates
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log('- SSE-triggered Link Platforms executed: true');
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
testSSETrigger();
