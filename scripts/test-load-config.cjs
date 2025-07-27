const fs = require('fs');
const path = require('path');

const accountsFilePath = path.join(process.cwd(), 'server', 'config', 'registered_accounts.json');

const loadAccountsConfig = () => {
  try {
    const data = fs.readFileSync(accountsFilePath, 'utf8');
    const config = JSON.parse(data);
    return config;
  } catch (error) {
    console.error('Error loading accounts config:', error);
    return null;
  }
};

console.log('🔍 Testing accounts config loading...');

const config = loadAccountsConfig();
if (config) {
  console.log('✅ Config loaded successfully');
  console.log('📊 Config keys:', Object.keys(config));
  console.log('📋 Has pendingAccounts:', !!config.pendingAccounts);
  console.log(
    '📈 Pending accounts count:',
    config.pendingAccounts ? Object.keys(config.pendingAccounts).length : 0
  );

  if (config.pendingAccounts) {
    console.log('📝 First few pending accounts:');
    Object.keys(config.pendingAccounts)
      .slice(0, 3)
      .forEach(key => {
        console.log(`   - ${key}: ${config.pendingAccounts[key].name}`);
      });
  }
} else {
  console.log('❌ Failed to load config');
}
