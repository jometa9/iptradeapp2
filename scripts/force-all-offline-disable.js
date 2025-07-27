import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Force disable copy trading for all offline accounts
const forceDisableOfflineAccounts = () => {
  const configBaseDir = join(process.cwd(), 'server', 'config');
  const accountsFilePath = join(configBaseDir, 'registered_accounts.json');
  const slaveConfigsPath = join(configBaseDir, 'slave_configurations.json');

  try {
    // Load current configs
    const accountsConfig = JSON.parse(readFileSync(accountsFilePath, 'utf8'));
    const slaveConfigs = JSON.parse(readFileSync(slaveConfigsPath, 'utf8'));

    console.log('🔍 Checking all accounts for offline status...');

    // Check all users' accounts
    for (const [apiKey, userAccounts] of Object.entries(accountsConfig.userAccounts)) {
      console.log(`📊 Processing user: ${apiKey ? apiKey.substring(0, 8) + '...' : 'unknown'}`);

      // Check master accounts
      for (const [accountId, account] of Object.entries(userAccounts.masterAccounts)) {
        console.log(`  🔍 Master ${accountId}: ${account.status}`);

        if (account.status === 'offline') {
          console.log(`    🚫 Master ${accountId} is offline - disabling copy trading`);

          // Disable copy trading for offline master
          // Note: Master copy trading is controlled by copier status, not slave configs
          console.log(`    ℹ️ Master copy trading should be disabled via copier status`);

          // Disable copy trading for all connected slaves
          const connectedSlaves = Object.entries(userAccounts.connections || {})
            .filter(([, masterId]) => masterId === accountId)
            .map(([slaveId]) => slaveId);

          if (connectedSlaves.length > 0) {
            console.log(`    🔗 Found ${connectedSlaves.length} connected slaves`);

            connectedSlaves.forEach(slaveId => {
              if (slaveConfigs[slaveId] && slaveConfigs[slaveId].enabled !== false) {
                slaveConfigs[slaveId].enabled = false;
                slaveConfigs[slaveId].lastUpdated = new Date().toISOString();
                console.log(`      🚫 Disabled copy trading for slave ${slaveId}`);
              } else {
                console.log(`      ℹ️ Slave ${slaveId} already disabled`);
              }
            });
          }
        }
      }

      // Check slave accounts
      for (const [accountId, account] of Object.entries(userAccounts.slaveAccounts)) {
        console.log(`  🔍 Slave ${accountId}: ${account.status}`);

        if (account.status === 'offline') {
          console.log(`    🚫 Slave ${accountId} is offline - disabling copy trading`);

          if (slaveConfigs[accountId] && slaveConfigs[accountId].enabled !== false) {
            slaveConfigs[accountId].enabled = false;
            slaveConfigs[accountId].lastUpdated = new Date().toISOString();
            console.log(`      🚫 Disabled copy trading for slave ${accountId}`);
          } else {
            console.log(`      ℹ️ Slave ${accountId} already disabled`);
          }
        }
      }
    }

    // Save changes
    writeFileSync(slaveConfigsPath, JSON.stringify(slaveConfigs, null, 2));
    console.log('💾 Saved slave configs changes');

    console.log('✅ Force disable completed');
  } catch (error) {
    console.error('❌ Error forcing disable:', error);
  }
};

// Run the force disable
forceDisableOfflineAccounts();
