#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Testing Initial Pending Accounts Load from Cache\n');

// Función para simular el endpoint de cache
async function testCacheEndpoint() {
  try {
    const baseUrl = 'http://localhost:3000';
    const apiKey = 'test-key'; // Usar una API key de prueba

    console.log('🔍 Testing /api/accounts/pending/cache endpoint...');

    const response = await fetch(`${baseUrl}/api/accounts/pending/cache`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Cache endpoint response:');
      console.log(`   - Total pending: ${data.totalPending}`);
      console.log(`   - From cache: ${data.fromCache}`);
      console.log(`   - Message: ${data.message}`);

      if (data.pendingAccounts && Object.keys(data.pendingAccounts).length > 0) {
        console.log('\n📋 Pending accounts found:');
        Object.values(data.pendingAccounts).forEach(account => {
          console.log(`   - ${account.id} (${account.platform}) - ${account.status}`);
        });
      } else {
        console.log('   - No pending accounts found');
      }
    } else {
      const errorData = await response.json();
      console.log('❌ Cache endpoint error:', errorData);
    }
  } catch (error) {
    console.error('❌ Error testing cache endpoint:', error.message);
  }
}

// Función para verificar el estado del cache
function checkCacheState() {
  console.log('📋 Checking cache state...');

  const cachePath = join(process.cwd(), 'server', 'config', 'csv_watching_cache.json');

  if (existsSync(cachePath)) {
    try {
      const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
      console.log(`   - Cache exists with ${cacheData.totalFiles} files`);
      console.log(`   - Last scan: ${cacheData.lastScan}`);

      if (cacheData.csvFiles.length > 0) {
        console.log('\n📁 Cached CSV files:');
        cacheData.csvFiles.forEach((filePath, index) => {
          const exists = existsSync(filePath) ? '✅' : '❌';
          console.log(`   ${index + 1}. ${exists} ${filePath.split('/').pop()}`);
        });
      }
    } catch (error) {
      console.error('❌ Error reading cache:', error.message);
    }
  } else {
    console.log('❌ Cache file not found');
  }
}

// Función para verificar archivos CSV reales
function checkCSVFiles() {
  console.log('\n🔍 Checking actual CSV files...');

  const csvPaths = [
    '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
    '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
  ];

  csvPaths.forEach((path, index) => {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8').trim();
      const lines = content.split('\n').filter(line => line.trim());
      console.log(`   ${index + 1}. ✅ ${path.split('/').pop()} (${lines.length} lines)`);

      // Mostrar primeras líneas para verificar contenido
      if (lines.length > 0) {
        console.log(`      Content preview: ${lines[0].substring(0, 100)}...`);
      }
    } else {
      console.log(`   ${index + 1}. ❌ ${path.split('/').pop()} (not found)`);
    }
  });
}

// Ejecutar pruebas
async function runTests() {
  checkCacheState();
  checkCSVFiles();

  // Solo probar el endpoint si el servidor está corriendo
  console.log('\n🌐 Testing server endpoints...');
  try {
    await testCacheEndpoint();
  } catch (error) {
    console.log('⚠️ Server not running, skipping endpoint test');
  }

  console.log('\n✅ Initial pending load test completed');
}

runTests();
