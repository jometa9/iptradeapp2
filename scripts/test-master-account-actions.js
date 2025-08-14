#!/usr/bin/env node

/**
 * Script to test master account actions and identify issues
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';

async function testMasterAccountActions() {
  console.log('🧪 Testing master account actions...\n');

  try {
    // Step 1: Check current accounts
    console.log('📋 Step 1: Checking current accounts...');
    const accountsResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to get accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();
    console.log('📊 Current accounts:', {
      masters: accountsData.totalMasterAccounts,
      slaves: accountsData.totalSlaveAccounts,
    });

    if (accountsData.totalMasterAccounts === 0) {
      console.log('❌ No master accounts found to test');
      return;
    }

    // Get the first master account
    const masterAccounts = Object.keys(accountsData.masterAccounts);
    const testMasterId = masterAccounts[0];
    console.log(`🎯 Testing with master account: ${testMasterId}`);

    // Step 2: Test getting master account details
    console.log('\n📋 Step 2: Testing GET master account details...');
    const masterDetailsResponse = await fetch(`${BASE_URL}/accounts/master/${testMasterId}`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (masterDetailsResponse.ok) {
      const masterDetails = await masterDetailsResponse.json();
      console.log('✅ Master account details retrieved:', {
        id: masterDetails.account.id,
        name: masterDetails.account.name,
        platform: masterDetails.account.platform,
        connectedSlaves: masterDetails.connectedSlaves,
      });
    } else {
      console.log('❌ Failed to get master account details:', masterDetailsResponse.status);
    }

    // Step 3: Test updating master account
    console.log('\n📋 Step 3: Testing PUT master account update...');
    const updateResponse = await fetch(`${BASE_URL}/accounts/master/${testMasterId}`, {
      method: 'PUT',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Test Master ${Date.now()}`,
        description: 'Test update from script',
      }),
    });

    if (updateResponse.ok) {
      const updateData = await updateResponse.json();
      console.log('✅ Master account updated successfully:', updateData.message);
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ Failed to update master account:', updateResponse.status, errorText);
    }

    // Step 4: Test deleting master account
    console.log('\n📋 Step 4: Testing DELETE master account...');
    console.log('⚠️ This will actually delete the master account!');

    // Ask for confirmation
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise(resolve => {
      rl.question('Do you want to proceed with deletion? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled by user');
      return;
    }

    const deleteResponse = await fetch(`${BASE_URL}/accounts/master/${testMasterId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (deleteResponse.ok) {
      const deleteData = await deleteResponse.json();
      console.log('✅ Master account deleted successfully:', deleteData.message);
      console.log('📊 Disconnected slaves:', deleteData.disconnectedSlaves);
    } else {
      const errorText = await deleteResponse.text();
      console.log('❌ Failed to delete master account:', deleteResponse.status, errorText);
    }

    // Step 5: Verify deletion
    console.log('\n📋 Step 5: Verifying deletion...');
    const verifyResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log('📊 Accounts after deletion:', {
        masters: verifyData.totalMasterAccounts,
        slaves: verifyData.totalSlaveAccounts,
      });

      if (verifyData.totalMasterAccounts < accountsData.totalMasterAccounts) {
        console.log('✅ Deletion verified - master account count decreased');
      } else {
        console.log('❌ Deletion verification failed - master account count unchanged');
      }
    }

    // Step 6: Check if account still exists in CSV
    console.log('\n📋 Step 6: Checking CSV file...');
    const fs = await import('fs');
    const csvPath =
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf8').trim();
      console.log('📄 Current CSV content:', csvContent);

      if (csvContent.includes(testMasterId)) {
        console.log('⚠️ Account still exists in CSV file - this is expected');
        console.log('   The CSV file is managed by MetaTrader, not by our application');
      } else {
        console.log('✅ Account removed from CSV file');
      }
    }

    console.log('\n🎉 Master account actions test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMasterAccountActions();
