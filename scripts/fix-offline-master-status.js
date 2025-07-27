import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Fix masterStatus for offline accounts
const fixOfflineMasterStatus = () => {
  const configBaseDir = join(process.cwd(), 'server', 'config');
  const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

  try {
    // Load current accounts config
    const accountsConfig = JSON.parse(readFileSync(accountsFilePath, 'utf8'));

    console.log('🔍 Fixing masterStatus for offline accounts...');

    // Find the user's accounts
    const userKey = 'iptrade_6616c788f776a3b114f0';
    const userAccounts = accountsConfig.userAccounts[userKey];

    if (!userAccounts) {
      console.log('❌ User accounts not found');
      return;
    }

    // Initialize copier status if it doesn't exist
    if (!userAccounts.copierStatus) {
      userAccounts.copierStatus = {
        globalStatus: true,
        masterAccounts: {},
        userApiKey: userKey,
      };
    }

    console.log('📊 Current copier status:');
    console.log('  - Global status:', userAccounts.copierStatus.globalStatus);
    console.log(
      '  - Master accounts:',
      Object.keys(userAccounts.copierStatus.masterAccounts || {})
    );

    let hasChanges = false;

    // Check each master account
    for (const [masterId, masterAccount] of Object.entries(userAccounts.masterAccounts)) {
      console.log(`  🔍 Master ${masterId}:`);
      console.log(`    - Status: ${masterAccount.status}`);
      console.log(
        `    - Current masterStatus: ${userAccounts.copierStatus.masterAccounts[masterId]}`
      );

      // If master is offline but masterStatus is true, disable it
      if (
        masterAccount.status === 'offline' &&
        userAccounts.copierStatus.masterAccounts[masterId] === true
      ) {
        console.log(`    🚫 Disabling copy trading for offline master ${masterId}`);
        userAccounts.copierStatus.masterAccounts[masterId] = false;
        hasChanges = true;
      } else if (masterAccount.status === 'offline') {
        console.log(`    ℹ️ Master ${masterId} already disabled`);
      } else {
        console.log(`    ℹ️ Master ${masterId} is online`);
      }
    }

    // Save changes
    if (hasChanges) {
      writeFileSync(accountsFilePath, JSON.stringify(accountsConfig, null, 2));
      console.log('💾 Saved accounts config changes');
    }

    console.log('✅ Offline master status fixed');
  } catch (error) {
    console.error('❌ Error fixing offline master status:', error);
  }
};

// Run the fix
fixOfflineMasterStatus();
