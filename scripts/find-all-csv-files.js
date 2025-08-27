import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 BUSCANDO TODOS LOS CSV EN EL SISTEMA...\n');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';

try {
  if (!existsSync(baseDir)) {
    console.log('❌ Directory not found:', baseDir);
    process.exit(1);
  }

  console.log(`📁 Directory: ${baseDir}\n`);
  
  const files = readdirSync(baseDir);
  console.log(`📊 Total files in directory: ${files.length}\n`);
  
  // Show ALL files first
  console.log('📋 ALL FILES IN DIRECTORY:');
  files.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Filter CSV files
  const csvFiles = files.filter(file => file.includes('IPTRADECSV2'));
  console.log(`🎯 IPTRADECSV2 CSV FILES FOUND: ${csvFiles.length}\n`);
  
  if (csvFiles.length === 0) {
    console.log('❌ No IPTRADECSV2 files found!');
    process.exit(1);
  }
  
  // Show each CSV file with content
  csvFiles.forEach((fileName, index) => {
    const filePath = join(baseDir, fileName);
    console.log(`📄 ${index + 1}. ${fileName}:`);
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      console.log(`   📊 Lines: ${lines.length}`);
      lines.forEach((line, lineIndex) => {
        console.log(`      ${lineIndex + 1}: ${line}`);
      });
      
      // Extract account info
      const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
      if (typeMatch) {
        const [, platform, accountId] = typeMatch;
        console.log(`   👤 Account: ${accountId} (${platform})`);
      } else {
        console.log(`   ⚠️  No valid account data found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading: ${error.message}`);
    }
    
    console.log(''); // Empty line between files
  });
  
  console.log('='.repeat(60));
  console.log(`📊 SUMMARY: ${csvFiles.length} IPTRADECSV2 files found`);
  console.log('='.repeat(60));
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
