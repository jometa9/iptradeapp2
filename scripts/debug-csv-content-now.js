#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';

console.log('🔍 Debugging Current CSV Content and Status Calculation\n');

const csvPaths = [
  {
    path: '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
    platform: 'MT4'
  },
  {
    path: '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
    platform: 'MT5'
  }
];

function analyzeCSVFile(csvPath, platform) {
  console.log(`\n📄 Analyzing ${platform} CSV File:`);
  console.log(`📁 Path: ${csvPath}`);
  
  if (!existsSync(csvPath)) {
    console.log('❌ File does not exist');
    return;
  }

  try {
    const content = readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log(`📊 Total lines: ${lines.length}`);
    console.log('\n📋 Raw content:');
    console.log(content);
    console.log('\n📋 Processed lines:');
    
    let currentAccount = {};
    
    lines.forEach((line, index) => {
      console.log(`   Line ${index + 1}: "${line.trim()}"`);
      
      if (line.includes('[') && line.includes(']')) {
        const matches = line.match(/\[([^\]]*)\]/g);
        if (matches) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          console.log(`      Parsed values: [${values.join(', ')}]`);
          
          // Analizar según el tipo de línea
          if (values[0] === 'TYPE') {
            currentAccount = {
              accountId: values[3],
              accountType: values[1],
              platform: values[2]
            };
            console.log(`      📋 Account Definition: ${currentAccount.accountId} (${currentAccount.platform})`);
          } else if (values[0] === 'STATUS' && currentAccount.accountId) {
            const status = values[1];
            const timestamp = parseInt(values[2]);
            
            const now = Date.now() / 1000;
            const timeDiff = now - timestamp;
            const calculatedStatus = Math.abs(timeDiff) <= 5 ? 'online' : 'offline';
            
            console.log(`      📱 Account Status Analysis:`);
            console.log(`         Account ID: ${currentAccount.accountId}`);
            console.log(`         Platform: ${currentAccount.platform}`);
            console.log(`         Reported Status: ${status}`);
            console.log(`         Timestamp: ${timestamp}`);
            console.log(`         Current Time: ${Math.floor(now)}`);
            console.log(`         Time Difference: ${timeDiff.toFixed(1)} seconds`);
            console.log(`         Calculated Status: ${calculatedStatus}`);
            console.log(`         Frontend should show: ${calculatedStatus === 'online' ? 'GREEN (online)' : 'ORANGE (offline)'}`);
          }
        }
      }
    });
    
  } catch (error) {
    console.log(`❌ Error reading file: ${error.message}`);
  }
}

console.log('🧪 Current CSV Analysis for Account Status Detection\n');

csvPaths.forEach(csv => {
  analyzeCSVFile(csv.path, csv.platform);
});

console.log('\n🎯 Key Points to Check:');
console.log('1. Does the timestamp show the account should be offline?');
console.log('2. Is the time difference > 5 seconds?');
console.log('3. Is the backend calculating status correctly?');
console.log('4. Is the frontend receiving the correct calculated status?');

console.log('\n📱 Next Steps:');
console.log('1. Check the timestamp values above');
console.log('2. Verify if backend logs match these calculations');
console.log('3. Test frontend with browser console commands');
console.log('4. Refresh the page to get latest data from backend');
