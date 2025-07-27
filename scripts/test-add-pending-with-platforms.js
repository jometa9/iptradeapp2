// Script to add test pending accounts with proper platform information
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config', 'registered_accounts.json');

// Test pending accounts with proper platform information
const testPendingAccounts = {
  userAccounts: {
    iptrade_89536f5b9e643c0433f3: {
      pendingAccounts: {
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
    },
  },
};

// Write the configuration
fs.writeFileSync(configPath, JSON.stringify(testPendingAccounts, null, 2));

console.log('✅ Added test pending accounts with proper platform information:');
console.log('   - PENDING_MT4_001: MT4 (MetaTrader 4)');
console.log('   - PENDING_MT5_002: MT5 (MetaTrader 5)');
console.log('   - PENDING_CTRADER_003: cTrader');
console.log('   - PENDING_NINJA_004: NinjaTrader');
console.log('   - PENDING_TV_005: TradingView');
console.log('\n📋 These accounts will now display proper platform names in the UI!');
