const fs = require('fs');
const path = require('path');

// Configuración
const BASE_URL = 'http://localhost:30';
const API_KEY = 'iptrade_89536f5b9e643c0433f3'; // Usar la API key de prueba

// Función para hacer requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
  }

  return data;
}

// Función para verificar cuentas pendientes
async function checkPendingAccounts() {
  try {
    console.log('🔍 Checking pending accounts...');
    
    // Verificar endpoint de cuentas pendientes
    const pendingData = await makeRequest('/api/accounts/pending');
    console.log('✅ Pending accounts from /api/accounts/pending:', pendingData);
    
    // Verificar endpoint de CSV scan (para comparar)
    try {
      const csvData = await makeRequest('/api/csv/scan-pending');
      console.log('📄 CSV scan data:', csvData);
    } catch (error) {
      console.log('⚠️ CSV scan endpoint not available or failed:', error.message);
    }
    
    return pendingData;
  } catch (error) {
    console.error('❌ Error checking pending accounts:', error.message);
    return null;
  }
}

// Función para ejecutar Link Platforms
async function runLinkPlatforms() {
  try {
    console.log('🔗 Running Link Platforms...');
    
    const response = await makeRequest('/api/link-platforms', {
      method: 'POST',
    });
    
    console.log('✅ Link Platforms completed:', response);
    return response;
  } catch (error) {
    console.error('❌ Error running Link Platforms:', error.message);
    return null;
  }
}

// Función principal de prueba
async function runTest() {
  console.log('🧪 Testing Pending Accounts Detection Fix');
  console.log('==========================================\n');
  
  // Paso 1: Verificar estado inicial
  console.log('📋 Step 1: Checking initial pending accounts state...');
  const initialPending = await checkPendingAccounts();
  
  // Paso 2: Ejecutar Link Platforms
  console.log('\n🔗 Step 2: Running Link Platforms...');
  const linkResult = await runLinkPlatforms();
  
  // Esperar un momento para que se procesen los cambios
  console.log('\n⏳ Waiting 3 seconds for processing...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Paso 3: Verificar estado después de Link Platforms
  console.log('\n📋 Step 3: Checking pending accounts after Link Platforms...');
  const finalPending = await checkPendingAccounts();
  
  // Paso 4: Análisis de resultados
  console.log('\n📊 Step 4: Analysis...');
  console.log('Initial pending accounts:', initialPending?.totalPending || 0);
  console.log('Final pending accounts:', finalPending?.totalPending || 0);
  
  if (finalPending && finalPending.totalPending > 0) {
    console.log('✅ SUCCESS: Pending accounts detected after Link Platforms!');
    console.log('Pending accounts found:');
    Object.entries(finalPending.pendingAccounts || {}).forEach(([id, account]) => {
      console.log(`  - ${id}: ${account.platform} (${account.status})`);
    });
  } else {
    console.log('⚠️ No pending accounts detected after Link Platforms');
    console.log('This might be normal if no new accounts were found');
  }
  
  console.log('\n🎯 Test completed!');
}

// Ejecutar el test
runTest().catch(console.error);
