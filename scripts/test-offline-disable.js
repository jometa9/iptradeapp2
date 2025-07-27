import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Simulate a slave account going offline
const simulateSlaveOffline = () => {
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

    // Set lastActivity to a time that's older than ACTIVITY_TIMEOUT (500 seconds)
    const oldTime = new Date(Date.now() - 600000); // 10 minutes ago
    userAccounts.slaveAccounts['TEST_TV_010'].lastActivity = oldTime.toISOString();
    userAccounts.slaveAccounts['TEST_TV_010'].status = 'offline';

    // Save the updated config
    writeFileSync(accountsFilePath, JSON.stringify(accountsConfig, null, 2));

    console.log('✅ Simulated TEST_TV_010 going offline');
    console.log(`📅 Set lastActivity to: ${oldTime.toISOString()}`);
    console.log(`📴 Set status to: offline`);
  } catch (error) {
    console.error('❌ Error simulating offline:', error);
  }
};

// Run the simulation
simulateSlaveOffline();
