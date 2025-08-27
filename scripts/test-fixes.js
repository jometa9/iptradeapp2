import fetch from 'node-fetch';

async function testFixes() {
  console.log('🧪 Testing fixes for unified endpoint...');
  
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
      
      // Check for duplicates between categories
      const pendingAccounts = data.data?.pendingAccounts || [];
      const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
      const slaveAccounts = data.data?.configuredAccounts?.slaveAccounts || {};
      const unconnectedSlaves = data.data?.configuredAccounts?.unconnectedSlaves || [];
      
      const pendingIds = new Set(pendingAccounts.map(acc => acc.account_id));
      const masterIds = new Set(Object.keys(masterAccounts));
      const slaveIds = new Set(Object.keys(slaveAccounts));
      const unconnectedIds = new Set(unconnectedSlaves.map(slave => slave.id));
      
      // Check for duplicates
      const allIds = [...pendingIds, ...masterIds, ...slaveIds, ...unconnectedIds];
      const uniqueIds = new Set(allIds);
      
      if (allIds.length !== uniqueIds.size) {
        console.log('❌ Found duplicate account IDs across categories:');
        const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
        const uniqueDuplicates = [...new Set(duplicates)];
        
        uniqueDuplicates.forEach(id => {
          const categories = [];
          if (pendingIds.has(id)) categories.push('pending');
          if (masterIds.has(id)) categories.push('master');
          if (slaveIds.has(id)) categories.push('slave');
          if (unconnectedIds.has(id)) categories.push('unconnected');
          
          console.log(`   - ${id}: appears in ${categories.join(', ')}`);
        });
      } else {
        console.log('✅ No duplicate account IDs found across categories');
      }
      
      // Check for problematic data
      const problematicMasters = Object.keys(masterAccounts).filter(id => 
        id === 'ENABLED' || id === 'DISABLED' || id === 'ON' || id === 'OFF'
      );
      
      const problematicSlaves = unconnectedSlaves.filter(slave => {
        const masterId = slave.config?.masterId;
        return masterId === 'ENABLED' || masterId === 'DISABLED' || masterId === 'ON' || masterId === 'OFF';
      });
      
      if (problematicMasters.length > 0) {
        console.log(`❌ Found ${problematicMasters.length} problematic master IDs: ${problematicMasters.join(', ')}`);
      } else {
        console.log('✅ No problematic master IDs found');
      }
      
      if (problematicSlaves.length > 0) {
        console.log(`❌ Found ${problematicSlaves.length} problematic unconnected slaves:`);
        problematicSlaves.forEach(slave => {
          console.log(`   - ${slave.id} with masterId: ${slave.config?.masterId}`);
        });
      } else {
        console.log('✅ No problematic unconnected slaves found');
      }
      
      // Show summary
      console.log('\n📈 Summary:');
      console.log(`   Pending Accounts: ${pendingAccounts.length}`);
      pendingAccounts.forEach(acc => {
        console.log(`     - ${acc.account_id} (${acc.platform}) - ${acc.status}`);
      });
      
      console.log(`   Master Accounts: ${Object.keys(masterAccounts).length}`);
      Object.keys(masterAccounts).forEach(id => {
        const master = masterAccounts[id];
        console.log(`     - ${id} (${master.platform}) - ${master.status}`);
      });
      
      console.log(`   Slave Accounts: ${Object.keys(slaveAccounts).length}`);
      console.log(`   Unconnected Slaves: ${unconnectedSlaves.length}`);
      unconnectedSlaves.forEach(slave => {
        console.log(`     - ${slave.id} (${slave.platform}) - ${slave.status}`);
        if (slave.config?.masterId) {
          console.log(`       Master ID: ${slave.config.masterId}`);
        }
      });
      
      console.log(`   Total Unique Accounts: ${uniqueIds.size}`);
      
      console.log('\n=====================================');
      console.log('✅ Test complete');
      
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testFixes();
