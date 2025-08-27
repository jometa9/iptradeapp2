import fetch from 'node-fetch';

async function debugCopierStatus() {
  console.log('🔍 Debugging copier status in unified endpoint...');
  
  try {
    const response = await fetch('http://localhost:30/api/accounts/unified', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('📊 Copier Status Analysis:');
      console.log('=====================================');
      
      // Check global status
      const copierStatus = data.data?.copierStatus;
      console.log('🌐 Global Status:');
      console.log(`   Global Status: ${copierStatus?.globalStatus}`);
      console.log(`   Global Status Text: ${copierStatus?.globalStatusText}`);
      
      // Check master accounts status
      const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
      console.log('\n👑 Master Accounts Status:');
      
      Object.keys(masterAccounts).forEach(masterId => {
        const master = masterAccounts[masterId];
        const masterCopierStatus = copierStatus?.masterAccounts?.[masterId];
        
        console.log(`   ${masterId}:`);
        console.log(`     Platform: ${master.platform}`);
        console.log(`     Status: ${master.status}`);
        console.log(`     Config:`, master.config);
        console.log(`     Copier Status:`, masterCopierStatus);
      });
      
      // Check if there are any master accounts
      if (Object.keys(masterAccounts).length === 0) {
        console.log('   No master accounts found');
      }
      
      // Check pending accounts
      const pendingAccounts = data.data?.pendingAccounts || [];
      console.log('\n⏳ Pending Accounts:');
      pendingAccounts.forEach(acc => {
        console.log(`   ${acc.account_id} (${acc.platform}) - ${acc.status}`);
      });
      
      // Check server stats
      const serverStats = data.data?.serverStats;
      console.log('\n📈 Server Stats:');
      console.log(`   Total Master Accounts: ${serverStats?.totalMasterAccounts}`);
      console.log(`   Total Slave Accounts: ${serverStats?.totalSlaveAccounts}`);
      console.log(`   Total Pending Accounts: ${serverStats?.totalPendingAccounts}`);
      
      console.log('\n=====================================');
      console.log('✅ Debug complete');
      
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

debugCopierStatus();
