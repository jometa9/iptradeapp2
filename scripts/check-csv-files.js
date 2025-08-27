import { readFileSync, existsSync } from 'fs';

function checkCSVFiles() {
  console.log('🔍 Checking CSV files...');
  
  const csvFiles = [
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv',
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT4.csv',
    'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT5.csv'
  ];
  
  csvFiles.forEach(filePath => {
    console.log(`\n📁 ${filePath}:`);
    if (existsSync(filePath)) {
      console.log('   ✅ File exists');
      try {
        const content = readFileSync(filePath, 'utf8');
        console.log(`   📄 Content (${content.length} chars):`);
        console.log(`   "${content}"`);
        
        // Buscar líneas que contengan 250062001
        const lines = content.split('\n');
        const relevantLines = lines.filter(line => line.includes('250062001'));
        
        if (relevantLines.length > 0) {
          console.log('   🎯 Lines with 250062001:');
          relevantLines.forEach(line => {
            console.log(`      "${line}"`);
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Error reading: ${error.message}`);
      }
    } else {
      console.log('   ❌ File not found');
    }
  });
}

checkCSVFiles();
