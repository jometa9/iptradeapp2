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
  magenta: '\x1b[35m',
};

console.log(colors.bright + colors.blue + '📊 CSV Timestamp Monitor\n' + colors.reset);

// Rutas de los archivos CSV
const csvFiles = [
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
];

// Función para leer y parsear un archivo CSV
function parseCSVFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    let content;

    // Detectar encoding
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      content = buffer.toString('utf16le');
    } else {
      content = buffer.toString('utf8');
    }

    const lines = content
      .trim()
      .split('\n')
      .filter(line => line.trim());
    const accounts = new Map();
    let currentAccountId = null;
    let currentAccountData = null;

    for (const line of lines) {
      const matches = line.match(/\[([^\]]*)\]/g);
      if (!matches || matches.length < 2) continue;

      const values = matches.map(m => m.replace(/[\[\]]/g, ''));
      const lineType = values[0];

      switch (lineType) {
        case 'TYPE':
          currentAccountId = values[3];
          currentAccountData = {
            account_id: currentAccountId,
            account_type: values[1].toLowerCase(),
            platform: values[2],
            status: 'offline',
            timestamp: null,
          };
          accounts.set(currentAccountId, currentAccountData);
          break;

        case 'STATUS':
          if (currentAccountData) {
            currentAccountData.status = values[1].toLowerCase();
            currentAccountData.timestamp = values[2];
          }
          break;
      }
    }

    return Array.from(accounts.values());
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

// Función para mostrar información de un archivo
function showFileInfo(filePath, fileIndex) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(
        colors.red +
          `❌ File ${fileIndex + 1}: ${path.basename(filePath)} - NOT FOUND` +
          colors.reset
      );
      return;
    }

    const stats = fs.statSync(filePath);
    const accounts = parseCSVFile(filePath);

    console.log(
      colors.cyan + `\n📄 File ${fileIndex + 1}: ${path.basename(filePath)}` + colors.reset
    );
    console.log(`   📅 Last modified: ${stats.mtime.toISOString()}`);
    console.log(`   📏 Size: ${stats.size} bytes`);

    if (accounts && accounts.length > 0) {
      console.log(`   👥 Accounts found: ${accounts.length}`);
      accounts.forEach(account => {
        if (account.account_type === 'pending') {
          const now = Date.now() / 1000;
          const pingTime = parseInt(account.timestamp) || 0;
          const timeDiff = now - pingTime;
          const timeSinceStr =
            timeDiff > 0
              ? `${timeDiff.toFixed(1)}s ago`
              : `${Math.abs(timeDiff).toFixed(1)}s in future`;

          const statusColor = timeDiff <= 5 ? colors.green : colors.red;
          console.log(
            `   - ${account.account_id} (${account.platform}): ${statusColor}${account.status}${colors.reset} - timestamp: ${account.timestamp} (${timeSinceStr})`
          );
        }
      });
    } else {
      console.log(`   ⚠️  No accounts found or parsing error`);
    }
  } catch (error) {
    console.error(colors.red + `❌ Error reading ${filePath}:`, error.message + colors.reset);
  }
}

// Función principal de monitoreo
function monitorCSVFiles() {
  console.log(
    colors.yellow + `\n🔄 Monitoring ${csvFiles.length} CSV files every 2 seconds...` + colors.reset
  );
  console.log(colors.yellow + `Press Ctrl+C to stop\n` + colors.reset);

  let lastModifiedTimes = new Map();

  // Inicializar tiempos de modificación
  csvFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      lastModifiedTimes.set(filePath, stats.mtime.getTime());
    }
  });

  const interval = setInterval(() => {
    const now = new Date();
    console.log(colors.magenta + `\n⏰ ${now.toLocaleTimeString()}` + colors.reset);

    let hasChanges = false;

    csvFiles.forEach((filePath, index) => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const currentModified = stats.mtime.getTime();
        const lastModified = lastModifiedTimes.get(filePath) || 0;

        if (currentModified > lastModified) {
          console.log(colors.green + `🔔 CHANGE DETECTED in File ${index + 1}!` + colors.reset);
          hasChanges = true;
          lastModifiedTimes.set(filePath, currentModified);
        }

        showFileInfo(filePath, index);
      } else {
        showFileInfo(filePath, index);
      }
    });

    if (!hasChanges) {
      console.log(colors.yellow + `   💤 No changes detected` + colors.reset);
    }
  }, 2000);

  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log(colors.yellow + `\n🛑 Stopping monitor...` + colors.reset);
    clearInterval(interval);
    process.exit(0);
  });
}

// Ejecutar monitoreo
monitorCSVFiles();
