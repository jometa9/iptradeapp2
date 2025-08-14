#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Crear directorio csv_data si no existe
const csvDataDir = join(process.cwd(), 'csv_data');
if (!existsSync(csvDataDir)) {
  mkdirSync(csvDataDir, { recursive: true });
}

// Generar ejemplo de IPTRADECSV2.csv con múltiples cuentas
const generateIPTRADECSV2 = () => {
  const timestamp = Math.floor(Date.now() / 1000);

  // Contenido con múltiples cuentas en formato de corchetes
  const content = [
    // Master account con trades
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

    // Otro master sin trades
    '[TYPE][MASTER][MT5][54321]',
    `[STATUS][ONLINE][${timestamp - 3}]`,
    '[CONFIG][MASTER][DISABLED][Master Secundario]',

    // Otro slave offline
    '[TYPE][SLAVE][CTRADER][88888]',
    `[STATUS][OFFLINE][${timestamp - 60}]`,
    '[CONFIG][SLAVE][ENABLED][2.0][NULL][FALSE][NULL][NULL][NULL]',
  ].join('\n');

  const filePath = join(csvDataDir, 'IPTRADECSV2.csv');
  writeFileSync(filePath, content + '\n', 'utf8');

  console.log('✅ Created IPTRADECSV2.csv with multiple accounts');
  console.log('📁 File location:', filePath);
  console.log('\n📄 Content:');
  console.log(content);
  console.log('\n🔍 When the server processes this file, it should create:');
  console.log('  - accounts/12345.csv (Master with trades)');
  console.log('  - accounts/67890.csv (Slave)');
  console.log('  - accounts/250062001.csv (Pending)');
  console.log('  - accounts/54321.csv (Master without trades)');
  console.log('  - accounts/88888.csv (Slave offline)');
};

// Generar también ejemplo en formato CSV tradicional
const generateTraditionalCSV = () => {
  const timestamp = new Date().toISOString();

  const content = [
    'timestamp,account_id,account_type,status,action,data,master_id,platform',
    `${timestamp},99999,master,online,ping,{},NULL,MT4`,
    `${timestamp},77777,slave,online,ping,{},99999,MT5`,
    `${timestamp},360360,pending,online,ping,{},NULL,CTRADER`,
  ].join('\n');

  const filePath = join(csvDataDir, 'IPTRADECSV2_traditional.csv');
  writeFileSync(filePath, content + '\n', 'utf8');

  console.log('\n✅ Created IPTRADECSV2_traditional.csv in traditional format');
  console.log('📁 File location:', filePath);
  console.log('\n📄 Content:');
  console.log(content);
};

// Ejecutar
console.log('🚀 Generating test IPTRADECSV2 files...\n');
generateIPTRADECSV2();
generateTraditionalCSV();

console.log('\n📝 Instructions:');
console.log('1. Start the server with: cd server && npm run dev');
console.log('2. The Link Platforms process will detect these CSV files');
console.log('3. The iptradeCSVProcessor will create individual account files');
console.log('4. Check the accounts/ directory for the individual CSV files');
console.log('\n💡 You can also manually trigger processing by modifying the IPTRADECSV2.csv file');
