import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';

async function checkAllCSVs() {
  console.log('🔍 Checking all CSV files for account 250062001...');
  
  try {
    // Buscar todos los archivos CSV que contengan IPTRADECSV2
    const patterns = [
      '**/*IPTRADECSV2*.csv',
      '**/csv_data/**/*IPTRADECSV2*.csv',
      '**/accounts/**/*IPTRADECSV2*.csv',
    ];

    const allFiles = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/.git/**'],
          absolute: true,
        });
        allFiles.push(...files);
      } catch (error) {
        console.error(`Error searching pattern ${pattern}:`, error);
      }
    }

    console.log(`📁 Found ${allFiles.length} CSV files:`);
    
    allFiles.forEach(filePath => {
      console.log(`\n📄 ${filePath}:`);
      
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          
          // Buscar líneas que contengan 250062001
          const relevantLines = lines.filter(line => line.includes('250062001'));
          
          if (relevantLines.length > 0) {
            console.log('   🎯 Found account 250062001:');
            relevantLines.forEach(line => {
              console.log(`      ${line}`);
            });
            
            // Verificar si es master o slave
            const typeLine = relevantLines.find(line => line.includes('[TYPE]'));
            const configLine = relevantLines.find(line => line.includes('[CONFIG]'));
            
            if (typeLine) {
              const typeMatch = typeLine.match(/\[TYPE\]\s*\[([^\]]+)\]/);
              if (typeMatch) {
                console.log(`   📋 TYPE: ${typeMatch[1]}`);
              }
            }
            
            if (configLine) {
              const configMatch = configLine.match(/\[CONFIG\]\s*\[([^\]]+)\]/);
              if (configMatch) {
                console.log(`   ⚙️ CONFIG: ${configMatch[1]}`);
              }
              
              // Verificar enabled/disabled
              const enabledMatch = configLine.match(/\[(ENABLED|DISABLED)\]/);
              if (enabledMatch) {
                console.log(`   🎛️ Status: ${enabledMatch[1]}`);
              }
            }
          } else {
            console.log('   ℹ️ Account 250062001 not found in this file');
          }
          
        } catch (error) {
          console.log(`   ❌ Error reading: ${error.message}`);
        }
      } else {
        console.log('   ❌ File not found');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllCSVs();
