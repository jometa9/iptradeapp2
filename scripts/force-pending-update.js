#!/usr/bin/env node

console.log('🔧 Forcing Pending Accounts Update Event\n');

// Función para hacer un request al servidor para forzar un update
async function forcePendingUpdate() {
  try {
    const baseUrl = 'http://localhost:30';
    const apiKey = 'iptrade_6616c788f776a3b114f0'; // Usar la misma API key que vimos en los logs

    console.log('📤 Making request to force pending accounts scan...');

    const response = await fetch(`${baseUrl}/api/csv/scan-pending`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server response:', data);
      console.log('\n🎯 This should trigger a pendingAccountsUpdate event in your browser');
      console.log('Check the browser console for the event!');
    } else {
      console.log('❌ Server error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Función para verificar el estado del servidor
async function checkServerStatus() {
  try {
    const response = await fetch('http://localhost:30/api/accounts/pending', {
      method: 'GET',
      headers: {
        'x-api-key': 'iptrade_6616c788f776a3b114f0',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('📊 Current pending accounts from server:', data.totalPending);
      return true;
    }
  } catch (error) {
    console.log('❌ Server not responding:', error.message);
    return false;
  }
}

async function runTest() {
  console.log('🔍 Step 1: Checking if server is running...');
  const serverUp = await checkServerStatus();

  if (!serverUp) {
    console.log('❌ Server is not running or not responding');
    console.log('Make sure the backend server is started');
    return;
  }

  console.log('✅ Server is running\n');

  console.log('🔍 Step 2: Forcing pending accounts update...');
  await forcePendingUpdate();

  console.log('\n🎯 Instructions:');
  console.log('1. Keep this script running');
  console.log('2. Go to your browser console');
  console.log('3. Add the ALL events listener I provided');
  console.log('4. You should see a pendingAccountsUpdate event');
  console.log('5. If you do not see it, the problem is in the backend SSE emission');
}

runTest();
