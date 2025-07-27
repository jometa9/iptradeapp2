const API_KEY = 'test_api_key_123'; // Replace with your actual API key
const BASE_URL = 'http://localhost:30/api';

async function testDeleteEndpoints() {
  console.log('🧪 Testing delete account endpoints...\n');

  // Test 1: Delete master account
  console.log('1. Testing DELETE /accounts/master/{id}');
  try {
    const response = await fetch(`${BASE_URL}/accounts/master/test_master_123`, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    console.log('   Status:', response.status);
    console.log('   OK:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('   Response:', data);
    } else {
      const error = await response.text();
      console.log('   Error:', error);
    }
  } catch (error) {
    console.log('   Exception:', error.message);
  }

  console.log('\n2. Testing DELETE /accounts/slave/{id}');
  try {
    const response = await fetch(`${BASE_URL}/accounts/slave/test_slave_456`, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    console.log('   Status:', response.status);
    console.log('   OK:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('   Response:', data);
    } else {
      const error = await response.text();
      console.log('   Error:', error);
    }
  } catch (error) {
    console.log('   Exception:', error.message);
  }

  console.log('\n3. Testing DELETE /accounts/disconnect/{id}');
  try {
    const response = await fetch(`${BASE_URL}/accounts/disconnect/test_slave_789`, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    console.log('   Status:', response.status);
    console.log('   OK:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('   Response:', data);
    } else {
      const error = await response.text();
      console.log('   Error:', error);
    }
  } catch (error) {
    console.log('   Exception:', error.message);
  }

  console.log('\n✅ Test completed');
}

testDeleteEndpoints();
