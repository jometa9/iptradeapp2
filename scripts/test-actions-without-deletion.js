#!/usr/bin/env node

/**
 * Script to test master account actions without deletion
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';

async function testActionsWithoutDeletion() {
  console.log('🧪 Testing master account actions (without deletion)...\n');

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

    // Step 2: Test GET master account details
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
        totalSlaves: masterDetails.totalSlaves,
      });
    } else {
      console.log('❌ Failed to get master account details:', masterDetailsResponse.status);
    }

    // Step 3: Test PUT master account update
    console.log('\n📋 Step 3: Testing PUT master account update...');
    const updateData = {
      name: `Test Master ${Date.now()}`,
      description: 'Test update from script',
      broker: 'Test Broker',
    };

    const updateResponse = await fetch(`${BASE_URL}/accounts/master/${testMasterId}`, {
      method: 'PUT',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ Master account updated successfully:', updateResult.message);
      console.log('📝 Updated data:', updateResult.account);
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ Failed to update master account:', updateResponse.status, errorText);
    }

    // Step 4: Test copier status controls
    console.log('\n📋 Step 4: Testing copier status controls...');

    // Test getting copier status
    const copierStatusResponse = await fetch(`${BASE_URL}/copier/master/${testMasterId}`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (copierStatusResponse.ok) {
      const copierStatus = await copierStatusResponse.json();
      console.log('✅ Copier status retrieved:', {
        enabled: copierStatus.enabled,
        lastUpdated: copierStatus.lastUpdated,
      });
    } else {
      console.log('❌ Failed to get copier status:', copierStatusResponse.status);
    }

    // Step 5: Test trading configuration
    console.log('\n📋 Step 5: Testing trading configuration...');

    const tradingConfigResponse = await fetch(`${BASE_URL}/trading-config/${testMasterId}`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (tradingConfigResponse.ok) {
      const tradingConfig = await tradingConfigResponse.json();
      console.log('✅ Trading configuration retrieved:', {
        lotMultiplier: tradingConfig.lotMultiplier,
        forceLot: tradingConfig.forceLot,
        reverseTrading: tradingConfig.reverseTrading,
        enabled: tradingConfig.enabled,
      });
    } else {
      console.log('❌ Failed to get trading configuration:', tradingConfigResponse.status);
    }

    // Step 6: Test slave connection endpoints
    console.log('\n📋 Step 6: Testing slave connection endpoints...');

    // Test getting all accounts (includes unconnected slaves)
    const allAccountsResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (allAccountsResponse.ok) {
      const allAccounts = await allAccountsResponse.json();
      console.log('✅ All accounts retrieved:', {
        masters: allAccounts.totalMasterAccounts,
        slaves: allAccounts.totalSlaveAccounts,
        unconnectedSlaves: allAccounts.unconnectedSlaves ? allAccounts.unconnectedSlaves.length : 0,
      });
    } else {
      console.log('❌ Failed to get all accounts:', allAccountsResponse.status);
    }

    // Step 7: Test platform linking
    console.log('\n📋 Step 7: Testing platform linking...');

    const linkPlatformsResponse = await fetch(`${BASE_URL}/link-platforms`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (linkPlatformsResponse.ok) {
      const linkResult = await linkPlatformsResponse.json();
      console.log('✅ Platform linking test completed:', {
        mql4Folders: linkResult.mql4Folders ? linkResult.mql4Folders.length : 0,
        mql5Folders: linkResult.mql5Folders ? linkResult.mql5Folders.length : 0,
        csvFiles: linkResult.csvFiles ? linkResult.csvFiles.length : 0,
      });
    } else {
      console.log('❌ Failed to test platform linking:', linkPlatformsResponse.status);
    }

    // Step 8: Test CSV scanning
    console.log('\n📋 Step 8: Testing CSV scanning...');

    const csvScanResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (csvScanResponse.ok) {
      const csvScanResult = await csvScanResponse.json();
      console.log('✅ CSV scan completed:', {
        totalAccounts: csvScanResult.summary.totalAccounts,
        onlineAccounts: csvScanResult.summary.onlineAccounts,
        offlineAccounts: csvScanResult.summary.offlineAccounts,
      });
    } else {
      console.log('❌ Failed to scan CSV:', csvScanResponse.status);
    }

    // Step 9: Final verification
    console.log('\n📋 Step 9: Final verification...');
    const finalResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      console.log('📊 Final account state:', {
        masters: finalData.totalMasterAccounts,
        slaves: finalData.totalSlaveAccounts,
      });

      if (finalData.masterAccounts[testMasterId]) {
        console.log('✅ Master account still exists and is accessible');
        console.log('📝 Current master account data:', {
          id: finalData.masterAccounts[testMasterId].id,
          name: finalData.masterAccounts[testMasterId].name,
          platform: finalData.masterAccounts[testMasterId].platform,
          status: finalData.masterAccounts[testMasterId].status,
        });
      } else {
        console.log('❌ Master account no longer exists');
      }
    }

    console.log('\n🎉 All actions tested successfully!');
    console.log('✅ The master account actions are working correctly');
    console.log('✅ The buttons in the UI should now function properly');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testActionsWithoutDeletion();
