#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Rutas de archivos
const paths = {
  // Archivos JSON a migrar/eliminar
  registeredAccounts: join(process.cwd(), 'server', 'config', 'registered_accounts.json'),
  slaveConfigurations: join(process.cwd(), 'server', 'config', 'slave_configurations.json'),
  copierStatus: join(process.cwd(), 'config', 'copier_status.json'),
  copierStatusBackup: join(process.cwd(), 'config', 'copier_status_backup.json'),
  tradingTransformations: join(process.cwd(), 'config', 'trading_transformations.json'),

  // CSV unificado destino
  csvUnified: join(process.cwd(), 'csv_data', 'IPTRADECSV_UNIFIED.csv'),
};

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: msg => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: msg => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: msg => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: msg => console.log(`\n${colors.cyan}=== ${msg} ===${colors.reset}`),
};

// Leer archivo JSON de forma segura
function readJSON(path) {
  try {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    log.error(`Error reading ${path}: ${error.message}`);
  }
  return null;
}

// Migrar datos al CSV unificado
async function migrateToUnifiedCSV() {
  log.section('Starting Migration to Unified CSV');

  const csvLines = [];

  // 1. Migrar cuentas registradas
  log.section('Migrating Registered Accounts');
  const registeredAccounts = readJSON(paths.registeredAccounts);

  if (registeredAccounts && registeredAccounts.userAccounts) {
    Object.entries(registeredAccounts.userAccounts).forEach(([apiKey, userData]) => {
      log.info(`Processing user with API key: ${apiKey.substring(0, 12)}...`);

      // Migrar masters
      if (userData.masterAccounts) {
        Object.entries(userData.masterAccounts).forEach(([accountId, master]) => {
          const config = {
            enabled: master.enabled !== false,
            name: master.name || `Master ${accountId}`,
          };

          const line = `[MASTER][${accountId}][${master.platform || 'MT4'}][ONLINE][${JSON.stringify(config)}][][${Math.floor(Date.now() / 1000)}]`;
          csvLines.push(line);
          log.success(`  Migrated master: ${accountId}`);
        });
      }

      // Migrar slaves
      if (userData.slaveAccounts) {
        Object.entries(userData.slaveAccounts).forEach(([accountId, slave]) => {
          const masterId = userData.connections?.[accountId] || '';
          const config = {
            enabled: slave.enabled !== false,
            lotMultiplier: 1.0,
            forceLot: null,
            reverseTrading: false,
          };

          const line = `[SLAVE][${accountId}][${slave.platform || 'MT5'}][ONLINE][${JSON.stringify(config)}][${masterId}][${Math.floor(Date.now() / 1000)}]`;
          csvLines.push(line);
          log.success(`  Migrated slave: ${accountId}`);
        });
      }

      // Migrar pending
      if (userData.pendingAccounts) {
        Object.entries(userData.pendingAccounts).forEach(([accountId, pending]) => {
          const line = `[PENDING][${accountId}][${pending.platform || 'MT4'}][ONLINE][{}][][${Math.floor(Date.now() / 1000)}]`;
          csvLines.push(line);
          log.success(`  Migrated pending: ${accountId}`);
        });
      }
    });
  }

  // 2. Migrar configuraciones de slaves
  log.section('Migrating Slave Configurations');
  const slaveConfigs = readJSON(paths.slaveConfigurations);

  if (slaveConfigs) {
    Object.entries(slaveConfigs).forEach(([accountId, config]) => {
      // Buscar si ya existe la línea del slave
      const existingIndex = csvLines.findIndex(line => line.includes(`[SLAVE][${accountId}]`));

      if (existingIndex !== -1) {
        // Actualizar configuración existente
        const parts = csvLines[existingIndex].match(/\[([^\]]*)\]/g);
        if (parts && parts.length >= 6) {
          const fullConfig = {
            enabled: config.enabled !== false,
            description: config.description || '',
            lotMultiplier: config.lotMultiplier || 1.0,
            forceLot: config.forceLot || null,
            reverseTrading: config.reverseTrading || false,
            maxLotSize: config.maxLotSize || null,
            minLotSize: config.minLotSize || null,
            allowedSymbols: config.allowedSymbols || [],
            blockedSymbols: config.blockedSymbols || [],
            allowedOrderTypes: config.allowedOrderTypes || [],
            blockedOrderTypes: config.blockedOrderTypes || [],
          };

          const newLine = `[SLAVE][${accountId}]${parts[2]}[ONLINE][${JSON.stringify(fullConfig)}]${parts[5]}[${Math.floor(Date.now() / 1000)}]`;
          csvLines[existingIndex] = newLine;
          log.success(`  Updated slave config: ${accountId}`);
        }
      }
    });
  }

  // 3. Escribir CSV unificado
  log.section('Writing Unified CSV');

  if (csvLines.length > 0) {
    writeFileSync(paths.csvUnified, csvLines.join('\n') + '\n', 'utf8');
    log.success(`Written ${csvLines.length} lines to ${paths.csvUnified}`);
  } else {
    log.warning('No data to migrate');
  }

  // 4. Preguntar si eliminar archivos JSON
  log.section('Cleanup Old JSON Files');
  log.warning('The following JSON files can now be deleted:');
  log.info(`  - ${paths.registeredAccounts}`);
  log.info(`  - ${paths.slaveConfigurations}`);
  log.info(`  - ${paths.copierStatus}`);
  log.info(`  - ${paths.copierStatusBackup}`);
  log.info(`  - ${paths.tradingTransformations}`);

  // Crear backups antes de eliminar
  const backupDir = join(process.cwd(), 'backups', new Date().toISOString().split('T')[0]);
  if (!existsSync(backupDir)) {
    const fs = await import('fs');
    fs.mkdirSync(backupDir, { recursive: true });
  }

  Object.entries(paths).forEach(([name, path]) => {
    if (existsSync(path) && name !== 'csvUnified') {
      const backupPath = join(backupDir, `${name}.backup.json`);
      const fs = require('fs');
      fs.copyFileSync(path, backupPath);
      log.success(`  Backed up ${name} to ${backupPath}`);
    }
  });

  log.section('Migration Complete');
  log.success('All data has been migrated to the unified CSV format');
  log.info('The system now uses only the CSV file for all account data');
  log.info('JSON files have been backed up and can be manually deleted');
}

// Ejecutar migración
migrateToUnifiedCSV().catch(console.error);
