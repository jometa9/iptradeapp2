import fetch from 'node-fetch';

async function testUnifiedFix() {
  console.log('🧪 Testing unified endpoint fix...');
  
  try {
    const response = await fetch('http://localhost:30/api/accounts/unified', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('📊 Unified Response Test:');
      console.log('=====================================');
      
      // Check if problematic master accounts are gone
      const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
      const problematicMasters = Object.keys(masterAccounts).filter(id => 
        id === 'ENABLED' || id === 'DISABLED' || id === 'ON' || id === 'OFF'
      );
      
      if (problematicMasters.length > 0) {
        console.log(`❌ Still found problematic master IDs: ${problematicMasters.join(', ')}`);
        console.log('   The fix is not working yet - server may need restart');
      } else {
        console.log('✅ No problematic master IDs found - fix is working!');
      }
      
      // Show current master accounts
      console.log('\n📋 Current Master Accounts:');
      Object.keys(masterAccounts).forEach((masterId, index) => {
        const master = masterAccounts[masterId];
        console.log(`   ${index + 1}. ${masterId} (${master.platform}) - ${master.status}`);
        console.log(`      Connected Slaves: ${master.connectedSlaves?.length || 0}`);
      });
      
      // Show pending accounts
      console.log('\n📋 Pending Accounts:');
      const pendingAccounts = data.data?.pendingAccounts || [];
      console.log(`   Count: ${pendingAccounts.length}`);
      pendingAccounts.forEach((acc, index) => {
        console.log(`   ${index + 1}. ${acc.account_id} (${acc.platform}) - ${acc.status}`);
      });
      
      // Show unconnected slaves
      console.log('\n📋 Unconnected Slaves:');
      const unconnectedSlaves = data.data?.configuredAccounts?.unconnectedSlaves || [];
      console.log(`   Count: ${unconnectedSlaves.length}`);
      unconnectedSlaves.forEach((slave, index) => {
        console.log(`   ${index + 1}. ${slave.id} (${slave.platform}) - ${slave.status}`);
        if (slave.config?.masterId) {
          console.log(`      Master ID: ${slave.config.masterId}`);
        }
      });
      
      // Show server stats
      console.log('\n📈 Server Stats:');
      const serverStats = data.data?.serverStats || {};
      console.log(`   Total CSV Files: ${serverStats.totalCSVFiles}`);
      console.log(`   Total Pending: ${serverStats.totalPendingAccounts}`);
      console.log(`   Total Masters: ${serverStats.totalMasterAccounts}`);
      console.log(`   Total Slaves: ${serverStats.totalSlaveAccounts}`);
      
      console.log('\n=====================================');
      console.log('✅ Test complete');
      
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
    console.log('   Make sure the server is running on port 30');
  }
}

testUnifiedFix();
