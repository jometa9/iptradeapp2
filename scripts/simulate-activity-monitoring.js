import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Simulate the activity monitoring function from accountsController.js
const simulateActivityMonitoring = () => {
  const configBaseDir = join(process.cwd(), 'server', 'config');
  const accountsFilePath = join(configBaseDir, 'registered_accounts.json');
  const slaveConfigsPath = join(process.cwd(), 'server', 'config', 'slave_configurations.json');

  try {
    // Load current accounts config
    const accountsConfig = JSON.parse(readFileSync(accountsFilePath, 'utf8'));
    const slaveConfigs = JSON.parse(readFileSync(slaveConfigsPath, 'utf8'));

    let hasChanges = false;
    const now = new Date();
    const ACTIVITY_TIMEOUT = 500000; // 500 seconds

    console.log('🔍 Simulating activity monitoring...');

    // Check all users' accounts
    for (const [apiKey, userAccounts] of Object.entries(accountsConfig.userAccounts)) {
      console.log(`📊 Checking user: ${apiKey ? apiKey.substring(0, 8) + '...' : 'unknown'}`);

      // Check slave accounts for this user
      for (const [accountId, account] of Object.entries(userAccounts.slaveAccounts)) {
        console.log(`  🔍 Checking slave: ${accountId}`);
        console.log(`    - Status: ${account.status}`);
        console.log(`    - lastActivity: ${account.lastActivity}`);

        if (account.lastActivity) {
          const lastActivity = new Date(account.lastActivity);
          const timeSinceActivity = now - lastActivity;

          console.log(`    - Time since activity: ${Math.round(timeSinceActivity / 1000)}s`);
          console.log(`    - ACTIVITY_TIMEOUT: ${ACTIVITY_TIMEOUT / 1000}s`);

          if (timeSinceActivity > ACTIVITY_TIMEOUT) {
            if (account.status !== 'offline') {
              account.status = 'offline';
              hasChanges = true;
              console.log(`    📴 Marked as offline`);

              // Disable copy trading for offline slave
              if (slaveConfigs[accountId] && slaveConfigs[accountId].enabled !== false) {
                slaveConfigs[accountId].enabled = false;
                slaveConfigs[accountId].lastUpdated = new Date().toISOString();
                console.log(`    🚫 Copy trading disabled for offline slave ${accountId}`);
              }
            } else {
              console.log(`    ℹ️ Already offline, checking copy trading...`);
              // Disable copy trading for offline slave even if already marked as offline
              if (slaveConfigs[accountId] && slaveConfigs[accountId].enabled !== false) {
                slaveConfigs[accountId].enabled = false;
                slaveConfigs[accountId].lastUpdated = new Date().toISOString();
                console.log(`    🚫 Copy trading disabled for offline slave ${accountId}`);
              } else {
                console.log(`    ℹ️ Copy trading already disabled for ${accountId}`);
              }
            }
          } else {
            if (account.status === 'offline') {
              account.status = 'active';
              hasChanges = true;
              console.log(`    📡 Marked as active`);
            }
          }
        } else {
          if (account.status !== 'offline') {
            account.status = 'offline';
            hasChanges = true;
            console.log(`    📴 Marked as offline (no activity)`);

            // Disable copy trading for offline slave
            if (slaveConfigs[accountId] && slaveConfigs[accountId].enabled !== false) {
              slaveConfigs[accountId].enabled = false;
              slaveConfigs[accountId].lastUpdated = new Date().toISOString();
              console.log(`    🚫 Copy trading disabled for offline slave ${accountId}`);
            }
          }
        }
      }
    }

    // Save changes
    if (hasChanges) {
      writeFileSync(accountsFilePath, JSON.stringify(accountsConfig, null, 2));
      console.log('💾 Saved accounts config changes');
    }

    writeFileSync(slaveConfigsPath, JSON.stringify(slaveConfigs, null, 2));
    console.log('💾 Saved slave configs changes');

    console.log('✅ Activity monitoring simulation completed');
  } catch (error) {
    console.error('❌ Error simulating activity monitoring:', error);
  }
};

// Run the simulation
simulateActivityMonitoring();
