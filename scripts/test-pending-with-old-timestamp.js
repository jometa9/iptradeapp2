#!/usr/bin/env node

/**
 * Test pending filtering with older timestamp
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';
const CSV_PATH =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

async function testPendingWithOldTimestamp() {
  console.log('🧪 Testing pending filtering with older timestamp...\n');

  try {
    const fs = await import('fs');

    // Use a timestamp that's 30 minutes old (within the 1-hour limit)
    const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - 30 * 60;

    // Test 1: Create a pending account with old timestamp
    console.log('📋 Test 1: Creating a pending account with 30-minute-old timestamp...');
    const pendingContent = `[0][250062001][MT4][PENDING][${thirtyMinutesAgo}]`;
    fs.writeFileSync(CSV_PATH, pendingContent + '\n', 'utf8');
    console.log('✅ Pending content written:', pendingContent);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

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
    console.log(
      '📋 Accounts:',
      pendingData.accounts.map(a => `${a.account_id} (${a.status})`)
    );

    // Test 2: Change to master account with same timestamp
    console.log('\n📋 Test 2: Changing to master account with same timestamp...');
    const masterContent = `[0][250062001][MT4][MASTER][${thirtyMinutesAgo}]`;
    fs.writeFileSync(CSV_PATH, masterContent + '\n', 'utf8');
    console.log('✅ Master content written:', masterContent);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check pending accounts again
    const masterPendingResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!masterPendingResponse.ok) {
      throw new Error(`Failed to get pending accounts: ${masterPendingResponse.status}`);
    }

    const masterPendingData = await masterPendingResponse.json();
    console.log('📊 Pending accounts after master change:', masterPendingData.summary);
    console.log(
      '📋 Accounts:',
      masterPendingData.accounts.map(a => `${a.account_id} (${a.status})`)
    );

    // Verify results
    const foundPending = pendingData.accounts.find(a => a.account_id === '250062001');
    const foundMaster = masterPendingData.accounts.find(a => a.account_id === '250062001');

    console.log('\n📋 Results:');
    console.log(
      `When CSV had PENDING: ${foundPending ? 'Found in pending' : 'NOT found in pending'}`
    );
    console.log(
      `When CSV had MASTER: ${foundMaster ? 'Found in pending' : 'NOT found in pending'}`
    );

    if (foundPending && !foundMaster) {
      console.log('\n🎉 SUCCESS: Pending filtering logic is working correctly!');
      console.log('✅ Only accounts with PENDING status appear as pending');
      console.log('✅ Accounts with MASTER status are correctly filtered out');
    } else {
      console.log('\n❌ FAILED: Pending filtering logic is not working correctly');
      if (!foundPending) {
        console.log('❌ PENDING account should have appeared in pending list');
        console.log('   This might be due to timestamp filtering or parsing issues');
      }
      if (foundMaster) {
        console.log('❌ MASTER account should NOT have appeared in pending list');
      }
    }

    // Test 3: Check current CSV content
    console.log('\n📋 Test 3: Checking current CSV content...');
    const currentContent = fs.readFileSync(CSV_PATH, 'utf8').trim();
    console.log('📄 Current CSV content:', currentContent);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPendingWithOldTimestamp();
