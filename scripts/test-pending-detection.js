import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import csvManager from '../server/src/services/csvManager.js';

const csvDir = path.join(process.cwd(), 'csv_data');
if (!existsSync(csvDir)) {
  mkdirSync(csvDir, { recursive: true });
}

async function createTestPendingCSV() {
  const testFile = path.join(csvDir, 'test_pending_detection.csv');

  // Crear CSV con cuentas pending en el nuevo formato
  const csvContent = `[TYPE][PENDING][MT4][250062001]
[STATUS][ONLINE][${Math.floor(Date.now() / 1000)}]
[CONFIG][PENDING][]
[TYPE][PENDING][MT5][11219046]
[STATUS][ONLINE][${Math.floor(Date.now() / 1000)}]
[CONFIG][PENDING][]`;

  writeFileSync(testFile, csvContent);
  console.log('✅ Created test pending CSV at:', testFile);
  console.log('📄 Content:');
  console.log(csvContent);
  console.log('');

  return testFile;
}

async function testPendingDetection() {
  console.log('🧪 Testing pending account detection with new format...\n');

  // Crear archivo de prueba
  const testFile = await createTestPendingCSV();

  // Agregar archivo al csvManager
  csvManager.csvFiles.set(testFile, {
    lastModified: Date.now(),
    data: csvManager.parseCSVFile(testFile),
  });

  // Test 1: Parsear archivo directamente
  console.log('📋 Test 1: Parsing CSV file directly');
  const parsedData = csvManager.parseCSVFile(testFile);
  console.log('Parsed accounts:', JSON.stringify(parsedData, null, 2));
  console.log('');

  // Test 2: Obtener todas las cuentas activas
  console.log('📋 Test 2: Getting all active accounts');
  const allAccounts = await csvManager.getAllActiveAccounts();
  console.log('Pending accounts found:', allAccounts.pendingAccounts.length);
  allAccounts.pendingAccounts.forEach(acc => {
    console.log(`  - ${acc.account_id} (${acc.platform}): ${acc.status}`);
  });
  console.log('');

  // Test 3: Verificar emisión de eventos
  console.log('📋 Test 3: Testing pending accounts update emission');

  // Escuchar evento
  csvManager.once('pendingAccountsUpdate', data => {
    console.log('📨 Received pendingAccountsUpdate event:');
    console.log(`  - Accounts: ${data.accounts.length}`);
    data.accounts.forEach(acc => {
      console.log(`    • ${acc.account_id} (${acc.platform}): ${acc.status}`);
    });
  });

  // Disparar actualización
  await csvManager.scanAndEmitPendingUpdates();

  console.log('\n✅ All tests completed!');
}

// Ejecutar test
testPendingDetection().catch(console.error);
