import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 SIMULANDO EXACTAMENTE LO QUE HACE EL ENDPOINT...\n');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';

try {
  if (!existsSync(baseDir)) {
    console.log('❌ Directory not found:', baseDir);
    process.exit(1);
  }

  const allPendingAccounts = [];
  
  // Read all files in the directory
  const files = readdirSync(baseDir);
  files.forEach(file => console.log(`   📄 ${file}`));
  
  const csvFiles = files.filter(file => 
    file.includes('IPTRADECSV2') && file.endsWith('.csv')
  );
  
  csvFiles.forEach(file => console.log(`   📄 ${file}`));
  
  // Process each CSV file
  for (const fileName of csvFiles) {
    const filePath = join(baseDir, fileName);
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        // Extract account info from first line
        const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
        if (typeMatch) {
          const [, platform, accountId] = typeMatch;
          
          // Extract status from second line
          const statusMatch = content.match(/\[STATUS\]\s*\[(ONLINE|OFFLINE)\]\s*\[(\d+)\]/);
          const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
          const timestamp = statusMatch ? statusMatch[2] : Date.now().toString();
          
          const account = {
            account_id: accountId,
            platform: platform,
            account_type: 'pending',
            status: status,
            timestamp: timestamp,
            filePath: filePath
          };
          
          allPendingAccounts.push(account);
        }
      }
    } catch (error) {
      console.log(`❌ [ENDPOINT] Error reading ${fileName}: ${error.message}`);
    }
  }
} catch (error) {
  console.log(`❌ [ENDPOINT] Error accessing directory: ${error.message}`);
}
