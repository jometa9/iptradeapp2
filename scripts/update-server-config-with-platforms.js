// Script to update server's configuration file with accounts that have platform information
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverConfigPath = path.join(__dirname, 'server', 'config', 'registered_accounts.json');

// Read current server configuration
const currentConfig = JSON.parse(fs.readFileSync(serverConfigPath, 'utf8'));

// Add the API key with pending accounts that have platform information
currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'] = {
  pendingAccounts: {
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
    PENDING_MT4_001: {
      id: 'PENDING_MT4_001',
      name: 'MT4 Test Account 001',
      description: 'High frequency scalping EA detected',
      firstSeen: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: 'MT4',
      broker: 'IC Markets',
    },
    PENDING_MT5_002: {
      id: 'PENDING_MT5_002',
      name: 'MT5 Test Account 002',
      description: 'Swing trading EA - awaiting configuration',
      firstSeen: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: 'MT5',
      broker: 'FTMO',
    },
    PENDING_CTRADER_003: {
      id: 'PENDING_CTRADER_003',
      name: 'cTrader Test Account 003',
      description: 'Grid trading strategy detected',
      firstSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: 'cTrader',
      broker: 'Pepperstone',
    },
    PENDING_NINJA_004: {
      id: 'PENDING_NINJA_004',
      name: 'NinjaTrader Test Account 004',
      description: 'Futures trading algorithm',
      firstSeen: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: 'NinjaTrader',
      broker: 'AMP Futures',
    },
    PENDING_TV_005: {
      id: 'PENDING_TV_005',
      name: 'TradingView Test Account 005',
      description: 'Web-based trading strategy',
      firstSeen: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform: 'TradingView',
      broker: 'TradingView',
    },
  },
  masterAccounts: {
    999999: {
      id: '999999',
      name: 'Test Master Account',
      description: 'Test master account for platform testing',
      broker: 'Test Broker',
      platform: 'MT5',
      registeredAt: new Date().toISOString(),
      status: 'active',
    },
  },
  slaveAccounts: {},
  connections: {},
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
};

// Write the updated configuration
fs.writeFileSync(serverConfigPath, JSON.stringify(currentConfig, null, 2));

console.log('✅ Updated server configuration with accounts that have platform information!');
console.log('\n📋 Added accounts with platforms:');
console.log('   - 101010: MT4 (pending)');
console.log('   - 111111: MT5 (pending)');
console.log('   - 222222: MT4 (pending)');
console.log('   - 333333: MT5 (pending)');
console.log('   - 444444: cTrader (pending)');
console.log('   - 555555: MT4 (pending)');
console.log('   - 666666: MT5 (pending)');
console.log('   - 777777: NinjaTrader (pending)');
console.log('   - PENDING_MT4_001: MT4 (pending)');
console.log('   - PENDING_MT5_002: MT5 (pending)');
console.log('   - PENDING_CTRADER_003: cTrader (pending)');
console.log('   - PENDING_NINJA_004: NinjaTrader (pending)');
console.log('   - PENDING_TV_005: TradingView (pending)');
console.log('   - 999999: MT5 (master)');
