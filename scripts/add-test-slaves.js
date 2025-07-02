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

// Additional test pending accounts for slave connection testing
const testSlaveAccounts = [
  {
    id: 'TEST_SLAVE_001',
    name: 'Test Follower Account 1',
    description: 'Trading bot focused on EUR/USD scalping',
    platform: 'MT4',
    broker: 'IC Markets',
  },
  {
    id: 'TEST_SLAVE_002',
    name: 'Test Follower Account 2',
    description: 'Copy trading account for GBP/USD swing strategy',
    platform: 'MT5',
    broker: 'FTMO',
  },
  {
    id: 'TEST_SLAVE_003',
    name: 'Test Follower Account 3',
    description: 'Grid trading EA for multiple majors',
    platform: 'cTrader',
    broker: 'Pepperstone',
  },
  {
    id: 'TEST_SLAVE_004',
    name: 'Test Follower Account 4',
    description: 'Risk management focused trading bot',
    platform: 'MT5',
    broker: 'Admiral Markets',
  },
];

const main = () => {
  console.log('🧪 Adding test slave accounts for master connection testing...\n');

  // Load current configuration
  const config = loadAccountsConfig();

  console.log('📊 Current accounts state:');
  console.log(`   - Master accounts: ${Object.keys(config.masterAccounts).length}`);
  console.log(`   - Slave accounts: ${Object.keys(config.slaveAccounts).length}`);
  console.log(`   - Pending accounts: ${Object.keys(config.pendingAccounts).length}`);
  console.log(`   - Connections: ${Object.keys(config.connections).length}\n`);

  let addedCount = 0;
  const now = new Date().toISOString();

  // Add test slave accounts as pending
  testSlaveAccounts.forEach(account => {
    if (
      config.pendingAccounts[account.id] ||
      config.masterAccounts[account.id] ||
      config.slaveAccounts[account.id]
    ) {
      console.log(`⚠️  Skipping ${account.id} - already exists`);
      return;
    }

    // Calculate random activity time (within last 2 hours)
    const randomMinutesAgo = Math.floor(Math.random() * 120) + 1;
    const activityTime = new Date(Date.now() - randomMinutesAgo * 60 * 1000).toISOString();

    config.pendingAccounts[account.id] = {
      id: account.id,
      name: account.name,
      description: account.description,
      firstSeen: activityTime,
      lastActivity: activityTime,
      status: 'pending',
    };

    console.log(`✅ Added ${account.id} - ${account.name}`);
    console.log(`   📍 Platform: ${account.platform} | Broker: ${account.broker}`);
    console.log(`   ⏰ Last activity: ${randomMinutesAgo} minutes ago\n`);
    addedCount++;
  });

  if (addedCount > 0) {
    if (saveAccountsConfig(config)) {
      console.log(`✨ Successfully added ${addedCount} test slave accounts!`);
      console.log('\n🎯 Testing instructions:');
      console.log('1. 🌐 Go to http://localhost:5173');
      console.log('2. 📋 Check "Pending Accounts" section');
      console.log('3. 🔗 Click "Make Slave" on any test account');
      console.log('4. 🎛️  Select a Master from the dropdown');
      console.log('5. ✅ Confirm - the slave will be directly connected!');
      console.log('6. 📊 Check the main table to see the connection');
    } else {
      console.error('❌ Failed to save configuration');
      process.exit(1);
    }
  } else {
    console.log('📝 No new accounts were added (all already exist)');
  }

  console.log('\n✨ Script completed successfully!');
};

main();
