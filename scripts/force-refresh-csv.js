import fetch from 'node-fetch';

async function forceRefreshCSV() {
  console.log('🔄 Forcing CSV refresh...');
  
  try {
    // Forzar refresh de todos los archivos CSV
    const response = await fetch('http://localhost:30/api/csv/refresh', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      console.log('✅ CSV refresh completed');
      
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
        
        // Verificar el archivo CSV directamente
        console.log('\n📄 Checking CSV file directly...');
        const csvResponse = await fetch('http://localhost:30/api/csv/accounts/all', {
          headers: {
            'x-api-key': 'test-key',
          },
        });
        
        if (csvResponse.ok) {
          const csvData = await csvResponse.json();
          console.log('📋 Raw CSV Data:');
          console.log(JSON.stringify(csvData, null, 2));
        }
        
      } else {
        console.error('❌ Failed to get unified data after refresh');
      }
    } else {
      console.error('❌ Failed to refresh CSV');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceRefreshCSV();
