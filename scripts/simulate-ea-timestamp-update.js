#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(colors.bright + colors.blue + '🤖 Simulating EA Timestamp Updates\n' + colors.reset);

// Rutas de los archivos CSV
const csvFiles = [
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
];

// Función para actualizar timestamp en un archivo CSV
function updateCSVTimestamp(filePath, accountId, newTimestamp) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(colors.red + `❌ File not found: ${filePath}` + colors.reset);
      return false;
    }

    // Leer archivo
    const buffer = fs.readFileSync(filePath);
    let content;

    // Detectar encoding
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      content = buffer.toString('utf16le');
    } else {
      content = buffer.toString('utf8');
    }

    const lines = content.trim().split('\n');
    let updated = false;

    // Buscar la línea STATUS para la cuenta específica
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(/\[([^\]]*)\]/g);

      if (matches && matches.length >= 4) {
        const values = matches.map(m => m.replace(/[\[\]]/g, ''));

        // Si es una línea TYPE con la cuenta que buscamos
        if (values[0] === 'TYPE' && values[3] === accountId) {
          // Buscar la siguiente línea STATUS para esta cuenta
          for (let j = i + 1; j < lines.length; j++) {
            const statusLine = lines[j];
            const statusMatches = statusLine.match(/\[([^\]]*)\]/g);

            if (statusMatches && statusMatches.length >= 3) {
              const statusValues = statusMatches.map(m => m.replace(/[\[\]]/g, ''));

              if (statusValues[0] === 'STATUS') {
                // Actualizar el timestamp
                const newStatusLine = `[STATUS][${statusValues[1]}][${newTimestamp}]`;
                lines[j] = newStatusLine;
                updated = true;
                console.log(
                  colors.green +
                    `✅ Updated timestamp for account ${accountId} to ${newTimestamp}` +
                    colors.reset
                );
                break;
              }
            }
          }
          break;
        }
      }
    }

    if (updated) {
      // Escribir el archivo actualizado
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log(colors.green + `📝 File updated: ${path.basename(filePath)}` + colors.reset);
      return true;
    } else {
      console.log(
        colors.yellow +
          `⚠️  Account ${accountId} not found in ${path.basename(filePath)}` +
          colors.reset
      );
      return false;
    }
  } catch (error) {
    console.error(colors.red + `❌ Error updating ${filePath}:`, error.message + colors.reset);
    return false;
  }
}

// Función para simular actualizaciones del EA
async function simulateEAUpdates() {
  console.log(colors.yellow + '\n📋 Step 1: Reading current CSV files...' + colors.reset);

  // Leer archivos actuales
  csvFiles.forEach((filePath, index) => {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(
        `   File ${index + 1}: ${path.basename(filePath)} - Last modified: ${stats.mtime.toISOString()}`
      );
    } else {
      console.log(
        colors.red + `   File ${index + 1}: ${path.basename(filePath)} - NOT FOUND` + colors.reset
      );
    }
  });

  // Simular actualizaciones cada 10 segundos
  let updateCount = 0;
  const interval = setInterval(() => {
    updateCount++;
    const newTimestamp = Math.floor(Date.now() / 1000);

    console.log(
      colors.yellow +
        `\n📋 Step ${updateCount + 1}: Simulating EA update (${new Date().toLocaleTimeString()})` +
        colors.reset
    );

    // Actualizar timestamp para la cuenta 11219046 (MT5)
    updateCSVTimestamp(csvFiles[0], '11219046', newTimestamp);

    // Actualizar timestamp para la cuenta 250062001 (MT4)
    updateCSVTimestamp(csvFiles[1], '250062001', newTimestamp);

    console.log(colors.cyan + `   ⏰ New timestamp: ${newTimestamp}` + colors.reset);

    // Detener después de 5 actualizaciones
    if (updateCount >= 5) {
      console.log(colors.yellow + '\n🛑 Simulation completed!' + colors.reset);
      clearInterval(interval);
      process.exit(0);
    }
  }, 10000); // Cada 10 segundos

  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log(colors.yellow + '\n🛑 Stopping simulation...' + colors.reset);
    clearInterval(interval);
    process.exit(0);
  });
}

// Ejecutar simulación
simulateEAUpdates();
