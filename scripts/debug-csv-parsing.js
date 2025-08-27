import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simular el parsing del CSV para debuggear
function debugCSVParsing() {
  console.log('🔍 Debugging CSV parsing...');
  
  // Buscar archivos CSV en las carpetas típicas
  const csvPaths = [
    join(__dirname, '..', 'accounts', '88888.csv'),
    join(__dirname, '..', 'csv_data', 'test_csv2_master.csv'),
    join(__dirname, '..', 'csv_data', 'test_pending_detection.csv'),
  ];
  
  csvPaths.forEach(filePath => {
    if (existsSync(filePath)) {
      console.log(`\n📄 Parsing file: ${filePath}`);
      console.log('=====================================');
      
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        console.log(`Total lines: ${lines.length}`);
        
        const accounts = new Map();
        let currentAccountId = null;
        let currentAccountData = null;
        
        for (const line of lines) {
          console.log(`\n🔍 Processing line: "${line}"`);
          
          // Extraer valores entre corchetes
          const matches = line.match(/\[([^\]]*)\]/g);
          if (!matches || matches.length < 2) {
            console.log('   ❌ No valid brackets found, skipping');
            continue;
          }
          
          const values = matches.map(m => m.replace(/[\[\]]/g, ''));
          const lineType = values[0];
          
          console.log(`   📋 Values: [${values.join('], [')}]`);
          console.log(`   🏷️ Line type: ${lineType}`);
          
          switch (lineType) {
            case 'TYPE':
              currentAccountId = values[3];
              currentAccountData = {
                account_id: currentAccountId,
                account_type: values[1].toLowerCase(),
                platform: values[2],
                status: 'offline',
                timestamp: null,
                config: {},
                tickets: [],
              };
              accounts.set(currentAccountId, currentAccountData);
              console.log(`   ✅ Created account: ${currentAccountId} (${currentAccountData.account_type})`);
              break;
              
            case 'STATUS':
              if (currentAccountData) {
                currentAccountData.status = values[1].toLowerCase();
                currentAccountData.timestamp = values[2];
                console.log(`   📊 Updated status: ${currentAccountData.status} (${currentAccountData.timestamp})`);
              }
              break;
              
            case 'CONFIG':
              if (currentAccountData) {
                const configType = values[1].toLowerCase();
                console.log(`   ⚙️ Config type: ${configType}`);
                
                if (configType === 'master' && currentAccountData.account_type === 'pending') {
                  currentAccountData.account_type = 'master';
                  console.log(`   🔄 Changed account type to: master`);
                } else if (configType === 'slave' && currentAccountData.account_type === 'pending') {
                  currentAccountData.account_type = 'slave';
                  console.log(`   🔄 Changed account type to: slave`);
                }
                
                if (currentAccountData.account_type === 'master') {
                  currentAccountData.config = {
                    enabled: values[2] === 'ENABLED',
                    name: values[3] || 'Master Account',
                  };
                  console.log(`   🎛️ Master config: enabled=${currentAccountData.config.enabled}, name=${currentAccountData.config.name}`);
                } else if (currentAccountData.account_type === 'slave') {
                  currentAccountData.config = {
                    enabled: values[2] === 'ENABLED',
                    lotMultiplier: parseFloat(values[3]) || 1.0,
                    forceLot: values[4] !== 'NULL' ? parseFloat(values[4]) : null,
                    reverseTrading: values[5] === 'TRUE',
                    masterId: values[6] !== 'NULL' ? values[6] : null,
                    masterCsvPath: values[7] !== 'NULL' ? values[7] : null,
                  };
                  currentAccountData.master_id = currentAccountData.config.masterId;
                  console.log(`   🎛️ Slave config: enabled=${currentAccountData.config.enabled}, masterId=${currentAccountData.config.masterId}`);
                  
                  // Verificar si el masterId es problemático
                  if (currentAccountData.config.masterId === 'ENABLED' || currentAccountData.config.masterId === 'DISABLED') {
                    console.log(`   🚨 PROBLEM: masterId is ${currentAccountData.config.masterId} - this will create invalid master accounts!`);
                  }
                }
              }
              break;
          }
        }
        
        console.log('\n📊 Final parsed accounts:');
        accounts.forEach((account, id) => {
          console.log(`   ${id}: ${account.account_type} (${account.platform}) - ${account.status}`);
          if (account.config && account.config.masterId) {
            console.log(`      Master ID: ${account.config.masterId}`);
          }
        });
        
      } catch (error) {
        console.error(`   ❌ Error parsing file: ${error.message}`);
      }
    } else {
      console.log(`\n❌ File not found: ${filePath}`);
    }
  });
}

debugCSVParsing();
