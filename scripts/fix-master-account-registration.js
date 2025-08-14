#!/usr/bin/env node

/**
 * Script to fix master account registration issue
 * When CSV has [MASTER] status but account is not registered in configured accounts
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';

async function fixMasterAccountRegistration() {
  console.log('🔧 Fixing master account registration issue...\n');

  try {
    // Step 1: Check current state
    console.log('📋 Step 1: Checking current state...');

    // Check configured accounts
    const accountsResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to get accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();
    console.log('📊 Configured accounts:', {
      masters: accountsData.totalMasterAccounts,
      slaves: accountsData.totalSlaveAccounts,
    });

    // Check CSV file
    const fs = await import('fs');
    const csvPath =
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    if (!fs.existsSync(csvPath)) {
      throw new Error('CSV file not found');
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8').trim();
    console.log('📄 CSV content:', csvContent);

    // Parse CSV to find master accounts
    const csvLines = csvContent.split('\n');
    const masterAccountsInCSV = [];

    for (const line of csvLines) {
      if (line.includes('[MASTER]')) {
        // Parse [0][250062001][MT4][MASTER][1755124418] format
        const match = line.match(/\[(\d+)\]\[(\d+)\]\[([^\]]+)\]\[MASTER\]\[(\d+)\]/);
        if (match) {
          const [, indicator, accountId, platform, timestamp] = match;
          masterAccountsInCSV.push({
            accountId,
            platform,
            timestamp,
            indicator,
            fullLine: line,
          });
        }
      }
    }

    console.log('📋 Master accounts found in CSV:', masterAccountsInCSV);

    if (masterAccountsInCSV.length === 0) {
      console.log('❌ No master accounts found in CSV');
      return;
    }

    // Step 2: Check which master accounts are not registered
    const unregisteredMasters = masterAccountsInCSV.filter(
      csvAccount => !accountsData.masterAccounts[csvAccount.accountId]
    );

    console.log('📋 Unregistered master accounts:', unregisteredMasters);

    if (unregisteredMasters.length === 0) {
      console.log('✅ All master accounts in CSV are properly registered');
      return;
    }

    // Step 3: Register unregistered master accounts
    console.log('\n📋 Step 3: Registering unregistered master accounts...');

    for (const csvAccount of unregisteredMasters) {
      console.log(`🔄 Registering master account: ${csvAccount.accountId}`);

      try {
        const registerResponse = await fetch(`${BASE_URL}/accounts/master`, {
          method: 'POST',
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            masterAccountId: csvAccount.accountId,
            name: `Master ${csvAccount.accountId}`,
            description: `Auto-registered from CSV (${csvAccount.platform})`,
            broker: 'Unknown',
            platform: csvAccount.platform,
          }),
        });

        if (registerResponse.ok) {
          const registerData = await registerResponse.json();
          console.log(
            `✅ Successfully registered master account ${csvAccount.accountId}:`,
            registerData.message
          );
        } else {
          const errorText = await registerResponse.text();
          console.log(
            `❌ Failed to register master account ${csvAccount.accountId}:`,
            registerResponse.status,
            errorText
          );
        }
      } catch (error) {
        console.log(`❌ Error registering master account ${csvAccount.accountId}:`, error.message);
      }
    }

    // Step 4: Verify registration
    console.log('\n📋 Step 4: Verifying registration...');
    const verifyResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log('📊 Accounts after registration:', {
        masters: verifyData.totalMasterAccounts,
        slaves: verifyData.totalSlaveAccounts,
      });

      // Check if all CSV master accounts are now registered
      const stillUnregistered = masterAccountsInCSV.filter(
        csvAccount => !verifyData.masterAccounts[csvAccount.accountId]
      );

      if (stillUnregistered.length === 0) {
        console.log('✅ All master accounts from CSV are now properly registered!');
      } else {
        console.log('❌ Some master accounts are still unregistered:', stillUnregistered);
      }
    }

    // Step 5: Test actions on registered accounts
    console.log('\n📋 Step 5: Testing actions on registered accounts...');
    const testResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (testResponse.ok) {
      const testData = await testResponse.json();
      const masterAccounts = Object.keys(testData.masterAccounts);

      if (masterAccounts.length > 0) {
        const testMasterId = masterAccounts[0];
        console.log(`🧪 Testing actions on master account: ${testMasterId}`);

        // Test getting master details
        const detailsResponse = await fetch(`${BASE_URL}/accounts/master/${testMasterId}`, {
          headers: {
            'x-api-key': API_KEY,
          },
        });

        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          console.log('✅ Master account details retrieved successfully:', {
            id: details.account.id,
            name: details.account.name,
            platform: details.account.platform,
          });
        } else {
          console.log('❌ Failed to get master account details:', detailsResponse.status);
        }
      }
    }

    console.log('\n🎉 Master account registration fix completed!');
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixMasterAccountRegistration();
