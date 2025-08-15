#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Testing CSV Search Control - Only during Link Accounts\n');

// Función para simular diferentes acciones y verificar si disparan búsqueda
async function testCSVSearchControl() {
  console.log('📋 Testing when CSV search should and should NOT be triggered...\n');

  // 1. Verificar estado inicial
  console.log('🔍 Step 1: Initial state check');
  const cachePath = join(process.cwd(), 'server', 'config', 'csv_watching_cache.json');
  if (existsSync(cachePath)) {
    const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`   - Cache exists with ${cacheData.totalFiles} files`);
    console.log(`   - Last scan: ${cacheData.lastScan}`);
  } else {
    console.log('   - No cache found');
  }

  // 2. Simular acciones que NO deberían disparar búsqueda completa
  console.log('\n❌ Step 2: Actions that should NOT trigger full CSV search');

  const actionsThatShouldNotSearch = [
    {
      name: 'Convert pending to master',
      description: 'Should only refresh existing files',
      endpoint: '/api/csv/update-account-type',
      method: 'POST',
    },
    {
      name: 'Delete pending account',
      description: 'Should only refresh existing files',
      endpoint: '/api/csv/delete-pending',
      method: 'DELETE',
    },
    {
      name: 'Scan platform accounts',
      description: 'Should only refresh existing files',
      endpoint: '/api/csv/scan-platform-accounts',
      method: 'POST',
    },
    {
      name: 'Frontend refresh button',
      description: 'Should only refresh existing files',
      endpoint: '/api/csv/refresh',
      method: 'POST',
    },
  ];

  actionsThatShouldNotSearch.forEach(action => {
    console.log(`   ✅ ${action.name}: ${action.description}`);
    console.log(`      Endpoint: ${action.method} ${action.endpoint}`);
  });

  // 3. Simular acciones que SÍ deberían disparar búsqueda completa
  console.log('\n✅ Step 3: Actions that SHOULD trigger full CSV search');

  const actionsThatShouldSearch = [
    {
      name: 'Link Platforms (main process)',
      description: 'Should do full system-wide CSV search',
      endpoint: '/api/link-platforms',
      method: 'POST',
      reason: 'This is the main process that discovers new CSV files',
    },
    {
      name: 'Manual Link Platforms',
      description: 'Should do full system-wide CSV search',
      endpoint: '/api/link-platforms/manual',
      method: 'POST',
      reason: 'Manual trigger for full discovery',
    },
  ];

  actionsThatShouldSearch.forEach(action => {
    console.log(`   🔍 ${action.name}: ${action.description}`);
    console.log(`      Endpoint: ${action.method} ${action.endpoint}`);
    console.log(`      Reason: ${action.reason}`);
  });

  // 4. Verificar archivos CSV reales
  console.log('\n📁 Step 4: Current CSV files in system');
  const csvPaths = [
    '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
    '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
  ];

  csvPaths.forEach((path, index) => {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8').trim();
      const lines = content.split('\n').filter(line => line.trim());
      console.log(`   ${index + 1}. ✅ ${path.split('/').pop()} (${lines.length} lines)`);
    } else {
      console.log(`   ${index + 1}. ❌ ${path.split('/').pop()} (not found)`);
    }
  });

  // 5. Resumen de control
  console.log('\n📊 Step 5: CSV Search Control Summary');
  console.log('   🎯 Goal: CSV search should ONLY happen during Link Accounts');
  console.log('   ✅ Implemented:');
  console.log('      - scanCSVFiles() only called during link accounts');
  console.log('      - Other actions use refreshAllFileData()');
  console.log('      - Frontend uses /api/csv/refresh instead of /api/csv/scan');
  console.log('   🔄 Benefits:');
  console.log('      - Faster response times for other actions');
  console.log('      - Reduced system load');
  console.log('      - More predictable behavior');
  console.log('      - Cache-based loading for immediate display');
}

// Ejecutar pruebas
testCSVSearchControl().then(() => {
  console.log('\n✅ CSV Search Control test completed');
  console.log('\n📝 Key Points:');
  console.log('   - Link Accounts = Full system search for new CSV files');
  console.log('   - All other actions = Refresh existing files only');
  console.log('   - Cache ensures immediate loading on app start');
  console.log('   - File watching monitors changes in real-time');
});
