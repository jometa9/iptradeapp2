const fetch = require('node-fetch');

async function testLinkPlatformsEndpoint() {
  console.log('🧪 Testing Link Platforms endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/link-platforms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key', // Usar una clave de prueba
      },
    });

    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Link Platforms endpoint working:', data);
    } else {
      const error = await response.text();
      console.log('❌ Link Platforms endpoint error:', error);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testLinkPlatformsEndpoint();
