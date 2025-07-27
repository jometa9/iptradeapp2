import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Force activity monitoring check
const forceActivityCheck = () => {
  const configBaseDir = join(process.cwd(), 'server', 'config');
  const accountsFilePath = join(configBaseDir, 'registered_accounts.json');

  try {
    // Load current accounts config
    const accountsConfig = JSON.parse(readFileSync(accountsFilePath, 'utf8'));

    // Find TEST_TV_010 slave account
    const userAccounts = accountsConfig.userAccounts['iptrade_6616c788f776a3b114f0'];
    if (!userAccounts || !userAccounts.slaveAccounts['TEST_TV_010']) {
      console.log('❌ TEST_TV_010 not found in slave accounts');
      return;
    }

    const slaveAccount = userAccounts.slaveAccounts['TEST_TV_010'];
    console.log('📊 Current TEST_TV_010 status:');
    console.log(`  - Status: ${slaveAccount.status}`);
    console.log(`  - lastActivity: ${slaveAccount.lastActivity}`);

    // Calculate time since last activity
    const now = new Date();
    const lastActivity = new Date(slaveAccount.lastActivity);
    const timeSinceActivity = now - lastActivity;
    const ACTIVITY_TIMEOUT = 500000; // 500 seconds

    console.log(`  - Time since activity: ${Math.round(timeSinceActivity / 1000)}s`);
    console.log(`  - ACTIVITY_TIMEOUT: ${ACTIVITY_TIMEOUT / 1000}s`);
    console.log(`  - Should be offline: ${timeSinceActivity > ACTIVITY_TIMEOUT ? 'YES' : 'NO'}`);

    // Check if it should be marked as offline
    if (timeSinceActivity > ACTIVITY_TIMEOUT && slaveAccount.status !== 'offline') {
      console.log('🔄 Marking as offline...');
      slaveAccount.status = 'offline';
      writeFileSync(accountsFilePath, JSON.stringify(accountsConfig, null, 2));
      console.log('✅ Marked as offline');
    } else if (timeSinceActivity <= ACTIVITY_TIMEOUT && slaveAccount.status === 'offline') {
      console.log('🔄 Marking as active...');
      slaveAccount.status = 'active';
      writeFileSync(accountsFilePath, JSON.stringify(accountsConfig, null, 2));
      console.log('✅ Marked as active');
    } else {
      console.log('ℹ️ Status is already correct');
    }
  } catch (error) {
    console.error('❌ Error checking activity:', error);
  }
};

// Run the check
forceActivityCheck();
