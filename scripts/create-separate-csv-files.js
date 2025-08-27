import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';

console.log('🔧 Creating separate CSV files for each bot...');

const baseDir = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files';
const originalFile = join(baseDir, 'IPTRADECSV2.csv');

try {
  if (!existsSync(originalFile)) {
    console.log('❌ Original file not found:', originalFile);
    process.exit(1);
  }

  // Read the current content
  const content = readFileSync(originalFile, 'utf8');
  console.log('📄 Current file content:');
  console.log(content);

  // Extract account info
  const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
  if (!typeMatch) {
    console.log('❌ No valid account data found in file');
    process.exit(1);
  }

  const [, platform, accountId] = typeMatch;
  console.log(`👤 Found account: ${accountId} (${platform})`);

  // Create separate files for each bot
  const mt5File = join(baseDir, `IPTRADECSV2_MT5_52381082.csv`);
  const mt4File = join(baseDir, `IPTRADECSV2_MT4_250062001.csv`);

  // Create MT5 file with current content (if it's MT5)
  if (platform === 'MT5') {
    writeFileSync(mt5File, content);
    console.log(`✅ Created MT5 file: ${mt5File}`);
  }

  // Create MT4 file with MT4 content
  const mt4Content = `[TYPE] [PENDING] [MT4] [250062001]
[STATUS] [ONLINE] [${Math.floor(Date.now() / 1000)}]
[CONFIG] [PENDING] []`;
  writeFileSync(mt4File, mt4Content);
  console.log(`✅ Created MT4 file: ${mt4File}`);

  // If current content is MT4, update MT4 file with current content
  if (platform === 'MT4') {
    writeFileSync(mt4File, content);
    console.log(`✅ Updated MT4 file with current content`);
  }

  // Backup original file
  const backupFile = join(baseDir, 'IPTRADECSV2_BACKUP.csv');
  renameSync(originalFile, backupFile);
  console.log(`📦 Backed up original file to: ${backupFile}`);

  console.log('\n🎉 SEPARATE FILES CREATED!');
  console.log('📁 Files created:');
  console.log(`   📄 ${mt5File}`);
  console.log(`   📄 ${mt4File}`);
  console.log(`   📦 ${backupFile}`);
  
  console.log('\n💡 NEXT STEPS:');
  console.log('1. Configure MT5 bot to write to: IPTRADECSV2_MT5_52381082.csv');
  console.log('2. Configure MT4 bot to write to: IPTRADECSV2_MT4_250062001.csv');
  console.log('3. Test the endpoint to see both accounts');

} catch (error) {
  console.error('❌ Error:', error.message);
}
