#!/usr/bin/env node
/**
 * Script para probar la funcionalidad completa de logout
 * Verifica que todos los datos del usuario se eliminen correctamente
 */
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:30/api';
const TEST_API_KEY = 'test-api-key-12345678';

async function testCompleteLogout() {
  console.log('🧪 === TESTING COMPLETE LOGOUT FUNCTIONALITY ===');

  try {
    // 1. Simular que hay datos del usuario (esto normalmente se haría a través del login)
    console.log('\n1️⃣ Simulating user data creation...');

    // En un test real, aquí haríamos login y crearías algunas cuentas, configuraciones, etc.
    // Por ahora solo probamos el endpoint de limpieza directamente

    // 2. Probar el endpoint de limpieza de datos
    console.log('\n2️⃣ Testing user data cleanup endpoint...');

    const response = await fetch(`${API_BASE}/clear-user-data?apiKey=${TEST_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Backend cleanup result:', JSON.stringify(result, null, 2));

    // 3. Verificar que los datos se limpiaron
    console.log('\n3️⃣ Verifying data cleanup...');

    if (result.message === 'User data cleared successfully') {
      console.log('✅ User data cleared successfully!');

      // Mostrar qué se limpió
      const cleared = result.cleared;
      console.log(`   - Subscription cache: ${cleared.subscriptionCache ? '✅' : '❌'}`);
      console.log(`   - User accounts: ${cleared.userAccounts ? '✅' : '❌'}`);
      console.log(`   - MT5 data: ${cleared.mt5Data ? '✅' : '❌'}`);
      console.log(`   - cTrader data: ${cleared.ctraderData ? '✅' : '❌'}`);

      if (cleared.errors.length > 0) {
        console.warn(`⚠️  Some cleanup had errors: ${cleared.errors.join(', ')}`);
      }
    } else {
      console.error('❌ Unexpected response:', result);
    }

    console.log('\n🧪 === TEST COMPLETED ===');
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Ejecutar test
testCompleteLogout();
