import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 Checking CSV files in the directory...');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';

try {
  if (!existsSync(baseDir)) {
    console.log('❌ Directory not found:', baseDir);
    process.exit(1);
  }

  const files = readdirSync(baseDir);
  const csvFiles = files.filter(file => file.includes('IPTRADECSV2'));
  
  console.log(`📁 Found ${csvFiles.length} IPTRADECSV2 files:`);
  
  csvFiles.forEach(fileName => {
    const filePath = join(baseDir, fileName);
    console.log(`\n📄 ${fileName}:`);
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      console.log(`   📊 Lines: ${lines.length}`);
      lines.forEach((line, index) => {
        console.log(`      ${index + 1}: ${line}`);
      });
      
      // Extract account info
      const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
      if (typeMatch) {
        const [, platform, accountId] = typeMatch;
        console.log(`   👤 Account: ${accountId} (${platform})`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading: ${error.message}`);
    }
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
