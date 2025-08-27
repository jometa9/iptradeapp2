const fetch = require('node-fetch');

// Simulate the unified endpoint call
async function testUnifiedEndpoint() {
  console.log('🧪 Testing unified endpoint calls...');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:30/api/accounts/unified', {
      headers: {
        'x-api-key': 'test-key',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const endTime = Date.now();
      
      console.log('✅ Unified endpoint response:');
      console.log(`   - Processing time: ${data.processingTimeMs}ms`);
      console.log(`   - Total time: ${endTime - startTime}ms`);
      console.log(`   - CSV files accessed: ${data.csvFilesAccessed}`);
      console.log(`   - Pending accounts: ${data.data?.pendingAccounts?.length || 0}`);
      console.log(`   - Master accounts: ${Object.keys(data.data?.configuredAccounts?.masterAccounts || {}).length}`);
      console.log(`   - Slave accounts: ${Object.keys(data.data?.configuredAccounts?.slaveAccounts || {}).length}`);
    } else {
      console.log('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Run the test
testUnifiedEndpoint();
