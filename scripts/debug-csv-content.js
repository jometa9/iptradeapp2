import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function debugCSVContent() {
  console.log('🔍 Debugging CSV content vs endpoint response...');
  
  // Archivos CSV que sabemos que existen
  const csvFiles = [
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv',
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT4.csv',
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT5.csv'
  ];
  
  console.log('\n📄 CSV Files Content:');
  console.log('=====================================');
  
  csvFiles.forEach(filePath => {
    if (existsSync(filePath)) {
      console.log(`\n📁 ${filePath}:`);
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        lines.forEach((line, index) => {
          console.log(`   Line ${index + 1}: ${line}`);
        });
        
        // Buscar específicamente líneas CONFIG para el account 250062001
        const configLines = lines.filter(line => 
          line.includes('[CONFIG]') && line.includes('250062001')
        );
        
        if (configLines.length > 0) {
          console.log(`\n   🎯 CONFIG lines for 250062001:`);
          configLines.forEach(line => {
            console.log(`      ${line}`);
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Error reading file: ${error.message}`);
      }
    } else {
      console.log(`\n📁 ${filePath}: File not found`);
    }
  });
  
  console.log('\n=====================================');
  console.log('✅ CSV content analysis complete');
}

debugCSVContent();
