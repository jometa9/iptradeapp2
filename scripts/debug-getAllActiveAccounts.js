import { readFileSync, existsSync } from 'fs';

// Simular el método parseCSVFile para debuggear
function parseCSVFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return [];
    }

    const buffer = readFileSync(filePath);
    let content;

    // Detectar UTF-16 LE BOM (FF FE)
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      content = buffer.toString('utf16le');
    } else {
      content = buffer.toString('utf8');
    }

    const lines = content
      .trim()
      .split('\n')
      .filter(line => line.trim());

    if (lines.length === 0) return [];

    // Detectar formato
    const firstLine = lines[0];
    const hasBrackets = firstLine.includes('[') && firstLine.includes(']');

    // Si es el formato antiguo con headers, usar el parser antiguo
    if (!hasBrackets && firstLine.includes(',')) {
      return []; // No implementado para este debug
    }

    // Nuevo formato con corchetes - múltiples cuentas en un archivo
    const accounts = new Map();
    let currentAccountId = null;
    let currentAccountData = null;

    for (const line of lines) {
      // Extraer valores entre corchetes
      const matches = line.match(/\[([^\]]*)\]/g);
      if (!matches || matches.length < 2) continue;

      const values = matches.map(m => m.replace(/[\[\]]/g, ''));
      const lineType = values[0];

      switch (lineType) {
        case 'TYPE':
          // Nueva cuenta
          currentAccountId = values[3]; // [TYPE][MASTER][MT4][12345]
          currentAccountData = {
            account_id: currentAccountId,
            account_type: values[1].toLowerCase(), // master, slave, pending
            platform: values[2],
            status: 'offline', // Se actualizará con STATUS line
            timestamp: null,
            config: {},
            tickets: [],
          };
          accounts.set(currentAccountId, currentAccountData);
          break;

        case 'STATUS':
          // Actualizar status
          if (currentAccountData) {
            currentAccountData.status = values[1].toLowerCase(); // online/offline
            currentAccountData.timestamp = values[2];
          }
          break;

        case 'CONFIG':
          // Parsear configuración según tipo de cuenta
          if (currentAccountData) {
            const configType = values[1].toLowerCase();
            if (configType === 'master' && currentAccountData.account_type === 'pending') {
              currentAccountData.account_type = 'master';
            } else if (configType === 'slave' && currentAccountData.account_type === 'pending') {
              currentAccountData.account_type = 'slave';
            }

            if (currentAccountData.account_type === 'master') {
              currentAccountData.config = {
                enabled: values[2] === 'ENABLED',
                name: values[3] || 'Master Account',
              };
              console.log(`🔍 [parseCSVFile] Master ${currentAccountData.account_id} config:`, currentAccountData.config);
            } else if (currentAccountData.account_type === 'slave') {
              currentAccountData.config = {
                enabled: values[2] === 'ENABLED',
                lotMultiplier: parseFloat(values[3]) || 1.0,
                forceLot: values[4] !== 'NULL' ? parseFloat(values[4]) : null,
                reverseTrading: values[5] === 'TRUE',
                masterId: values[6] !== 'NULL' ? values[6] : null,
                masterCsvPath: values[7] !== 'NULL' ? values[7] : null,
              };
            }
          }
          break;
      }
    }

    // Convertir Map a Array para compatibilidad
    return Array.from(accounts.values());
  } catch (error) {
    console.error(`Error parsing CSV file ${filePath}:`, error);
    return [];
  }
}

// Simular getAllActiveAccounts
function getAllActiveAccounts() {
  const accounts = {
    masterAccounts: {},
    slaveAccounts: {},
    unconnectedSlaves: [],
    pendingAccounts: [],
  };

  const csvPath = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT4.csv';
  
  if (existsSync(csvPath)) {
    console.log(`📄 Processing CSV file: ${csvPath}`);
    
    const csvData = parseCSVFile(csvPath);
    console.log(`📋 Parsed ${csvData.length} accounts from CSV`);
    
    csvData.forEach((row, index) => {
      if (row.account_id) {
        const accountId = row.account_id;
        const accountType = row.account_type;
        const platform = row.platform;
        const status = row.status;
        const timestamp = row.timestamp;

        console.log(`\n🔍 Processing account ${accountId} (${accountType}):`);
        console.log(`   Platform: ${platform}`);
        console.log(`   Status: ${status}`);
        console.log(`   Config:`, row.config);

        if (accountType === 'pending') {
          accounts.pendingAccounts.push({
            account_id: accountId,
            platform: platform,
            status: status,
            current_status: status,
            timestamp: timestamp,
            config: row.config || {},
            filePath: csvPath,
          });
        } else if (accountType === 'master') {
          accounts.masterAccounts[accountId] = {
            id: accountId,
            name: accountId,
            platform: platform,
            status: status,
            lastPing: timestamp,
            timeSinceLastPing: 0,
            config: row.config || {},
            connectedSlaves: [],
            totalSlaves: 0,
          };
          
          console.log(`✅ Added master account ${accountId} with config:`, row.config);
        }
      }
    });
  }

  return accounts;
}

// Ejecutar el debug
const result = getAllActiveAccounts();

console.log('\n📊 Final Result:');
console.log('=====================================');
console.log('Master Accounts:', Object.keys(result.masterAccounts));
Object.keys(result.masterAccounts).forEach(masterId => {
  const master = result.masterAccounts[masterId];
  console.log(`\n👑 Master ${masterId}:`);
  console.log(`   Platform: ${master.platform}`);
  console.log(`   Status: ${master.status}`);
  console.log(`   Config:`, master.config);
});

console.log('\n⏳ Pending Accounts:', result.pendingAccounts.length);
result.pendingAccounts.forEach(acc => {
  console.log(`   ${acc.account_id} (${acc.platform}) - ${acc.status}`);
});
