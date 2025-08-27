import { readFileSync, existsSync } from 'fs';

const CSV_FILE = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv';

console.log('🔍 Debugging CSV file content changes...');

const readCSVContent = () => {
  try {
    if (!existsSync(CSV_FILE)) {
      console.log('❌ CSV file does not exist');
      return null;
    }

    const content = readFileSync(CSV_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log(`📄 CSV Content (${lines.length} lines):`);
    lines.forEach((line, index) => {
      console.log(`   ${index + 1}: ${line}`);
    });

    // Extract account info
    const typeMatch = content.match(/\[TYPE\]\s*\[PENDING\]\s*\[(MT[45])\]\s*\[(\d+)\]/);
    if (typeMatch) {
      const [, platform, accountId] = typeMatch;
      console.log(`👤 Found Account: ${accountId} (${platform})`);
    }

    const statusMatch = content.match(/\[STATUS\]\s*\[(ONLINE|OFFLINE)\]\s*\[(\d+)\]/);
    if (statusMatch) {
      const [, status, timestamp] = statusMatch;
      console.log(`📡 Status: ${status} (${timestamp})`);
    }

    return { content, lines };
  } catch (error) {
    console.log(`❌ Error reading CSV: ${error.message}`);
    return null;
  }
};

const monitorChanges = () => {
  let lastContent = '';
  let changeCount = 0;

  console.log('🔄 Monitoring CSV file for changes...');
  console.log('Press Ctrl+C to stop\n');

  const checkForChanges = () => {
    const result = readCSVContent();
    if (result) {
      const { content } = result;
      
      if (content !== lastContent) {
        changeCount++;
        console.log(`\n🔄 CHANGE #${changeCount} detected at ${new Date().toLocaleTimeString()}`);
        console.log('=' .repeat(60));
        
        lastContent = content;
      }
    }
  };

  // Check immediately
  checkForChanges();
  
  // Check every 2 seconds
  setInterval(checkForChanges, 2000);
};

monitorChanges();
