import { readFileSync, existsSync } from 'fs';

console.log('🔍 Simple CSV check...');

const filePath = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv';

console.log(`Checking: ${filePath}`);

if (existsSync(filePath)) {
  console.log('✅ File exists');
  try {
    const content = readFileSync(filePath, 'utf8');
    console.log('Content:', content);
  } catch (error) {
    console.log('Error reading:', error.message);
  }
} else {
  console.log('❌ File not found');
}
