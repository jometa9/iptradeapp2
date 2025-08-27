import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 DEBUGGING ENDPOINT LOGIC STEP BY STEP...\n');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';

try {
  console.log(`📁 [STEP 1] Accessing directory: ${baseDir}`);
  
  if (!existsSync(baseDir)) {
    console.log('❌ Directory not found!');
    process.exit(1);
  }
  console.log('✅ Directory exists\n');
  
  // Step 2: Read all files
  console.log(`📁 [STEP 2] Reading all files in directory...`);
  const files = readdirSync(baseDir);
  console.log(`📊 Total files found: ${files.length}`);
  files.forEach(file => console.log(`   📄 ${file}`));
  console.log('');
  
  // Step 3: Filter CSV files
  console.log(`📁 [STEP 3] Filtering IPTRADECSV2*.csv files...`);
  const csvFiles = files.filter(file => 
    file.includes('IPTRADECSV2') && file.endsWith('.csv')
  );
  console.log(`📊 CSV files found: ${csvFiles.length}`);
  csvFiles.forEach(file => console.log(`   📄 ${file}`));
  console.log('');
  
  // Step 4: Process each file
  console.log(`📁 [STEP 4] Processing each CSV file...`);
  const allPendingAccounts = [];
  
  for (const fileName of csvFiles) {
    const filePath = join(baseDir, fileName);
    console.log(`\n📄 Processing: ${fileName}`);
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      console.log(`   📊 Lines: ${lines.length}`);
      if (lines.length > 0) {
        lines.forEach((line, index) => {
          console.log(`      ${index + 1}: ${line}`);
        });
        
        // Extract account info
        console.log(`   🔍 Extracting account info...`);
        const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
        
        if (typeMatch) {
          const [, platform, accountId] = typeMatch;
          console.log(`   ✅ Type match found: ${platform} - ${accountId}`);
          
          // Extract status
          const statusMatch = content.match(/\[STATUS\]\s*\[(ONLINE|OFFLINE)\]\s*\[(\d+)\]/);
          const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
          const timestamp = statusMatch ? statusMatch[2] : Date.now().toString();
          
          console.log(`   ✅ Status match found: ${status} - ${timestamp}`);
          
          const account = {
            account_id: accountId,
            platform: platform,
            account_type: 'pending',
            status: status,
            timestamp: timestamp,
            filePath: filePath
          };
          
          allPendingAccounts.push(account);
          console.log(`   ✅ Account added: ${accountId} (${platform}) - ${status}`);
        } else {
          console.log(`   ❌ No type match found in content`);
        }
      } else {
        console.log(`   ⚠️  Empty file`);
      }
    } catch (error) {
      console.log(`   ❌ Error reading file: ${error.message}`);
    }
  }
  
  // Step 5: Final result
  console.log(`\n📁 [STEP 5] FINAL RESULT`);
  console.log(`📊 Total pending accounts found: ${allPendingAccounts.length}`);
  allPendingAccounts.forEach((acc, index) => {
    console.log(`   ${index + 1}. ${acc.account_id} (${acc.platform}) - ${acc.status} - File: ${acc.filePath.split('\\').pop()}`);
  });
  
  if (allPendingAccounts.length === 2) {
    console.log('\n🎉 SUCCESS: Both accounts found!');
  } else {
    console.log('\n⚠️  ISSUE: Expected 2 accounts, found', allPendingAccounts.length);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
