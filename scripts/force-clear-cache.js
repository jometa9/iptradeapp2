import fetch from 'node-fetch';

async function forceClearCache() {
  console.log('🧹 Forcing CSV cache clear...');
  
  try {
    // Forzar limpieza del cache CSV
    const response = await fetch('http://localhost:30/api/csv/clear-cache', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      console.log('✅ CSV cache cleared');
      
      // Esperar un momento para que se procesen los datos
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Ahora verificar el endpoint unificado
      const unifiedResponse = await fetch('http://localhost:30/api/accounts/unified', {
        headers: {
          'x-api-key': 'test-key',
        },
      });
      
      if (unifiedResponse.ok) {
        const data = await unifiedResponse.json();
        
        console.log('\n📊 Updated Unified Endpoint Data:');
        console.log('=====================================');
        
        const masterAccounts = data.data?.configuredAccounts?.masterAccounts || {};
        
        Object.keys(masterAccounts).forEach(masterId => {
          const master = masterAccounts[masterId];
          console.log(`\n👑 Master Account ${masterId}:`);
          console.log(`   Platform: ${master.platform}`);
          console.log(`   Status: ${master.status}`);
          console.log(`   Config:`, master.config);
          
          const copierStatus = data.data?.copierStatus?.masterAccounts?.[masterId];
          console.log(`   Copier Status:`, copierStatus);
        });
        
      } else {
        console.error('❌ Failed to get unified data after cache clear');
      }
    } else {
      console.error('❌ Failed to clear CSV cache');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceClearCache();
