// Script to add old accounts back with proper platform information
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config', 'registered_accounts.json');

// Read current configuration
const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Add old accounts with platform information
const oldAccounts = {
  101010: {
    id: '101010',
    name: 'Old Account 101010',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'MT4',
    broker: 'Legacy Broker',
  },
  111111: {
    id: '111111',
    name: 'Old Account 111111',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'MT5',
    broker: 'Legacy Broker',
  },
  222222: {
    id: '222222',
    name: 'Old Account 222222',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'MT4',
    broker: 'Legacy Broker',
  },
  333333: {
    id: '333333',
    name: 'Old Account 333333',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'MT5',
    broker: 'Legacy Broker',
  },
  444444: {
    id: '444444',
    name: 'Old Account 444444',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'cTrader',
    broker: 'Legacy Broker',
  },
  555555: {
    id: '555555',
    name: 'Old Account 555555',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'MT4',
    broker: 'Legacy Broker',
  },
  666666: {
    id: '666666',
    name: 'Old Account 666666',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'MT5',
    broker: 'Legacy Broker',
  },
  777777: {
    id: '777777',
    name: 'Old Account 777777',
    description: 'Legacy account with platform info',
    firstSeen: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'pending',
    platform: 'NinjaTrader',
    broker: 'Legacy Broker',
  },
};

// Add old accounts to pending accounts
Object.entries(oldAccounts).forEach(([accountId, account]) => {
  currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].pendingAccounts[accountId] = account;
  console.log(`✅ Added old account ${accountId} with platform ${account.platform}`);
});

// Write the updated configuration
fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));

console.log('\n✅ Added all old accounts with proper platform information!');
console.log('\n📋 Old accounts added:');
Object.entries(oldAccounts).forEach(([accountId, account]) => {
  console.log(`   - ${accountId}: ${account.platform} (${account.status})`);
});
