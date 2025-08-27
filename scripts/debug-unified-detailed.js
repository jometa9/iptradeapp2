import fetch from 'node-fetch';

async function debugUnifiedDetailed() {
  console.log('🔍 Detailed debugging of unified endpoint...');
  
  try {
    const response = await fetch('http://localhost:30/api/accounts/unified', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('📊 Complete Unified Response:');
      console.log('=====================================');
      console.log(JSON.stringify(data, null, 2));
      console.log('=====================================');
      
      // Check for problematic data
      console.log('\n🚨 Analysis:');
      
      const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
      const unconnectedSlaves = data.data?.configuredAccounts?.unconnectedSlaves || [];
      
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
      
      // Check for duplicates
      const slaveIds = unconnectedSlaves.map(slave => slave.id);
      const uniqueSlaveIds = new Set(slaveIds);
      if (slaveIds.length !== uniqueSlaveIds.size) {
        console.log(`❌ Found duplicate slave IDs: ${slaveIds.length} total, ${uniqueSlaveIds.size} unique`);
        const duplicates = slaveIds.filter((id, index) => slaveIds.indexOf(id) !== index);
        console.log(`   Duplicates: ${[...new Set(duplicates)].join(', ')}`);
      } else {
        console.log('✅ No duplicate slave IDs found');
      }
      
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

debugUnifiedDetailed();
