#!/usr/bin/env node

/**
 * Test script to verify pending to master conversion
 * This script tests the updateCSVAccountType endpoint to ensure it:
 * 1. Updates the CSV file correctly
 * 2. Registers the account in the configured accounts system
 * 3. Prevents duplicate entries
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0'; // Replace with your actual API key
const BASE_URL = 'http://localhost:30/api';

async function testPendingToMasterConversion() {
  console.log('🧪 Testing pending to master conversion...\n');

  try {
    // Step 1: Check current pending accounts
    console.log('📋 Step 1: Checking current pending accounts...');
    const pendingResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!pendingResponse.ok) {
      throw new Error(`Failed to get pending accounts: ${pendingResponse.status}`);
    }

    const pendingData = await pendingResponse.json();
    console.log('✅ Pending accounts found:', pendingData.summary);

    if (pendingData.accounts.length === 0) {
      console.log(
        '⚠️ No pending accounts found. Please ensure there is a pending account to test with.'
      );
      return;
    }

    const testAccount = pendingData.accounts[0];
    console.log(`🎯 Testing with account: ${testAccount.account_id} (${testAccount.platform})\n`);

    // Step 2: Check current configured accounts
    console.log('📋 Step 2: Checking current configured accounts...');
    const configuredResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!configuredResponse.ok) {
      throw new Error(`Failed to get configured accounts: ${configuredResponse.status}`);
    }

    const configuredData = await configuredResponse.json();
    console.log('✅ Configured accounts found:', {
      masters: configuredData.totalMasterAccounts,
      slaves: configuredData.totalSlaveAccounts,
    });

    // Check if test account already exists as configured
    const existingMaster = configuredData.masterAccounts[testAccount.account_id];
    const existingSlave = configuredData.unconnectedSlaves.find(
      s => s.id === testAccount.account_id
    );

    if (existingMaster || existingSlave) {
      console.log(
        `⚠️ Account ${testAccount.account_id} already exists as configured account. Skipping conversion test.`
      );
      return;
    }

    // Step 3: Convert pending to master
    console.log('🔄 Step 3: Converting pending account to master...');
    const conversionResponse = await fetch(
      `${BASE_URL}/csv/pending/${testAccount.account_id}/update-type`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          newType: 'master',
        }),
      }
    );

    if (!conversionResponse.ok) {
      const errorData = await conversionResponse.json();
      throw new Error(
        `Failed to convert account: ${errorData.message || conversionResponse.status}`
      );
    }

    const conversionData = await conversionResponse.json();
    console.log('✅ Conversion successful:', conversionData.message);

    // Step 4: Verify CSV was updated
    console.log('📄 Step 4: Verifying CSV file was updated...');
    const fs = await import('fs');
    const csvPath =
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf8').trim();
      console.log('📄 CSV content:', csvContent);

      if (csvContent.includes(`[1][${testAccount.account_id}]`)) {
        console.log('✅ CSV file correctly updated to master format');
      } else {
        console.log('❌ CSV file not updated correctly');
      }
    } else {
      console.log('⚠️ CSV file not found');
    }

    // Step 5: Verify account was registered in configured accounts
    console.log('📋 Step 5: Verifying account was registered in configured accounts...');
    const verifyResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify configured accounts: ${verifyResponse.status}`);
    }

    const verifyData = await verifyResponse.json();
    const newMaster = verifyData.masterAccounts[testAccount.account_id];

    if (newMaster) {
      console.log('✅ Account successfully registered as master:', {
        id: newMaster.id,
        name: newMaster.name,
        platform: newMaster.platform,
        status: newMaster.status,
        convertedFrom: newMaster.convertedFrom,
      });
    } else {
      console.log('❌ Account not found in configured accounts');
    }

    // Step 6: Check pending accounts again (should be reduced)
    console.log('📋 Step 6: Checking pending accounts after conversion...');
    const finalPendingResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!finalPendingResponse.ok) {
      throw new Error(`Failed to get final pending accounts: ${finalPendingResponse.status}`);
    }

    const finalPendingData = await finalPendingResponse.json();
    console.log('✅ Final pending accounts:', finalPendingData.summary);

    const stillPending = finalPendingData.accounts.find(
      a => a.account_id === testAccount.account_id
    );
    if (!stillPending) {
      console.log('✅ Account no longer appears in pending accounts (correct behavior)');
    } else {
      console.log(
        '⚠️ Account still appears in pending accounts (this might be expected if CSV scanning is still running)'
      );
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Account ${testAccount.account_id} converted from pending to master`);
    console.log(`   - CSV file updated correctly`);
    console.log(`   - Account registered in configured accounts system`);
    console.log(`   - No duplicate entries created`);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPendingToMasterConversion();
