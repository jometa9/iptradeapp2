import fetch from 'node-fetch';

async function testGlobalStatus() {
  console.log('🧪 Testing global copier status update...');
  
  try {
    // 1. Primero obtener el estado actual
    console.log('\n📊 Current global status:');
    const currentResponse = await fetch('http://localhost:30/api/copier/global', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (currentResponse.ok) {
      const currentData = await currentResponse.json();
      console.log(`   Status: ${currentData.status}`);
      console.log(`   Global Status: ${currentData.globalStatus}`);
    }
    
    // 2. Cambiar a DISABLED
    console.log('\n🔄 Setting global status to DISABLED...');
    const disableResponse = await fetch('http://localhost:30/api/copier/global', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key',
      },
      body: JSON.stringify({ enabled: false }),
    });
    
    if (disableResponse.ok) {
      const disableData = await disableResponse.json();
      console.log(`   ✅ Response: ${disableData.message}`);
      console.log(`   Files Updated: ${disableData.filesUpdated}`);
    } else {
      console.log(`   ❌ Error: ${disableResponse.status}`);
    }
    
    // 3. Esperar un momento
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Cambiar a ENABLED
    console.log('\n🔄 Setting global status to ENABLED...');
    const enableResponse = await fetch('http://localhost:30/api/copier/global', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key',
      },
      body: JSON.stringify({ enabled: true }),
    });
    
    if (enableResponse.ok) {
      const enableData = await enableResponse.json();
      console.log(`   ✅ Response: ${enableData.message}`);
      console.log(`   Files Updated: ${enableData.filesUpdated}`);
    } else {
      console.log(`   ❌ Error: ${enableResponse.status}`);
    }
    
    // 5. Verificar estado final
    console.log('\n📊 Final global status:');
    const finalResponse = await fetch('http://localhost:30/api/copier/global', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      console.log(`   Status: ${finalData.status}`);
      console.log(`   Global Status: ${finalData.globalStatus}`);
    }
    
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testGlobalStatus();
