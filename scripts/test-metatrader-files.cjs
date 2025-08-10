const fs = require('fs');
const path = require('path');

function testMetaTraderFiles() {
  console.log('🧪 Testing MetaTrader Files Direct Access\n');

  const mt4Path =
    '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/Program Files (x86)/MetaTrader 4/MQL4/Files/IPTRADECSV2.csv';
  const mt5Path =
    '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/IPTRADECSV2.csv';

  console.log('📁 Checking MT4 file...');
  if (fs.existsSync(mt4Path)) {
    console.log('✅ MT4 file exists');
    const content = fs.readFileSync(mt4Path, 'utf8');
    console.log('📄 MT4 content:');
    console.log(content);

    const lines = content.split('\n').filter(line => line.trim());
    console.log(`📊 MT4 lines: ${lines.length}`);

    if (lines.length >= 2) {
      const firstDataLine = lines[1];
      const values = firstDataLine.split(',').map(v => v.trim());
      console.log(`🔍 First data line: ${firstDataLine}`);
      console.log(`📋 Values: [${values.join(', ')}]`);

      if (values[0] === '0' && values.length >= 5) {
        console.log('✅ MT4 file has correct pending format');
      } else {
        console.log('❌ MT4 file does not have correct pending format');
      }
    }
  } else {
    console.log('❌ MT4 file does not exist');
  }

  console.log('\n📁 Checking MT5 file...');
  if (fs.existsSync(mt5Path)) {
    console.log('✅ MT5 file exists');
    const content = fs.readFileSync(mt5Path, 'utf8');
    console.log('📄 MT5 content:');
    console.log(content);

    const lines = content.split('\n').filter(line => line.trim());
    console.log(`📊 MT5 lines: ${lines.length}`);

    if (lines.length >= 2) {
      const firstDataLine = lines[1];
      const values = firstDataLine.split(',').map(v => v.trim());
      console.log(`🔍 First data line: ${firstDataLine}`);
      console.log(`📋 Values: [${values.join(', ')}]`);

      if (values[0] === '0' && values.length >= 5) {
        console.log('✅ MT5 file has correct pending format');
      } else {
        console.log('❌ MT5 file does not have correct pending format');
      }
    }
  } else {
    console.log('❌ MT5 file does not exist');
  }

  console.log('\n🎉 MetaTrader files test completed!');
}

testMetaTraderFiles();
