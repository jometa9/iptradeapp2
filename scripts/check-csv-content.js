import { readFileSync, existsSync } from 'fs';

function checkCSVContent() {
  console.log('🔍 Checking CSV file content directly...');
  
  const csvPath = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2MT4.csv';
  
  if (existsSync(csvPath)) {
    try {
      const content = readFileSync(csvPath, 'utf8');
      console.log('📄 Raw CSV Content:');
      console.log('=====================================');
      console.log(content);
      console.log('=====================================');
      
      // Verificar si contiene DISABLED
      if (content.includes('DISABLED')) {
        console.log('✅ Found DISABLED in CSV content');
      } else {
        console.log('❌ DISABLED not found in CSV content');
      }
      
      // Verificar si contiene ENABLED
      if (content.includes('ENABLED')) {
        console.log('✅ Found ENABLED in CSV content');
      } else {
        console.log('❌ ENABLED not found in CSV content');
      }
      
      // Verificar si contiene la cuenta 250062001
      if (content.includes('250062001')) {
        console.log('✅ Found account 250062001 in CSV content');
      } else {
        console.log('❌ Account 250062001 not found in CSV content');
      }
      
    } catch (error) {
      console.error('❌ Error reading CSV file:', error.message);
    }
  } else {
    console.log('❌ CSV file not found:', csvPath);
  }
}

checkCSVContent();
