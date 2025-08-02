#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuración realista
const PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'NinjaTrader'];
const BROKERS = [
  'ICMarkets',
  'Pepperstone',
  'XM',
  'FTMO',
  'MyForexFunds',
  'TheFundedTrader',
  'FivePercentOnline',
];
const ACCOUNT_TYPES = ['Live', 'Demo', 'Challenge', 'Funded'];

// Función para generar IDs de cuenta realistas
function generateRealisticAccountId(platform, broker) {
  const patterns = {
    MT4: () => Math.floor(Math.random() * 90000000) + 10000000, // 8 digits
    MT5: () => Math.floor(Math.random() * 900000000) + 100000000, // 9 digits
    cTrader: () => Math.floor(Math.random() * 90000) + 10000, // 5 digits
    TradingView: () => `TV${Math.floor(Math.random() * 90000) + 10000}`,
    NinjaTrader: () => `NT${Math.floor(Math.random() * 900000) + 100000}`,
  };

  return patterns[platform] ? patterns[platform]() : Math.floor(Math.random() * 900000) + 100000;
}

// Función para generar timestamp realista (últimas 24 horas)
function generateRecentTimestamp() {
  const now = new Date();
  const randomHoursAgo = Math.floor(Math.random() * 24);
  const randomMinutesAgo = Math.floor(Math.random() * 60);
  const timestamp = new Date(
    now.getTime() - randomHoursAgo * 60 * 60 * 1000 - randomMinutesAgo * 60 * 1000
  );
  return timestamp.toISOString();
}

// Función para generar datos de configuración realistas
function generateConfigData(accountType, broker, platform) {
  return JSON.stringify({
    accountType: accountType,
    broker: broker,
    platform: platform,
    currency: 'USD',
    leverage: platform === 'MT4' || platform === 'MT5' ? '1:500' : '1:100',
    balance: Math.floor(Math.random() * 50000) + 1000,
    equity: Math.floor(Math.random() * 55000) + 1000,
    serverName: `${broker}-${platform}-${Math.floor(Math.random() * 10) + 1}`,
    connectionStatus: 'connected',
  });
}

// Función para crear un archivo CSV de cuenta pendiente
function createPendingAccountCSV(accountId, platform, broker, accountType) {
  const baseTimestamp = generateRecentTimestamp();
  const startTime = new Date(baseTimestamp);

  const entries = [];

  // Header
  entries.push('timestamp,account_id,account_type,status,action,data,master_id,platform');

  // Secuencia realista de eventos para una cuenta pendiente
  const events = [
    { action: 'connect', status: 'connecting', data: '{}', offset: 0 },
    { action: 'ping', status: 'online', data: '{}', offset: 1 },
    {
      action: 'config',
      status: 'online',
      data: generateConfigData(accountType, broker, platform),
      offset: 2,
    },
    { action: 'ping', status: 'online', data: '{}', offset: 10 },
    { action: 'ping', status: 'online', data: '{}', offset: 20 },
    {
      action: 'heartbeat',
      status: 'online',
      data: '{"lastSeen":"' + new Date().toISOString() + '"}',
      offset: 30,
    },
  ];

  events.forEach(event => {
    const eventTime = new Date(startTime.getTime() + event.offset * 1000);
    entries.push(
      `${eventTime.toISOString()},${accountId},unknown,${event.status},${event.action},"${event.data}",,${platform}`
    );
  });

  return entries.join('\n');
}

// Función principal para generar múltiples cuentas pendientes
function generatePendingAccounts(count = 8) {
  console.log(`🚀 Generando ${count} cuentas pendientes realistas...`);

  const accountsDir = path.join(__dirname, '..', 'server', 'csv_data');

  // Crear directorio si no existe
  if (!fs.existsSync(accountsDir)) {
    fs.mkdirSync(accountsDir, { recursive: true });
    console.log(`📁 Directorio creado: ${accountsDir}`);
  }

  const generatedAccounts = [];
  const allEntries = ['timestamp,account_id,account_type,status,action,data,master_id,platform'];

  for (let i = 0; i < count; i++) {
    // Seleccionar plataforma y broker aleatoriamente
    const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
    const broker = BROKERS[Math.floor(Math.random() * BROKERS.length)];
    const accountType = ACCOUNT_TYPES[Math.floor(Math.random() * ACCOUNT_TYPES.length)];

    // Generar ID de cuenta realista
    const accountId = generateRealisticAccountId(platform, broker);

    // Crear eventos CSV para esta cuenta
    const baseTimestamp = generateRecentTimestamp();
    const startTime = new Date(baseTimestamp);

    const events = [
      { action: 'connect', status: 'connecting', data: '{}', offset: i * 100 },
      { action: 'ping', status: 'online', data: '{}', offset: i * 100 + 1 },
      {
        action: 'config',
        status: 'online',
        data: generateConfigData(accountType, broker, platform),
        offset: i * 100 + 2,
      },
      { action: 'ping', status: 'online', data: '{}', offset: i * 100 + 10 },
      { action: 'ping', status: 'online', data: '{}', offset: i * 100 + 20 },
      {
        action: 'heartbeat',
        status: 'online',
        data: '{"lastSeen":"' + new Date().toISOString() + '"}',
        offset: i * 100 + 30,
      },
    ];

    events.forEach(event => {
      const eventTime = new Date(startTime.getTime() + event.offset * 1000);
      allEntries.push(
        `${eventTime.toISOString()},${accountId},unknown,${event.status},${event.action},"${event.data}",,${platform}`
      );
    });

    const accountInfo = {
      id: accountId,
      platform: platform,
      broker: broker,
      accountType: accountType,
    };

    generatedAccounts.push(accountInfo);

    console.log(`✅ Cuenta creada: ${accountId} (${platform} - ${broker} - ${accountType})`);
  }

  // Crear el archivo IPTRADECSV2.csv consolidado
  const csvFilePath = path.join(accountsDir, 'IPTRADECSV2.csv');
  fs.writeFileSync(csvFilePath, allEntries.join('\n'));

  // Crear archivo de resumen
  const summaryPath = path.join(accountsDir, 'generated_accounts_summary.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_accounts: count,
        csv_file: 'IPTRADECSV2.csv',
        accounts: generatedAccounts,
      },
      null,
      2
    )
  );

  console.log(`\n📋 Resumen guardado en: ${summaryPath}`);
  console.log(`\n📁 Archivo CSV consolidado: ${csvFilePath}`);
  console.log(`\n🎉 ¡${count} cuentas pendientes generadas exitosamente!`);
  console.log(`\n🔄 El servidor debería detectar automáticamente el archivo IPTRADECSV2.csv.`);

  return generatedAccounts;
}

// Script CLI
if (require.main === module) {
  const count = process.argv[2] ? parseInt(process.argv[2]) : 8;

  if (isNaN(count) || count < 1 || count > 50) {
    console.error('❌ Error: Especifica un número válido entre 1 y 50');
    console.log('📖 Uso: node generate-realistic-pending-accounts.js [cantidad]');
    console.log('📖 Ejemplo: node generate-realistic-pending-accounts.js 10');
    process.exit(1);
  }

  try {
    generatePendingAccounts(count);
  } catch (error) {
    console.error('❌ Error generando cuentas:', error.message);
    process.exit(1);
  }
}

module.exports = { generatePendingAccounts };
