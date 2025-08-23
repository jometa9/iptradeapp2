#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(80));
  log(message, 'bright');
  console.log('='.repeat(80));
}

function logSection(message) {
  console.log('\n' + '-'.repeat(60));
  log(message, 'cyan');
  console.log('-'.repeat(60));
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function parseCSV2Format(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const result = {
    type: null,
    status: null,
    config: null,
    tickets: [],
  };

  for (const line of lines) {
    if (line.includes('[TYPE]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 4) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        result.type = {
          type: values[1],
          platform: values[2],
          accountId: values[3],
        };
      }
    } else if (line.includes('[STATUS]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 3) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        result.status = {
          status: values[1],
          timestamp: parseInt(values[2]),
        };
      }
    } else if (line.includes('[CONFIG]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 2) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        result.config = {
          configType: values[1],
          details: values.slice(2),
        };
      }
    } else if (line.includes('[TICKET]')) {
      const matches = line.match(/\[([^\]]+)\]/g);
      if (matches && matches.length >= 4) {
        const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
        result.tickets.push({
          ticket: values[1],
          symbol: values[2],
          type: values[3],
          volume: parseFloat(values[4]),
          price: parseFloat(values[5]),
          time: values[6],
        });
      }
    }
  }

  return result;
}

function displayCSVContent(filePath, content) {
  logSection(`📄 Archivo: ${filePath}`);

  if (!content || content.trim() === '') {
    logWarning('Archivo vacío o sin contenido');
    return;
  }

  try {
    const parsed = parseCSV2Format(content);

    // Display TYPE information
    if (parsed.type) {
      log(
        `📋 TYPE: ${parsed.type.type} | ${parsed.type.platform} | ${parsed.type.accountId}`,
        'green'
      );
    }

    // Display STATUS information
    if (parsed.status) {
      const statusDate = new Date(parsed.status.timestamp * 1000);
      log(
        `🔄 STATUS: ${parsed.status.status} | ${statusDate.toLocaleString()}`,
        parsed.status.status === 'ONLINE' ? 'green' : 'red'
      );
    }

    // Display CONFIG information
    if (parsed.config) {
      log(`⚙️  CONFIG: ${parsed.config.configType} | ${parsed.config.details.join(' | ')}`, 'blue');
    }

    // Display TICKETS information
    if (parsed.tickets.length > 0) {
      log(`🎫 TICKETS (${parsed.tickets.length}):`, 'magenta');
      parsed.tickets.forEach((ticket, index) => {
        log(
          `   ${index + 1}. Ticket: ${ticket.ticket} | ${ticket.symbol} | ${ticket.type} | ${ticket.volume} | $${ticket.price} | ${ticket.time}`,
          'white'
        );
      });
    }

    // Display raw content for debugging
    logSection('📝 Contenido Raw:');
    console.log(content);
  } catch (error) {
    logError(`Error parsing CSV: ${error.message}`);
    logSection('📝 Contenido Raw (sin parsear):');
    console.log(content);
  }
}

function main() {
  logHeader('🔍 CHECK CSV CACHE - Verificador de Rutas Cacheadas CSV');

  // Path to cache file
  const cachePath = join(__dirname, '..', 'server', 'config', 'csv_watching_cache.json');

  if (!existsSync(cachePath)) {
    logError('No se encontró el archivo de cache de CSV');
    logInfo('Ruta esperada: ' + cachePath);
    process.exit(1);
  }

  try {
    // Read cache file
    const cacheContent = readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(cacheContent);

    logSection('📋 Información del Cache');
    log(`📅 Última actualización: ${new Date(cache.timestamp).toLocaleString()}`, 'yellow');
    log(`📊 Total de archivos: ${cache.totalFiles}`, 'yellow');
    log(`🔄 Último escaneo: ${new Date(cache.lastScan).toLocaleString()}`, 'yellow');
    log(`📦 Versión del cache: ${cache.version}`, 'yellow');

    if (!cache.csvFiles || cache.csvFiles.length === 0) {
      logWarning('No hay archivos CSV cacheados');
      return;
    }

    logSection(`📁 Archivos CSV Cacheados (${cache.csvFiles.length})`);

    let validFiles = 0;
    let totalSize = 0;

    for (let i = 0; i < cache.csvFiles.length; i++) {
      const filePath = cache.csvFiles[i];

      if (!existsSync(filePath)) {
        logError(`${i + 1}. ${filePath} - ARCHIVO NO ENCONTRADO`);
        continue;
      }

      try {
        const stats = statSync(filePath);
        const content = readFileSync(filePath, 'utf8');

        totalSize += stats.size;
        validFiles++;

        logSuccess(`${i + 1}. ${filePath}`);
        log(`   📏 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
        log(`   📅 Modificado: ${stats.mtime.toLocaleString()}`);

        displayCSVContent(filePath, content);
      } catch (error) {
        logError(`${i + 1}. ${filePath} - ERROR AL LEER: ${error.message}`);
      }
    }

    logSection('📊 Resumen');
    log(`✅ Archivos válidos: ${validFiles}/${cache.csvFiles.length}`, 'green');
    log(`📏 Tamaño total: ${(totalSize / 1024).toFixed(2)} KB`, 'yellow');

    if (validFiles === 0) {
      logWarning('No se encontraron archivos CSV válidos en el cache');
    }
  } catch (error) {
    logError(`Error al leer el cache: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
