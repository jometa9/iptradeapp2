import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 SIMULANDO EXACTAMENTE LO QUE HACE EL ENDPOINT...\n');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';

try {
  if (!existsSync(baseDir)) {
    console.log('❌ Directory not found:', baseDir);
    process.exit(1);
  }

  console.log(`📁 [ENDPOINT] Searching for ALL IPTRADECSV2*.csv files...`);
  
  const allPendingAccounts = [];
  
  // Read all files in the directory
  const files = readdirSync(baseDir);
  console.log(`📁 [ENDPOINT] All files in directory (${files.length}):`);
  files.forEach(file => console.log(`   📄 ${file}`));
  
  const csvFiles = files.filter(file => 
    file.includes('IPTRADECSV2') && file.endsWith('.csv')
  );
  
  console.log(`📁 [ENDPOINT] Found ${csvFiles.length} IPTRADECSV2*.csv files:`);
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
          console.log(`✅ [ENDPOINT] Found account: ${accountId} (${platform}) - ${status} - File: ${fileName}`);
        }
      }
    } catch (error) {
      console.log(`❌ [ENDPOINT] Error reading ${fileName}: ${error.message}`);
    }
  }
  
  console.log(`📋 [ENDPOINT] Total pending accounts found: ${allPendingAccounts.length}`);
  allPendingAccounts.forEach((acc, index) => {
    console.log(`   [ENDPOINT] ${index + 1}. ${acc.account_id} (${acc.platform}) - ${acc.status} - File: ${acc.filePath}`);
  });
  
} catch (error) {
  console.log(`❌ [ENDPOINT] Error accessing directory: ${error.message}`);
}
