// Test script to verify the connectivity stats logic
const loadUserCopierStatus = apiKey => {
  // Mock function for testing
  return {
    masterAccounts: {
      222222: false, // Copy trading disabled for master 222222
    },
  };
};

const loadSlaveConfigs = () => {
  // Mock function for testing
  return {
    555555: {
      enabled: false, // Copy trading disabled for slave 555555
    },
  };
};

// Test the logic
const apiKey = 'iptrade_6616c788f776a3b114f0';
const userAccounts = {
  masterAccounts: {
    222222: {
      status: 'offline',
      lastActivity: '2025-07-25T14:51:16.676Z',
    },
  },
  slaveAccounts: {
    555555: {
      status: 'offline',
      lastActivity: '2025-07-25T14:51:19.703Z',
    },
  },
  pendingAccounts: {
    999999: {
      status: 'offline',
      lastActivity: '2025-07-25T14:51:23.737Z',
    },
  },
  connections: {
    555555: '222222',
  },
};

const now = new Date();
const ACTIVITY_TIMEOUT = 5000;

console.log('Testing connectivity stats logic...');

// Test master account logic
const masterAccount = userAccounts.masterAccounts['222222'];
const isOffline =
  masterAccount.status === 'offline' ||
  (masterAccount.lastActivity && now - new Date(masterAccount.lastActivity) > ACTIVITY_TIMEOUT);

const copierStatus = loadUserCopierStatus(apiKey);
const isCopyTradingDisabled =
  copierStatus.masterAccounts && copierStatus.masterAccounts['222222'] === false;

console.log('Master 222222:');
console.log('- isOffline:', isOffline);
console.log('- isCopyTradingDisabled:', isCopyTradingDisabled);
console.log('- Should be offline:', isOffline || isCopyTradingDisabled);

// Test slave account logic
const slaveAccount = userAccounts.slaveAccounts['555555'];
const slaveIsOffline =
  slaveAccount.status === 'offline' ||
  (slaveAccount.lastActivity && now - new Date(slaveAccount.lastActivity) > ACTIVITY_TIMEOUT);

const slaveConfigs = loadSlaveConfigs();
const slaveIsCopyTradingDisabled =
  slaveConfigs['555555'] && slaveConfigs['555555'].enabled === false;

console.log('\nSlave 555555:');
console.log('- isOffline:', slaveIsOffline);
console.log('- isCopyTradingDisabled:', slaveIsCopyTradingDisabled);
console.log('- Should be offline:', slaveIsOffline || slaveIsCopyTradingDisabled);

console.log('\nExpected result: 2 offline accounts (222222 and 555555)');
