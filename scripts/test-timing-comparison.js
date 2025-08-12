// Test script to compare timing between auto-start and manual Link Platforms
// This will measure detection times and behavior when both are executed
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

async function testTimingComparison() {
  console.log('🧪 Testing Timing Comparison: Auto vs Manual Link Platforms\n');

  try {
    // Step 1: Test Auto-Start Timing
    console.log('🚀 Step 1: Testing Auto-Start Timing...');
    const autoStartTime = Date.now();

    // Set up event listeners
    let autoStartEvents = [];
    csvManager.on('pendingAccountsUpdate', data => {
      const eventTime = Date.now();
      const timeFromStart = eventTime - autoStartTime;
      autoStartEvents.push({
        type: 'pendingAccountsUpdate',
        time: timeFromStart,
        data,
      });
      console.log(`📨 Auto-Start Event (${timeFromStart}ms):`, data);
    });

    // Simulate auto-start (SSE connection)
    console.log('🔌 Simulating frontend SSE connection (auto-start trigger)...');
    const { default: linkPlatformsController } = await import(
      '../server/src/controllers/linkPlatformsController.js'
    );

    const autoStartResult = await linkPlatformsController.findAndSyncMQLFoldersManual();
    const autoStartDuration = Date.now() - autoStartTime;

    console.log(`⏱️ Auto-Start completed in ${autoStartDuration}ms`);
    console.log(`📊 Auto-Start events received: ${autoStartEvents.length}`);

    // Step 2: Test Manual Execution Timing
    console.log('\n🔧 Step 2: Testing Manual Execution Timing...');
    const manualStartTime = Date.now();

    // Set up new event listeners for manual test
    let manualEvents = [];
    csvManager.on('pendingAccountsUpdate', data => {
      const eventTime = Date.now();
      const timeFromStart = eventTime - manualStartTime;
      manualEvents.push({
        type: 'pendingAccountsUpdate',
        time: timeFromStart,
        data,
      });
      console.log(`📨 Manual Event (${timeFromStart}ms):`, data);
    });

    // Simulate manual execution
    console.log('🔧 Simulating manual Link Platforms execution...');
    const manualResult = await linkPlatformsController.findAndSyncMQLFoldersManual();
    const manualDuration = Date.now() - manualStartTime;

    console.log(`⏱️ Manual execution completed in ${manualDuration}ms`);
    console.log(`📊 Manual events received: ${manualEvents.length}`);

    // Step 3: Test Sequential Execution (Auto + Manual)
    console.log('\n🔄 Step 3: Testing Sequential Execution (Auto + Manual)...');

    // Clear previous events
    autoStartEvents = [];
    manualEvents = [];

    // First: Auto-start
    console.log('🔌 Step 3a: Executing auto-start...');
    const sequentialAutoStart = Date.now();
    await linkPlatformsController.findAndSyncMQLFoldersManual();
    const sequentialAutoDuration = Date.now() - sequentialAutoStart;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Then: Manual execution
    console.log('🔧 Step 3b: Executing manual after auto...');
    const sequentialManualStart = Date.now();
    await linkPlatformsController.findAndSyncMQLFoldersManual();
    const sequentialManualDuration = Date.now() - sequentialManualStart;

    console.log(`⏱️ Sequential Auto: ${sequentialAutoDuration}ms`);
    console.log(`⏱️ Sequential Manual: ${sequentialManualDuration}ms`);

    // Step 4: Check CSV watching state
    console.log('\n📊 Step 4: Checking CSV watching state...');
    console.log('- CSV files being watched:', csvManager.csvFiles.size);
    console.log('- Polling interval active:', !!csvManager.pollingInterval);
    console.log('- Pending evaluation interval active:', !!csvManager.pendingEvaluationInterval);
    console.log('- Heartbeat interval active:', !!csvManager.heartbeatInterval);

    // Step 5: Test pending accounts detection timing
    console.log('\n🔍 Step 5: Testing pending accounts detection timing...');
    const detectionStart = Date.now();
    const pendingAccounts = await csvManager.scanSimplifiedPendingCSVFiles();
    const detectionDuration = Date.now() - detectionStart;

    console.log(`⏱️ Pending accounts detection: ${detectionDuration}ms`);
    console.log(`📊 Pending accounts found: ${pendingAccounts.length}`);

    pendingAccounts.forEach(account => {
      console.log(
        `  - ${account.account_id} (${account.platform}): ${account.current_status || account.status}`
      );
    });

    // Step 6: Wait for real-time updates to measure event frequency
    console.log('\n⏰ Step 6: Measuring real-time event frequency (15 seconds)...');
    let realTimeEvents = [];
    const realTimeStart = Date.now();

    csvManager.on('pendingAccountsUpdate', data => {
      const eventTime = Date.now();
      const timeFromStart = eventTime - realTimeStart;
      realTimeEvents.push({
        time: timeFromStart,
        data,
      });
    });

    // Wait for real-time events
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log(`📊 Real-time events received: ${realTimeEvents.length}`);
    if (realTimeEvents.length > 0) {
      const intervals = [];
      for (let i = 1; i < realTimeEvents.length; i++) {
        intervals.push(realTimeEvents[i].time - realTimeEvents[i - 1].time);
      }
      const avgInterval =
        intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
      console.log(`⏱️ Average event interval: ${avgInterval.toFixed(0)}ms`);
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log('='.repeat(50));
    console.log(`🚀 Auto-Start Duration: ${autoStartDuration}ms`);
    console.log(`🔧 Manual Duration: ${manualDuration}ms`);
    console.log(`🔄 Sequential Auto: ${sequentialAutoDuration}ms`);
    console.log(`🔄 Sequential Manual: ${sequentialManualDuration}ms`);
    console.log(`🔍 Detection Duration: ${detectionDuration}ms`);
    console.log(`📊 Real-time Events: ${realTimeEvents.length} in 15s`);
    console.log(
      `⏱️ Event Frequency: ~${realTimeEvents.length > 0 ? (15000 / realTimeEvents.length).toFixed(0) : 0}ms per event`
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTimingComparison();
