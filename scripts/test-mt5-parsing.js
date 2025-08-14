import { readFileSync } from 'fs';

import csvManager from '../server/src/services/csvManager.js';

const mt5Path =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

console.log('🔍 Testing MT5 CSV parsing...\n');

// Leer el archivo como buffer
const buffer = readFileSync(mt5Path);
console.log('📄 File size:', buffer.length, 'bytes');
console.log('📄 First 4 bytes (hex):', buffer.slice(0, 4).toString('hex'));
console.log('📄 First 2 bytes:', buffer[0], buffer[1]);

// Verificar si es UTF-16 LE BOM
if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
  console.log('✅ UTF-16 LE BOM detected!');

  // Decodificar como UTF-16 LE
  const content = buffer.toString('utf16le');
  console.log('\n📋 Content as UTF-16 LE:');
  console.log(content);

  // Limpiar líneas
  const lines = content.split('\n').filter(line => line.trim());
  console.log('\n📋 Clean lines:');
  lines.forEach((line, i) => {
    console.log(`Line ${i}: "${line.trim()}"`);
  });
} else {
  console.log('❌ No UTF-16 BOM detected');

  // Intentar como UTF-8
  const content = buffer.toString('utf8');
  console.log('\n📋 Content as UTF-8:');
  console.log(content);
}

// Probar el parser de csvManager
console.log('\n🧪 Testing csvManager.parseCSVFile:');
const parsed = csvManager.parseCSVFile(mt5Path);
console.log('Parsed result:', JSON.stringify(parsed, null, 2));
