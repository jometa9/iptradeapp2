import fetch from 'node-fetch';

async function debugUnifiedResponse() {
  console.log('🔍 Debugging unified endpoint response...');
  
  try {
    const response = await fetch('http://localhost:30/api/accounts/unified', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('📊 Unified Response Structure:');
      console.log('=====================================');
      
      // Check pending accounts
      console.log('\n📋 Pending Accounts:');
      console.log(`   Count: ${data.data?.pendingAccounts?.length || 0}`);
      if (data.data?.pendingAccounts?.length > 0) {
        data.data.pendingAccounts.forEach((acc, index) => {
          console.log(`   ${index + 1}. ${acc.account_id} (${acc.platform}) - ${acc.status}`);
        });
      }
      
      // Check configured accounts
      console.log('\n🔧 Configured Accounts:');
      const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
      const slaveAccounts = data.data?.configuredAccounts?.slaveAccounts || {};
      const unconnectedSlaves = data.data?.configuredAccounts?.unconnectedSlaves || [];
      
      console.log(`   Master Accounts: ${Object.keys(masterAccounts).length}`);
      Object.keys(masterAccounts).forEach((masterId, index) => {
        const master = masterAccounts[masterId];
        console.log(`   ${index + 1}. ${masterId} (${master.platform}) - ${master.status}`);
        console.log(`      Connected Slaves: ${master.connectedSlaves?.length || 0}`);
        if (master.connectedSlaves?.length > 0) {
          master.connectedSlaves.forEach(slave => {
            console.log(`        - ${slave.id} (${slave.platform}) - ${slave.status}`);
          });
        }
      });
      
      console.log(`   Slave Accounts: ${Object.keys(slaveAccounts).length}`);
      console.log(`   Unconnected Slaves: ${unconnectedSlaves.length}`);
      
      // Check copier status
      console.log('\n🎛️ Copier Status:');
      const copierStatus = data.data?.copierStatus || {};
      console.log(`   Global Status: ${copierStatus.globalStatusText || 'OFF'}`);
      console.log(`   Master Accounts in Copier Status: ${Object.keys(copierStatus.masterAccounts || {}).length}`);
      Object.keys(copierStatus.masterAccounts || {}).forEach((masterId, index) => {
        const master = copierStatus.masterAccounts[masterId];
        console.log(`   ${index + 1}. ${masterId} - Master: ${master.masterStatus}, Effective: ${master.effectiveStatus}, Status: ${master.status}`);
      });
      
      // Check server stats
      console.log('\n📈 Server Stats:');
      const serverStats = data.data?.serverStats || {};
      console.log(`   Total CSV Files: ${serverStats.totalCSVFiles}`);
      console.log(`   Total Pending: ${serverStats.totalPendingAccounts}`);
      console.log(`   Total Masters: ${serverStats.totalMasterAccounts}`);
      console.log(`   Total Slaves: ${serverStats.totalSlaveAccounts}`);
      
      // Check for problematic data
      console.log('\n🚨 Potential Issues:');
      const problematicMasters = Object.keys(masterAccounts).filter(id => 
        id === 'ENABLED' || id === 'DISABLED' || id === 'ON' || id === 'OFF'
      );
      
      if (problematicMasters.length > 0) {
        console.log(`   ❌ Found problematic master IDs: ${problematicMasters.join(', ')}`);
        console.log('   This suggests a parsing error where configuration values are being treated as account IDs');
      } else {
        console.log('   ✅ No problematic master IDs found');
      }
      
      console.log('\n=====================================');
      console.log('✅ Debug complete');
      
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

debugUnifiedResponse();
