import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the accounts configuration file
const accountsConfigPath = join(__dirname, '..', 'server', 'config', 'registered_accounts.json');

// Function to load current accounts config
const loadAccountsConfig = () => {
  if (!existsSync(accountsConfigPath)) {
    console.error('❌ Accounts config file not found:', accountsConfigPath);
    process.exit(1);
  }

  try {
    const data = readFileSync(accountsConfigPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error reading accounts config:', error.message);
    process.exit(1);
  }
};

// Function to save accounts config
const saveAccountsConfig = config => {
  try {
    writeFileSync(accountsConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving accounts config:', error.message);
    return false;
  }
};

// Main function
const clearPendingAccounts = () => {
  console.log('🧹 Clearing pending accounts...\n');

  // Load current config
  const config = loadAccountsConfig();

  // Show current state
  console.log('📊 Current accounts state:');
  console.log(`   - Master accounts: ${Object.keys(config.masterAccounts || {}).length}`);
  console.log(`   - Slave accounts: ${Object.keys(config.slaveAccounts || {}).length}`);
  console.log(`   - Pending accounts: ${Object.keys(config.pendingAccounts || {}).length}`);
  console.log(`   - Connections: ${Object.keys(config.connections || {}).length}\n`);

  if (!config.pendingAccounts || Object.keys(config.pendingAccounts).length === 0) {
    console.log('📝 No pending accounts to clear.');
    return;
  }

  // Show pending accounts to be cleared
  console.log('🗑️  Pending accounts to be cleared:');
  Object.entries(config.pendingAccounts).forEach(([id, account]) => {
    console.log(`   • ${id} - ${account.platform} (${account.broker})`);
  });

  // Clear pending accounts
  const clearedCount = Object.keys(config.pendingAccounts).length;
  config.pendingAccounts = {};

  // Save updated config
  if (saveAccountsConfig(config)) {
    console.log(`\n🎉 Successfully cleared ${clearedCount} pending accounts!`);
    console.log('\n📊 Updated accounts state:');
    console.log(`   - Master accounts: ${Object.keys(config.masterAccounts || {}).length}`);
    console.log(`   - Slave accounts: ${Object.keys(config.slaveAccounts || {}).length}`);
    console.log(`   - Pending accounts: ${Object.keys(config.pendingAccounts || {}).length}`);
    console.log(`   - Connections: ${Object.keys(config.connections || {}).length}`);

    console.log('\n✅ Pending accounts cleared! You can now:');
    console.log('   1. Run the add-pending-accounts script again');
    console.log('   2. Test with fresh pending accounts');
    console.log('   3. Refresh the UI to see the empty state');
  } else {
    console.error('❌ Failed to save configuration file');
    process.exit(1);
  }

  console.log('\n✨ Script completed successfully!');
};

// Run the script
clearPendingAccounts();
