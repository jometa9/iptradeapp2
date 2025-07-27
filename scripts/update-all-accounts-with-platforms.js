// Script to update all existing accounts with proper platform information
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config', 'registered_accounts.json');

// Read current configuration
const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Platform mapping for old accounts
const platformMapping = {
  101010: 'MT4',
  111111: 'MT5',
  222222: 'MT4',
  333333: 'MT5',
  444444: 'cTrader',
  555555: 'MT4',
  666666: 'MT5',
  777777: 'NinjaTrader',
  888888: 'TradingView',
  999999: 'MT5',
};

// Update existing pending accounts with platform information
if (currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].pendingAccounts) {
  Object.keys(currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].pendingAccounts).forEach(
    accountId => {
      const account =
        currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].pendingAccounts[accountId];

      // Add platform information if missing
      if (!account.platform && platformMapping[accountId]) {
        account.platform = platformMapping[accountId];
        console.log(`✅ Added platform ${platformMapping[accountId]} to account ${accountId}`);
      }
    }
  );
}

// Update master accounts with platform information
if (currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].masterAccounts) {
  Object.keys(currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].masterAccounts).forEach(
    accountId => {
      const account =
        currentConfig.userAccounts['iptrade_89536f5b9e643c0433f3'].masterAccounts[accountId];

      // Add platform information if missing
      if (!account.platform && platformMapping[accountId]) {
        account.platform = platformMapping[accountId];
        console.log(
          `✅ Added platform ${platformMapping[accountId]} to master account ${accountId}`
        );
      }
    }
  );
}

// Write the updated configuration
fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));

console.log('\n✅ Updated all accounts with proper platform information!');
console.log('\n📋 Platform mapping applied:');
Object.entries(platformMapping).forEach(([accountId, platform]) => {
  console.log(`   - ${accountId}: ${platform}`);
});
