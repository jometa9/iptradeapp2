import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 CONSULTANDO MANUALMENTE LOS DOS CSV ACTIVOS...\n');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';

// Los dos archivos activos según el scan anterior
const activeFiles = [
  'IPTRADECSV2MT4.csv',  // MT4 bot
  'IPTRADECSV2MT5.csv'   // MT5 bot
];

const allPendingAccounts = [];

activeFiles.forEach((fileName, index) => {
  const filePath = join(baseDir, fileName);
  console.log(`📄 ${index + 1}. ${fileName}:`);
  
  try {
    if (!existsSync(filePath)) {
      console.log(`   ❌ File not found: ${filePath}`);
      return;
    }
    
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
      
      // Extract status
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
      console.log(`   👤 Account: ${accountId} (${platform}) - ${status} - timestamp: ${timestamp}`);
    } else {
      console.log(`   ⚠️  No valid account data found`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error reading: ${error.message}`);
  }
  
  console.log(''); // Empty line between files
});

console.log('='.repeat(60));
console.log(`📊 SUMMARY: ${allPendingAccounts.length} pending accounts found`);
console.log('='.repeat(60));

allPendingAccounts.forEach((acc, index) => {
  console.log(`   ${index + 1}. ${acc.account_id} (${acc.platform}) - ${acc.status} - File: ${acc.filePath.split('\\').pop()}`);
});

if (allPendingAccounts.length === 2) {
  console.log('\n🎉 ¡ÉXITO! Ambos bots están escribiendo en archivos separados.');
  console.log('💡 El endpoint debería encontrar ambas cuentas.');
} else if (allPendingAccounts.length === 1) {
  console.log('\n⚠️  Solo se encontró 1 cuenta.');
  console.log('💡 Verificar si ambos bots están activos.');
} else {
  console.log('\n❌ No se encontraron cuentas.');
}
