// Test script for subscription validation debugging
// Run this with: node test-subscription.js

const fetch = require('node-fetch');

async function testSubscriptionValidation() {
  console.log('🧪 === SUBSCRIPTION VALIDATION TEST ===');
  
  // Test different scenarios
  const testCases = [
    {
      name: 'Test with admin API key',
      apiKey: 'admin_key_here', // Replace with actual admin key
      expectedStatus: 'admin_assigned'
    },
    {
      name: 'Test with invalid API key',
      apiKey: 'invalid_key_123',
      expectedStatus: 'free_user'
    },
    {
      name: 'Test with empty API key',
      apiKey: '',
      expectedStatus: 'error'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`📝 API Key: ${testCase.apiKey ? testCase.apiKey.substring(0, 8) + '...' : 'empty'}`);
    
    try {
      // Test backend endpoint
      const backendUrl = 'http://localhost:3000/api/validate-subscription';
      console.log(`🎯 Testing backend URL: ${backendUrl}`);
      
      const response = await fetch(`${backendUrl}?apiKey=${encodeURIComponent(testCase.apiKey)}`);
      console.log(`📡 Backend response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Backend response data:`, JSON.stringify(data, null, 2));
      } else {
        const errorData = await response.text();
        console.log(`❌ Backend error: ${errorData}`);
      }
      
      // Test external license API (if available)
      const externalUrl = 'https://iptradecopier.com/api/validate-subscription';
      console.log(`🎯 Testing external URL: ${externalUrl}`);
      
      try {
        const externalResponse = await fetch(`${externalUrl}?apiKey=${encodeURIComponent(testCase.apiKey)}`);
        console.log(`📡 External response status: ${externalResponse.status}`);
        
        if (externalResponse.ok) {
          const externalData = await externalResponse.json();
          console.log(`✅ External response data:`, JSON.stringify(externalData, null, 2));
        } else {
          const externalErrorData = await externalResponse.text();
          console.log(`❌ External error: ${externalErrorData}`);
        }
      } catch (externalError) {
        console.log(`❌ External API error: ${externalError.message}`);
      }
      
    } catch (error) {
      console.log(`💥 Test error: ${error.message}`);
    }
  }
  
  console.log('\n🧪 === TEST COMPLETE ===');
}

// Run the test
testSubscriptionValidation().catch(console.error); 