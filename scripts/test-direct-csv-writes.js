#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import csvManager from '../server/src/services/csvManager.js';

// Directorio de CSVs de prueba
const csvDataDir = join(process.cwd(), 'server', 'csv_data');

// Crear directorio si no existe
if (!existsSync(csvDataDir)) {
  mkdirSync(csvDataDir, { recursive: true });
}

// Simular escritura de un bot MASTER
const writeMasterCSV = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const accountId = '12345';

  const content = [
    `[TYPE][MASTER][MT4][${accountId}]`,
    `[STATUS][ONLINE][${timestamp}]`,
    '[CONFIG][MASTER][ENABLED][Master Principal]',
    '[TICKET][123001][EURUSD][BUY][0.1][1.0850][1.0750][1.0950][' + (timestamp - 300) + ']',
    '[TICKET][123002][GBPUSD][SELL][0.2][1.2500][1.2600][1.2400][' + (timestamp - 150) + ']',
  ].join('\n');

  const filePath = join(csvDataDir, 'IPTRADECSV2.csv');
  writeFileSync(filePath, content + '\n', 'utf8');

  console.log(`✅ Bot wrote MASTER account to: ${filePath}`);
  return filePath;
};

// Escribir archivo con múltiples cuentas
const writeMultipleAccountsCSV = () => {
  const timestamp = Math.floor(Date.now() / 1000);

  const content = [
    // Master account
    '[TYPE][MASTER][MT4][12345]',
    `[STATUS][ONLINE][${timestamp}]`,
    '[CONFIG][MASTER][ENABLED][Master Principal]',
    '[TICKET][123001][EURUSD][BUY][0.1][1.0850][1.0750][1.0950][' + (timestamp - 300) + ']',
    '[TICKET][123002][GBPUSD][SELL][0.2][1.2500][1.2600][1.2400][' + (timestamp - 150) + ']',
    // Slave account
    '[TYPE][SLAVE][MT5][67890]',
    `[STATUS][ONLINE][${timestamp}]`,
    '[CONFIG][SLAVE][ENABLED][1.5][NULL][FALSE][10][0.01][12345]',
    // Pending account
    '[TYPE][PENDING][MT4][250062001]',
    `[STATUS][ONLINE][${timestamp}]`,
    '[CONFIG][PENDING]',
    // Another master offline
    '[TYPE][MASTER][MT5][54321]',
    `[STATUS][OFFLINE][${timestamp - 10}]`,
    '[CONFIG][MASTER][DISABLED][Master Secundario]',
  ].join('\n');

  const filePath = join(csvDataDir, 'IPTRADECSV2_multiple.csv');
  writeFileSync(filePath, content + '\n', 'utf8');

  console.log(`✅ Created CSV with multiple accounts: ${filePath}`);
  return filePath;
};

// Simular escritura de un bot SLAVE
const writeSlaveCSV = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const accountId = '67890';
  const masterId = '12345';

  const content = [
    `[TYPE][SLAVE][MT5][${accountId}]`,
    `[STATUS][ONLINE][${timestamp}]`,
    `[CONFIG][SLAVE][ENABLED][1.5][NULL][FALSE][10][0.01][${masterId}]`,
  ].join('\n');

  const filePath = join(csvDataDir, 'IPTRADECSV2_slave.csv');
  writeFileSync(filePath, content + '\n', 'utf8');

  console.log(`✅ Bot wrote SLAVE account to: ${filePath}`);
  return filePath;
};

// Simular que el servidor modifica la configuración
const serverModifiesConfig = (filePath, newConfig) => {
  console.log('\n📝 Server modifying configuration...');

  // Leer archivo existente
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  // Modificar línea CONFIG
  const updatedLines = lines.map(line => {
    if (line.includes('[CONFIG]')) {
      if (line.includes('[MASTER]')) {
        return `[CONFIG][MASTER][${newConfig.enabled ? 'ENABLED' : 'DISABLED'}][${newConfig.name || 'Master Account'}]`;
      } else if (line.includes('[SLAVE]')) {
        return `[CONFIG][SLAVE][${newConfig.enabled ? 'ENABLED' : 'DISABLED'}][${newConfig.lotMultiplier || '1.0'}][${newConfig.forceLot || 'NULL'}][${newConfig.reverseTrading ? 'TRUE' : 'FALSE'}][${newConfig.maxLot || 'NULL'}][${newConfig.minLot || 'NULL'}][${newConfig.masterId || 'NULL'}]`;
      }
    }
    return line;
  });

  // Escribir archivo actualizado
  writeFileSync(filePath, updatedLines.join('\n') + '\n', 'utf8');
  console.log(`✅ Server updated CONFIG in: ${filePath}`);
};

// Simular que el bot lee la configuración y la preserva
const botPreservesConfig = filePath => {
  console.log('\n🤖 Bot reading and preserving configuration...');

  // Leer configuración existente
  let configLine = '[CONFIG][MASTER][ENABLED][Master Account]'; // Default

  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('[CONFIG]')) {
        configLine = line;
        console.log(`   📖 Bot read CONFIG: ${configLine}`);
        break;
      }
    }
  }

  // Bot reescribe todo preservando CONFIG
  const timestamp = Math.floor(Date.now() / 1000);
  const newContent = [
    '[TYPE][MASTER][MT4][12345]',
    `[STATUS][ONLINE][${timestamp}]`,
    configLine, // Preserva la configuración leída
    '[TICKET][123001][EURUSD][BUY][0.1][1.0850][1.0750][1.0950][' + (timestamp - 300) + ']',
    '[TICKET][123003][USDJPY][BUY][0.3][110.50][110.00][111.00][' + timestamp + ']', // Nuevo trade
  ].join('\n');

  writeFileSync(filePath, newContent + '\n', 'utf8');
  console.log(`✅ Bot rewrote file preserving CONFIG`);
};

// Probar el nuevo parser
const testNewParser = () => {
  console.log('\n=== STEP 4: Testing new parseCSVFile method ===');

  // Probar con el archivo master
  const masterFile = join(csvDataDir, 'IPTRADECSV2.csv');
  console.log(`\n📝 Parsing single account file: ${masterFile}`);

  const parsedData = csvManager.parseCSVFile(masterFile);
  console.log('\n📊 Parsed data:');
  console.log(JSON.stringify(parsedData, null, 2));

  // Verificar que los datos se parsearon correctamente
  if (parsedData.length > 0) {
    const account = parsedData[0];
    console.log('\n✅ Parser successfully extracted:');
    console.log(`   - Account ID: ${account.account_id}`);
    console.log(`   - Type: ${account.account_type}`);
    console.log(`   - Platform: ${account.platform}`);
    console.log(`   - Status: ${account.status}`);
    console.log(`   - Config Enabled: ${account.config.enabled}`);
    console.log(`   - Config Name: ${account.config.name}`);
    console.log(`   - Tickets: ${account.tickets.length}`);
  }

  // Probar con múltiples cuentas
  console.log('\n=== STEP 5: Testing parser with multiple accounts ===');
  const multiFile = writeMultipleAccountsCSV();
  console.log(`\n📝 Parsing multiple accounts file: ${multiFile}`);

  const multiParsedData = csvManager.parseCSVFile(multiFile);
  console.log(`\n📊 Found ${multiParsedData.length} accounts:`);

  multiParsedData.forEach((account, index) => {
    console.log(`\n  Account ${index + 1}:`);
    console.log(`    - ID: ${account.account_id}`);
    console.log(`    - Type: ${account.account_type}`);
    console.log(`    - Platform: ${account.platform}`);
    console.log(`    - Status: ${account.status}`);
    if (account.account_type === 'master') {
      console.log(`    - Enabled: ${account.config.enabled}`);
      console.log(`    - Name: ${account.config.name}`);
      console.log(`    - Tickets: ${account.tickets.length}`);
    } else if (account.account_type === 'slave') {
      console.log(`    - Enabled: ${account.config.enabled}`);
      console.log(`    - Master ID: ${account.master_id}`);
      console.log(`    - Lot Multiplier: ${account.config.lotMultiplier}`);
    }
  });
};

// Menú principal
const main = async () => {
  console.log('🎯 Direct CSV Write Test\n');
  console.log('This demonstrates how bots write directly to IPTRADECSV2.csv\n');

  // Paso 1: Bot escribe inicial
  console.log('=== STEP 1: Bot writes initial CSV ===');
  const masterFile = writeMasterCSV();
  const slaveFile = writeSlaveCSV();

  // Mostrar contenido
  console.log('\n📄 Master CSV content:');
  console.log(readFileSync(masterFile, 'utf8'));

  // Paso 2: Servidor modifica configuración
  console.log('\n=== STEP 2: Server modifies configuration ===');
  serverModifiesConfig(masterFile, {
    enabled: false,
    name: 'Master Trading Disabled',
  });

  serverModifiesConfig(slaveFile, {
    enabled: true,
    lotMultiplier: '2.0',
    reverseTrading: true,
    masterId: '12345',
  });

  // Mostrar contenido modificado
  console.log('\n📄 Master CSV after server modification:');
  console.log(readFileSync(masterFile, 'utf8'));

  // Paso 3: Bot hace ping y preserva configuración
  console.log('\n=== STEP 3: Bot pings and preserves configuration ===');
  botPreservesConfig(masterFile);

  // Mostrar contenido final
  console.log('\n📄 Final Master CSV content:');
  console.log(readFileSync(masterFile, 'utf8'));

  // Paso 4: Probar el nuevo parser
  testNewParser();

  console.log('\n✅ Test complete!');
  console.log('\n💡 Key points demonstrated:');
  console.log('   1. Bots write directly to IPTRADECSV2.csv');
  console.log('   2. Server modifies CONFIG line when user changes settings');
  console.log('   3. Bots read and preserve CONFIG when rewriting file');
  console.log('   4. Everything happens in the same CSV file');
  console.log('   5. New parser correctly handles bracket format');
};

// Ejecutar
main().catch(console.error);
