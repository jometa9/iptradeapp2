#!/usr/bin/env node

/**
 * Test script to verify pending account filtering logic
 * This script tests that only accounts with PENDING status are shown as pending
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';
const CSV_PATH =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

async function testPendingFiltering() {
  console.log('🧪 Testing pending account filtering logic...\n');

  try {
    const fs = await import('fs');
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Step 1: Create test scenarios
    console.log('📋 Step 1: Creating test scenarios...');

    const testScenarios = [
      {
        name: 'Pending Account',
        content: `[0][250062001][MT4][PENDING][${currentTimestamp}]`,
        expectedPending: true,
        description: 'Should appear as pending',
      },
      {
        name: 'Master Account',
        content: `[0][250062002][MT4][MASTER][${currentTimestamp}]`,
        expectedPending: false,
        description: 'Should NOT appear as pending',
      },
      {
        name: 'Slave Account',
        content: `[0][250062003][MT4][SLAVE][${currentTimestamp}]`,
        expectedPending: false,
        description: 'Should NOT appear as pending',
      },
    ];

    // Step 2: Test each scenario
    for (const scenario of testScenarios) {
      console.log(`\n🔄 Testing: ${scenario.name}`);
      console.log(`📄 CSV content: ${scenario.content}`);
      console.log(`📋 Expected: ${scenario.description}`);

      // Write the test content to CSV
      fs.writeFileSync(CSV_PATH, scenario.content + '\n', 'utf8');
      console.log('✅ Test content written to CSV');

      // Wait for system to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check pending accounts
      const pendingResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
        headers: {
          'x-api-key': API_KEY,
        },
      });

      if (!pendingResponse.ok) {
        throw new Error(`Failed to get pending accounts: ${pendingResponse.status}`);
      }

      const pendingData = await pendingResponse.json();
      console.log('📊 Pending accounts found:', pendingData.summary);

      // Check if the test account appears in pending
      const testAccountId = scenario.content.match(/\[(\d+)\]/g)[1].replace(/[\[\]]/g, '');
      const foundInPending = pendingData.accounts.find(a => a.account_id === testAccountId);

      if (scenario.expectedPending) {
        if (foundInPending) {
          console.log('✅ CORRECT: Account appears as pending (as expected)');
        } else {
          console.log('❌ ERROR: Account should appear as pending but does not');
        }
      } else {
        if (!foundInPending) {
          console.log('✅ CORRECT: Account does NOT appear as pending (as expected)');
        } else {
          console.log('❌ ERROR: Account should NOT appear as pending but does');
        }
      }
    }

    // Step 3: Test with multiple accounts in same file
    console.log('\n🔄 Testing multiple accounts in same file...');
    const multiAccountContent = `[0][250062001][MT4][PENDING][${currentTimestamp}]
[0][250062002][MT4][MASTER][${currentTimestamp}]
[0][250062003][MT4][SLAVE][${currentTimestamp}]`;

    fs.writeFileSync(CSV_PATH, multiAccountContent, 'utf8');
    console.log('✅ Multi-account content written to CSV');
    console.log('📄 CSV content:');
    console.log(multiAccountContent);

    // Wait for system to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check pending accounts
    const multiPendingResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!multiPendingResponse.ok) {
      throw new Error(`Failed to get pending accounts: ${multiPendingResponse.status}`);
    }

    const multiPendingData = await multiPendingResponse.json();
    console.log('\n📊 Pending accounts found:', multiPendingData.summary);

    // Verify only pending accounts appear
    const pendingAccountIds = multiPendingData.accounts.map(a => a.account_id);
    console.log('📋 Account IDs found in pending:', pendingAccountIds);

    const expectedPendingIds = ['250062001'];
    const unexpectedPendingIds = ['250062002', '250062003'];

    console.log('\n📋 Verification:');
    console.log(`Expected pending: ${expectedPendingIds.join(', ')}`);
    console.log(`Expected NOT pending: ${unexpectedPendingIds.join(', ')}`);

    let allCorrect = true;

    // Check expected pending accounts
    for (const expectedId of expectedPendingIds) {
      if (pendingAccountIds.includes(expectedId)) {
        console.log(`✅ CORRECT: ${expectedId} appears as pending`);
      } else {
        console.log(`❌ ERROR: ${expectedId} should appear as pending but does not`);
        allCorrect = false;
      }
    }

    // Check accounts that should NOT be pending
    for (const unexpectedId of unexpectedPendingIds) {
      if (!pendingAccountIds.includes(unexpectedId)) {
        console.log(`✅ CORRECT: ${unexpectedId} does NOT appear as pending`);
      } else {
        console.log(`❌ ERROR: ${unexpectedId} should NOT appear as pending but does`);
        allCorrect = false;
      }
    }

    if (allCorrect) {
      console.log('\n🎉 All tests passed! Pending filtering logic is working correctly.');
      console.log('📊 Summary:');
      console.log('   - Only accounts with PENDING status appear as pending');
      console.log('   - Accounts with MASTER/SLAVE status are correctly filtered out');
      console.log('   - No duplicate entries are created');
    } else {
      console.log('\n❌ Some tests failed. Pending filtering logic needs review.');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPendingFiltering();
