import { readFileSync } from 'fs';

function debugParsing() {
  console.log('🔍 Debugging CSV parsing...');
  
  const content = `[TYPE] [MASTER] [MT4] [250062001]
[STATUS] [ONLINE] [1756317783]
[CONFIG] [SLAVE] [DISABLED] [2] [NULL] [TRUE] [NULL] [NULL]`;

  console.log('📄 Content:');
  console.log(content);
  
  const lines = content.split('\n').filter(line => line.trim());
  console.log('\n📋 Parsing lines:');
  
  let typeData = null;
  let statusData = null;
  let configData = null;
  
  for (const line of lines) {
    console.log(`\n🔍 Processing: "${line}"`);
    
    if (line.includes('[TYPE]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 4) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        typeData = {
          type: values[1], // PENDING, MASTER, SLAVE
          platform: values[2], // MT4, MT5, CTRADER
          accountId: values[3], // Account ID
        };
        console.log(`   ✅ TYPE parsed:`, typeData);
      }
    } else if (line.includes('[STATUS]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 3) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        statusData = {
          status: values[1], // ONLINE, OFFLINE
          timestamp: parseInt(values[2]), // Unix timestamp
        };
        console.log(`   ✅ STATUS parsed:`, statusData);
      }
    } else if (line.includes('[CONFIG]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 2) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        configData = {
          configType: values[1], // PENDING, MASTER, SLAVE
          details: values.slice(2), // Additional config details
        };
        console.log(`   ✅ CONFIG parsed:`, configData);
      }
    }
  }
  
  console.log('\n🎯 Final parsed data:');
  console.log('   typeData:', typeData);
  console.log('   statusData:', statusData);
  console.log('   configData:', configData);
  
  if (typeData && statusData && configData) {
    console.log('\n🔧 Account type determination:');
    console.log(`   TYPE line says: ${typeData.type}`);
    console.log(`   CONFIG line says: ${configData.configType}`);
    console.log(`   Using TYPE as source of truth: ${typeData.type}`);
    
    console.log('\n⚙️ Config parsing:');
    if (typeData.type === 'MASTER') {
      const enabled = configData.details[1] === 'ENABLED';
      const name = configData.details[2] || `${typeData.accountId}`;
      console.log(`   enabled: ${configData.details[1]} === 'ENABLED' = ${enabled}`);
      console.log(`   name: ${name}`);
    } else if (typeData.type === 'SLAVE') {
      const enabled = configData.details[1] === 'ENABLED';
      console.log(`   enabled: ${configData.details[1]} === 'ENABLED' = ${enabled}`);
    }
  }
}

debugParsing();
