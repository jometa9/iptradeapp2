#!/usr/bin/env node

/**
 * Script para debuggear el flujo completo de setMasterStatus
 */

import { getUserAccounts } from './server/src/controllers/configManager.js';
import csvManager from './server/src/services/csvManager.js';

console.log('🔍 Debugging setMasterStatus Flow');
console.log('=================================');

async function debugSetMasterFlow() {
  try {
    const masterAccountId = '250062001';
    const enabled = true; // Habilitar para probar
    const mockApiKey = 'test-api-key'; // Usar el mismo que en las pruebas
    
    console.log(`\n🔄 Simulating setMasterStatus for master ${masterAccountId}`);
    console.log(`   Enabled: ${enabled}`);
    console.log(`   API Key: ${mockApiKey}`);
    
    // Paso 1: Verificar que csvManager esté disponible
    console.log('\n1️⃣ Checking csvManager availability...');
    console.log(`   csvManager type: ${typeof csvManager}`);
    console.log(`   csvManager methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(csvManager)));
    
    // Paso 2: Actualizar el CSV del master
    console.log('\n2️⃣ Updating master CSV...');
    try {
      const masterUpdated = await csvManager.updateAccountStatus(masterAccountId, enabled);
      console.log(`   Master update result: ${masterUpdated}`);
    } catch (masterError) {
      console.error(`   ❌ Error updating master:`, masterError);
      return false;
    }
    
    // Paso 3: Obtener cuentas de usuario
    console.log('\n3️⃣ Getting user accounts...');
    try {
      const userAccounts = getUserAccounts(mockApiKey);
      console.log(`   User accounts structure:`, {
        masterAccounts: Object.keys(userAccounts.masterAccounts || {}),
        slaveAccounts: Object.keys(userAccounts.slaveAccounts || {}),
        connections: userAccounts.connections || {}
      });
      
      const configConnectedSlaves = Object.entries(userAccounts.connections || {})
        .filter(([, masterId]) => masterId === masterAccountId)
        .map(([slaveId]) => slaveId);
      
      console.log(`   Config connected slaves: ${configConnectedSlaves}`);
    } catch (userAccountsError) {
      console.error(`   ❌ Error getting user accounts:`, userAccountsError);
      return false;
    }
    
    // Paso 4: Obtener slaves desde CSV
    console.log('\n4️⃣ Getting slaves from CSV...');
    try {
      const csvConnectedSlaves = csvManager.getConnectedSlaves(masterAccountId);
      console.log(`   CSV connected slaves: ${csvConnectedSlaves.length} found`);
      console.log(`   Slaves details:`, csvConnectedSlaves);
      
      const slaveIds = csvConnectedSlaves.map(slave => slave.id);
      console.log(`   Slave IDs: ${slaveIds}`);
      
      // Paso 5: Actualizar cada slave
      console.log('\n5️⃣ Updating slave CSVs...');
      for (const slaveId of slaveIds) {
        console.log(`   🔄 Updating slave ${slaveId}...`);
        try {
          const slaveUpdated = await csvManager.updateAccountStatus(slaveId, enabled);
          console.log(`   ✅ Slave ${slaveId} update result: ${slaveUpdated}`);
        } catch (slaveError) {
          console.error(`   ❌ Error updating slave ${slaveId}:`, slaveError);
        }
      }
      
    } catch (csvSlavesError) {
      console.error(`   ❌ Error getting CSV slaves:`, csvSlavesError);
      return false;
    }
    
    console.log('\n✅ Debug flow completed successfully');
    return true;
    
  } catch (error) {
    console.error('💥 Debug flow crashed:', error);
    return false;
  }
}

// Ejecutar debug
debugSetMasterFlow()
  .then(result => {
    console.log(`\n📊 Debug Result: ${result ? 'SUCCESS' : 'FAILED'}`);
  })
  .catch(error => {
    console.error('💥 Debug crashed:', error);
  });
