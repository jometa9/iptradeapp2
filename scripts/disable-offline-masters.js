import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Disable copy trading for offline master accounts
const disableOfflineMasters = () => {
  const configBaseDir = join(process.cwd(), 'server', 'config');
  const copierStatusPath = join(configBaseDir, 'copier_status.json');

  try {
    // Load current copier status
    const copierStatus = JSON.parse(readFileSync(copierStatusPath, 'utf8'));

    console.log('🔍 Checking copier status for offline masters...');
    console.log('📊 Current global status:', copierStatus.globalStatus);

    // Find the user's copier status
    const userKey = 'iptrade_6616c788f776a3b114f0';
    const userCopierStatus = copierStatus[userKey];

    if (!userCopierStatus) {
      console.log('❌ User copier status not found');
      return;
    }

    console.log('📊 User copier status:');
    console.log('  - Global status:', userCopierStatus.globalStatus);
    console.log('  - Master accounts:', Object.keys(userCopierStatus.masterAccounts || {}));

    // Check each master account
    for (const [masterId, masterStatus] of Object.entries(userCopierStatus.masterAccounts || {})) {
      console.log(`  🔍 Master ${masterId}:`);
      console.log(`    - masterStatus: ${masterStatus.masterStatus}`);
      console.log(`    - effectiveStatus: ${masterStatus.effectiveStatus}`);
      console.log(`    - status: ${masterStatus.status}`);

      // If master is offline but masterStatus is true, disable it
      if (masterStatus.status === 'offline' && masterStatus.masterStatus === true) {
        console.log(`    🚫 Disabling copy trading for offline master ${masterId}`);
        userCopierStatus.masterAccounts[masterId].masterStatus = false;
        userCopierStatus.masterAccounts[masterId].effectiveStatus = false;
      } else if (masterStatus.status === 'offline') {
        console.log(`    ℹ️ Master ${masterId} already disabled`);
      } else {
        console.log(`    ℹ️ Master ${masterId} is online`);
      }
    }

    // Save changes
    writeFileSync(copierStatusPath, JSON.stringify(copierStatus, null, 2));
    console.log('💾 Saved copier status changes');

    console.log('✅ Offline masters disabled');
  } catch (error) {
    console.error('❌ Error disabling offline masters:', error);
  }
};

// Run the disable
disableOfflineMasters();
