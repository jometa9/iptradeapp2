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

// Generate timestamp
const now = new Date().toISOString();
const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
const olderTime = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 minutes ago

// Pending accounts to add for testing
const pendingAccountsToAdd = {
  PENDING_MT4_001: {
    id: 'PENDING_MT4_001',
    name: 'MT4 Trading Account 001',
    description: 'High frequency scalping EA detected',
    firstSeen: olderTime,
    lastActivity: recentTime,
    status: 'pending',
    platform: 'MT4',
    broker: 'IC Markets',
  },
  PENDING_MT5_002: {
    id: 'PENDING_MT5_002',
    name: 'MT5 Trading Account 002',
    description: 'Swing trading EA - awaiting configuration',
    firstSeen: recentTime,
    lastActivity: now,
    status: 'pending',
    platform: 'MT5',
    broker: 'FTMO',
  },
  PENDING_CTRADER_003: {
    id: 'PENDING_CTRADER_003',
    name: 'cTrader Account 003',
    description: 'Grid trading strategy detected',
    firstSeen: olderTime,
    lastActivity: olderTime,
    status: 'pending',
    platform: 'cTrader',
    broker: 'Pepperstone',
  },
  PENDING_MT4_004: {
    id: 'PENDING_MT4_004',
    name: 'EUR/USD Specialist',
    description: 'Single pair focused trading bot',
    firstSeen: now,
    lastActivity: now,
    status: 'pending',
    platform: 'MT4',
    broker: 'XM',
  },
  PENDING_MT5_005: {
    id: 'PENDING_MT5_005',
    name: 'Multi-Currency EA',
    description: 'Portfolio management EA with 8 pairs',
    firstSeen: olderTime,
    lastActivity: recentTime,
    status: 'pending',
    platform: 'MT5',
    broker: 'Admiral Markets',
  },
  PENDING_NINJA_006: {
    id: 'PENDING_NINJA_006',
    name: 'NinjaTrader Bot',
    description: 'Futures trading algorithm',
    firstSeen: recentTime,
    lastActivity: recentTime,
    status: 'pending',
    platform: 'NinjaTrader',
    broker: 'AMP Futures',
  },
};

// Main function
const addPendingAccounts = () => {
  console.log('🚀 Adding pending accounts for testing...\n');

  // Load current config
  const config = loadAccountsConfig();

  // Show current state
  console.log('📊 Current accounts state:');
  console.log(`   - Master accounts: ${Object.keys(config.masterAccounts || {}).length}`);
  console.log(`   - Slave accounts: ${Object.keys(config.slaveAccounts || {}).length}`);
  console.log(`   - Pending accounts: ${Object.keys(config.pendingAccounts || {}).length}`);
  console.log(`   - Connections: ${Object.keys(config.connections || {}).length}\n`);

  // Initialize pendingAccounts if it doesn't exist
  if (!config.pendingAccounts) {
    config.pendingAccounts = {};
  }

  // Add new pending accounts
  let addedCount = 0;
  let skippedCount = 0;

  for (const [accountId, accountData] of Object.entries(pendingAccountsToAdd)) {
    // Check if account already exists in any category
    const existsAsMaster = config.masterAccounts && config.masterAccounts[accountId];
    const existsAsSlave = config.slaveAccounts && config.slaveAccounts[accountId];
    const existsAsPending = config.pendingAccounts[accountId];

    if (existsAsMaster || existsAsSlave || existsAsPending) {
      console.log(`⚠️  Skipping ${accountId} - already exists`);
      skippedCount++;
      continue;
    }

    // Add to pending accounts
    config.pendingAccounts[accountId] = accountData;
    console.log(
      `✅ Added pending account: ${accountId} (${accountData.platform} - ${accountData.broker})`
    );
    addedCount++;
  }

  // Save updated config
  if (addedCount > 0) {
    if (saveAccountsConfig(config)) {
      console.log(`\n🎉 Successfully added ${addedCount} pending accounts!`);
      if (skippedCount > 0) {
        console.log(`📝 Skipped ${skippedCount} accounts (already exist)`);
      }

      console.log('\n📋 New pending accounts summary:');
      Object.entries(config.pendingAccounts).forEach(([id, account]) => {
        const timeDiff = Math.round((new Date() - new Date(account.firstSeen)) / (1000 * 60));
        console.log(`   • ${id} - ${account.platform} (${account.broker}) - Waiting ${timeDiff}m`);
      });

      console.log('\n🌐 You can now test the following features:');
      console.log('   1. View pending accounts in the UI');
      console.log('   2. Convert pending accounts to Master accounts');
      console.log('   3. Convert pending accounts to Slave accounts');
      console.log('   4. Connect slaves to existing masters');
      console.log('   5. Test copier controls with the new accounts');

      console.log('\n🚀 Open http://localhost:5173 to see the pending accounts!');
    } else {
      console.error('❌ Failed to save configuration file');
      process.exit(1);
    }
  } else {
    console.log('\n📝 No new accounts were added (all already exist)');
  }

  console.log('\n✨ Script completed successfully!');
};

// Run the script
addPendingAccounts();
