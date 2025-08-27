import pkg from 'glob';
const { glob } = pkg;
import { readFileSync, existsSync } from 'fs';

console.log('🔍 Scanning ALL CSV files in the system...');

const scanAllCSVFiles = async () => {
  try {
    // Buscar todos los archivos IPTRADECSV2.csv en el sistema
    const patterns = [
      '**/IPTRADECSV2.csv',
      'C:/Users/*/AppData/Roaming/MetaQuotes/**/IPTRADECSV2.csv',
      'C:/Users/*/AppData/Local/MetaQuotes/**/IPTRADECSV2.csv',
    ];

    const allFiles = new Set(); // Use Set to avoid duplicates

    for (const pattern of patterns) {
      try {
        console.log(`🔍 Searching pattern: ${pattern}`);
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/.git/**'],
          absolute: true,
        });
        
        console.log(`   Found ${files.length} files`);
        files.forEach(file => allFiles.add(file));
      } catch (error) {
        console.error(`❌ Error searching pattern ${pattern}:`, error.message);
      }
    }

    console.log(`\n📊 Total unique CSV files found: ${allFiles.size}`);
    
    const activeFiles = [];
    
    for (const filePath of allFiles) {
      try {
        if (!existsSync(filePath)) {
          console.log(`⚠️  File not found: ${filePath}`);
          continue;
        }

        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        console.log(`\n📄 ${filePath}`);
        console.log(`   📊 Lines: ${lines.length}`);
        
        if (lines.length > 0) {
          lines.forEach((line, index) => {
            console.log(`      ${index + 1}: ${line}`);
          });

          // Extract account info
          const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
          if (typeMatch) {
            const [, platform, accountId] = typeMatch;
            console.log(`   👤 Account: ${accountId} (${platform})`);
            
            const statusMatch = content.match(/\[STATUS\]\s*\[(ONLINE|OFFLINE)\]\s*\[(\d+)\]/);
            if (statusMatch) {
              const [, status, timestamp] = statusMatch;
              console.log(`   📡 Status: ${status} (${timestamp})`);
            }
            
            activeFiles.push({
              filePath,
              accountId,
              platform,
              lines: lines.length
            });
          }
        } else {
          console.log(`   ❌ Empty file`);
        }
      } catch (error) {
        console.log(`   ❌ Error reading: ${error.message}`);
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`🔍 Total files scanned: ${allFiles.size}`);
    console.log(`✅ Active files with accounts: ${activeFiles.length}`);
    
    activeFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.accountId} (${file.platform}) - ${file.filePath}`);
    });
    
    if (activeFiles.length > 1) {
      console.log('\n🎉 MULTIPLE ACTIVE FILES FOUND!');
      console.log('💡 The endpoint should read from ALL these files to get all pending accounts.');
    } else if (activeFiles.length === 1) {
      console.log('\n⚠️  Only ONE active file found.');
      console.log('💡 Either only one bot is running, or they are writing to the same file.');
    } else {
      console.log('\n❌ NO active files found.');
    }
    
  } catch (error) {
    console.error('❌ Error scanning files:', error);
  }
};

scanAllCSVFiles();
