#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';

console.log('🔧 Simulating Offline Account by Modifying CSV Timestamp\n');

const mt5CsvPath =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

function simulateOfflineAccount() {
  if (!existsSync(mt5CsvPath)) {
    console.log('❌ MT5 CSV file not found');
    return;
  }

  try {
    const content = readFileSync(mt5CsvPath, 'utf8');
    console.log('📋 Original content:');
    console.log(content);

    // Calcular un timestamp que haga que la cuenta aparezca offline (más de 5 segundos atrás)
    const now = Math.floor(Date.now() / 1000);
    const oldTimestamp = now - 10; // 10 segundos atrás, definitivamente offline

    // Reemplazar el timestamp en la línea STATUS
    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes('[STATUS]') && line.includes('[ONLINE]')) {
        return `[STATUS] [ONLINE] [${oldTimestamp}]`;
      }
      return line;
    });
    const updatedContent = updatedLines.join('\n');

    console.log('\n📋 Updated content:');
    console.log(updatedContent);

    // Escribir el archivo actualizado
    writeFileSync(mt5CsvPath, updatedContent, 'utf8');

    console.log('✅ CSV file updated with old timestamp');
    console.log(`🕐 New timestamp: ${oldTimestamp} (${now - oldTimestamp} seconds ago)`);
    console.log('\n🎯 This should trigger the account to appear as OFFLINE');
    console.log('Check your browser to see if it changes from green to orange!');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

simulateOfflineAccount();
