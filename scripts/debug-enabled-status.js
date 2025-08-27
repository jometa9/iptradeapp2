import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function debugEnabledStatus() {
  console.log('🔍 Debugging enabled status parsing...');
  
  // Buscar el archivo CSV de la cuenta 250062001
  const csvPaths = [
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT4.csv',
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT5.csv',
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv',
  ];
  
  csvPaths.forEach(filePath => {
    if (existsSync(filePath)) {
      console.log(`\n📄 Checking file: ${filePath}`);
      
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        console.log('📋 Raw content:');
        lines.forEach(line => console.log(`   ${line}`));
        
        // Simular el parsing de parseCSVFile
        let currentAccountData = null;
        
        for (const line of lines) {
          const matches = line.match(/\[([^\]]*)\]/g);
          if (!matches || matches.length < 2) continue;
          
          const values = matches.map(m => m.replace(/[\[\]]/g, ''));
          const lineType = values[0];
          
          if (lineType === 'TYPE' && values[3] === '250062001') {
            console.log(`\n🎯 Found account 250062001 in TYPE line:`, values);
            currentAccountData = {
              account_id: values[3],
              account_type: values[1].toLowerCase(),
              platform: values[2],
            };
          } else if (lineType === 'CONFIG' && currentAccountData && currentAccountData.account_id === '250062001') {
            console.log(`\n⚙️ Found CONFIG line for 250062001:`, values);
            
            if (currentAccountData.account_type === 'master') {
              const enabled = values[2] === 'ENABLED';
              const name = values[3] || 'Master Account';
              console.log(`   🔍 Parsing MASTER config:`);
              console.log(`      values[2] = "${values[2]}"`);
              console.log(`      enabled = values[2] === 'ENABLED' = ${enabled}`);
              console.log(`      name = "${name}"`);
              
              currentAccountData.config = {
                enabled: enabled,
                name: name,
              };
            }
          }
        }
        
        if (currentAccountData && currentAccountData.config) {
          console.log(`\n✅ Final result for account 250062001:`);
          console.log(`   config.enabled = ${currentAccountData.config.enabled}`);
          console.log(`   config.name = "${currentAccountData.config.name}"`);
        }
        
      } catch (error) {
        console.error(`❌ Error reading file ${filePath}:`, error.message);
      }
    } else {
      console.log(`\n❌ File not found: ${filePath}`);
    }
  });
}

debugEnabledStatus();
