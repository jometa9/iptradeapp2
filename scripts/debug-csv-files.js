import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Debugging CSV files detection...');

// Simular la búsqueda de archivos CSV como lo hace el sistema
const findCSVFiles = async () => {
  const csvFiles = [];
  
  // Buscar en ubicaciones específicas conocidas
  const searchPaths = [
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv'
  ];

  console.log('📁 Searching for CSV files...');
  
  for (const filePath of searchPaths) {
    try {
      if (fs.existsSync(filePath)) {
        console.log(`✅ Found: ${filePath}`);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          
          console.log(`   📄 Content (${lines.length} lines):`);
          lines.forEach((line, index) => {
            if (line.includes('[TYPE]') || line.includes('[STATUS]') || line.includes('[CONFIG]')) {
              console.log(`   ${index + 1}: ${line.trim()}`);
            }
          });
          
          csvFiles.push({
            path: filePath,
            content: content,
            lines: lines.length
          });
        } catch (error) {
          console.log(`   ❌ Error reading file: ${error.message}`);
        }
      } else {
        console.log(`❌ File not found: ${filePath}`);
      }
    } catch (error) {
      console.log(`❌ Error checking file ${filePath}: ${error.message}`);
    }
  }

  return csvFiles;
};

// Simular el procesamiento de archivos
const processCSVFiles = (files) => {
  console.log('\n🔄 Processing CSV files...');
  
  const accounts = {
    pendingAccounts: [],
    masterAccounts: {},
    slaveAccounts: {}
  };

  files.forEach((file, index) => {
    console.log(`\n📋 Processing file ${index + 1}: ${path.basename(file.path)}`);
    
    const lines = file.content.split('\n').filter(line => line.trim());
    
    let typeData = null;
    let statusData = null;
    let configData = null;

    // Parse CSV2 format
    for (const line of lines) {
      if (line.includes('[TYPE]')) {
        const matches = line.match(/\[([^\]]+)\]/g);
        if (matches && matches.length >= 4) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          typeData = {
            type: values[1], // PENDING, MASTER, SLAVE
            platform: values[2], // MT4, MT5, CTRADER
            accountId: values[3], // Account ID
          };
          console.log(`   👤 Account: ${typeData.accountId} (${typeData.type}) - ${typeData.platform}`);
        }
      } else if (line.includes('[STATUS]')) {
        const matches = line.match(/\[([^\]]+)\]/g);
        if (matches && matches.length >= 3) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          statusData = {
            status: values[1], // ONLINE, OFFLINE
            timestamp: parseInt(values[2]), // Unix timestamp
          };
          console.log(`   📡 Status: ${statusData.status} (${statusData.timestamp})`);
        }
      } else if (line.includes('[CONFIG]')) {
        const matches = line.match(/\[([^\]]+)\]/g);
        if (matches && matches.length >= 2) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          configData = {
            config: values[1], // Config data
          };
          console.log(`   ⚙️ Config: ${configData.config}`);
        }
      }
    }

    // Add to accounts based on type
    if (typeData) {
      const accountInfo = {
        account_id: typeData.accountId,
        account_type: typeData.type,
        platform: typeData.platform,
        status: statusData?.status || 'unknown',
        timestamp: statusData?.timestamp || null,
        config: configData?.config || null,
        filePath: file.path
      };

      if (typeData.type === 'pending') {
        accounts.pendingAccounts.push(accountInfo);
        console.log(`   ✅ Added to pending accounts`);
      } else if (typeData.type === 'master') {
        accounts.masterAccounts[typeData.accountId] = accountInfo;
        console.log(`   ✅ Added to master accounts`);
      } else if (typeData.type === 'slave') {
        accounts.slaveAccounts[typeData.accountId] = accountInfo;
        console.log(`   ✅ Added to slave accounts`);
      }
    }
  });

  return accounts;
};

// Ejecutar diagnóstico
const runDiagnostic = async () => {
  try {
    const files = await findCSVFiles();
    
    if (files.length === 0) {
      console.log('❌ No CSV files found');
      return;
    }

    console.log(`\n📊 Found ${files.length} CSV files`);
    
    const accounts = processCSVFiles(files);
    
    console.log('\n📋 Final Account Summary:');
    console.log(`   Pending accounts: ${accounts.pendingAccounts.length}`);
    console.log(`   Master accounts: ${Object.keys(accounts.masterAccounts).length}`);
    console.log(`   Slave accounts: ${Object.keys(accounts.slaveAccounts).length}`);
    
    if (accounts.pendingAccounts.length > 0) {
      console.log('\n👤 Pending Accounts:');
      accounts.pendingAccounts.forEach(acc => {
        console.log(`   - ${acc.account_id} (${acc.platform}) - ${acc.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
};

runDiagnostic();
