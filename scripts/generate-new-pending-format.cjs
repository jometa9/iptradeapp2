const fs = require('fs');
const path = require('path');

// Función para generar timestamp reciente
function generateRecentTimestamp() {
  const now = new Date();
  // Generar un timestamp entre 0 y 30 segundos atrás
  const randomSeconds = Math.floor(Math.random() * 30);
  now.setSeconds(now.getSeconds() - randomSeconds);
  return now.toISOString();
}

// Función para generar timestamp offline (más de 5 segundos atrás)
function generateOfflineTimestamp() {
  const now = new Date();
  // Generar un timestamp entre 10 y 60 segundos atrás (offline)
  const randomSeconds = Math.floor(Math.random() * 50) + 10;
  now.setSeconds(now.getSeconds() - randomSeconds);
  return now.toISOString();
}

// Función para crear un archivo CSV con el nuevo formato [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
function createNewPendingFormatCSV(accounts) {
  const entries = [];

  // No hay header en el nuevo formato, solo datos
  accounts.forEach(account => {
    entries.push(`${account.pending_indicator},${account.account_id},${account.platform},${account.status},${account.timestamp}`);
  });

  return entries.join('\n');
}

// Generar cuentas pendientes con el nuevo formato
function generateNewPendingAccounts(count = 5) {
  const platforms = ['MT4', 'MT5', 'CTRADER', 'TRADINGVIEW'];
  const accounts = [];

  console.log(`🎯 Generando ${count} cuentas pendientes con el nuevo formato...\n`);

  for (let i = 0; i < count; i++) {
    const accountId = `25006${2000 + i}`;
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const isOnline = Math.random() > 0.3; // 70% probabilidad de estar online
    const timestamp = isOnline ? generateRecentTimestamp() : generateOfflineTimestamp();
    const status = isOnline ? 'PENDING' : 'PENDING'; // Siempre PENDING en el nuevo formato

    const account = {
      pending_indicator: '0',
      account_id: accountId,
      platform: platform,
      status: status,
      timestamp: timestamp
    };

    accounts.push(account);

    const statusText = isOnline ? '🟢 Online' : '🔴 Offline';
    console.log(`✅ Cuenta creada: ${accountId} (${platform}) - ${statusText}`);
  }

  return accounts;
}

// Función principal
function main() {
  try {
    console.log('🚀 Generador de Cuentas Pendientes - Nuevo Formato\n');

    // Crear directorio si no existe
    const csvDir = path.join(__dirname, '..', 'csv_data');
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }

    // Generar cuentas
    const accounts = generateNewPendingAccounts(8);

    // Crear el archivo CSV con el nuevo formato
    const csvContent = createNewPendingFormatCSV(accounts);
    const csvFilePath = path.join(csvDir, 'IPTRADECSV2.csv');
    
    fs.writeFileSync(csvFilePath, csvContent);

    // Crear archivo de resumen
    const summaryPath = path.join(csvDir, 'new_format_summary.json');
    const summary = {
      generated_at: new Date().toISOString(),
      format: 'new_simplified',
      description: 'Formato [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]',
      total_accounts: accounts.length,
      csv_file: 'IPTRADECSV2.csv',
      accounts: accounts.map(acc => ({
        id: acc.account_id,
        platform: acc.platform,
        status: acc.status,
        timestamp: acc.timestamp
      }))
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n📋 Resumen guardado en: ${summaryPath}`);
    console.log(`\n📁 Archivo CSV creado: ${csvFilePath}`);
    console.log(`\n📄 Contenido del archivo:`);
    console.log('─'.repeat(50));
    console.log(csvContent);
    console.log('─'.repeat(50));
    console.log(`\n🎉 ¡${accounts.length} cuentas pendientes generadas con el nuevo formato!`);
    console.log(`\n🔄 El servidor debería detectar automáticamente el archivo IPTRADECSV2.csv.`);

  } catch (error) {
    console.error('❌ Error generando cuentas pendientes:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  generateNewPendingAccounts,
  createNewPendingFormatCSV
};
