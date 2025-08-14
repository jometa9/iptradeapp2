#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import fetch from 'node-fetch';
import { join } from 'path';

const API_BASE = 'http://localhost:3000/api/csv';
const CSV_PATH = join(process.cwd(), 'csv_data', 'IPTRADECSV_UNIFIED.csv');

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

// Leer contenido del CSV
function readCSV() {
  if (!existsSync(CSV_PATH)) {
    log.warning('CSV file does not exist yet');
    return [];
  }

  const content = readFileSync(CSV_PATH, 'utf8');
  log.info(`CSV Content:\n${content}`);
  return content.split('\n').filter(line => line.trim());
}

// Test principal
async function runTests() {
  log.section('Testing Unified CSV System');

  try {
    // 1. Mostrar estado inicial del CSV
    log.section('Initial CSV State');
    const initialLines = readCSV();
    log.info(`Total lines: ${initialLines.length}`);

    // 2. Obtener todas las cuentas
    log.section('Fetching All Accounts');
    const allAccountsRes = await fetch(`${API_BASE}/accounts/all`);
    const allAccounts = await allAccountsRes.json();

    if (allAccounts.success) {
      log.success('Fetched all accounts');
      log.info(`Master accounts: ${Object.keys(allAccounts.data.masterAccounts).length}`);
      log.info(`Pending accounts: ${allAccounts.data.pendingAccounts.length}`);
      log.info(`Unconnected slaves: ${allAccounts.data.unconnectedSlaves.length}`);

      // Mostrar detalles
      Object.entries(allAccounts.data.masterAccounts).forEach(([id, master]) => {
        log.info(
          `  Master ${id}: ${master.status} (${master.enabled ? 'enabled' : 'disabled'}) - ${master.totalSlaves} slaves`
        );
      });

      allAccounts.data.pendingAccounts.forEach(pending => {
        log.info(
          `  Pending ${pending.account_id}: ${pending.platform} - ${pending.current_status}`
        );
      });
    } else {
      log.error('Failed to fetch accounts: ' + allAccounts.error);
    }

    // 3. Obtener estadísticas
    log.section('Getting Statistics');
    const statsRes = await fetch(`${API_BASE}/statistics`);
    const stats = await statsRes.json();

    if (stats.success) {
      log.success('Got statistics');
      log.info(`Total accounts: ${stats.data.total}`);
      log.info(`Pending: ${stats.data.pending.total} (${stats.data.pending.online} online)`);
      log.info(`Masters: ${stats.data.master.total} (${stats.data.master.enabled} enabled)`);
      log.info(`Slaves: ${stats.data.slave.total} (${stats.data.slave.enabled} enabled)`);

      log.info('By platform:');
      Object.entries(stats.data.platforms).forEach(([platform, count]) => {
        log.info(`  ${platform}: ${count}`);
      });
    }

    // 4. Agregar una cuenta pending de prueba
    log.section('Adding Test Pending Account');
    const testAccountId = `TEST${Date.now()}`;
    const testLine = `[PENDING][${testAccountId}][MT4][ONLINE][{}][][${Math.floor(Date.now() / 1000)}]`;

    // Escribir directamente al CSV para simular un bot
    const fs = await import('fs');
    fs.appendFileSync(CSV_PATH, testLine + '\n');
    log.success(`Added test pending account: ${testAccountId}`);

    // Esperar un momento para que se detecte el cambio
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Verificar que la cuenta pending aparece
    log.section('Verifying Pending Account');
    const pendingRes = await fetch(`${API_BASE}/accounts/pending`);
    const pendingAccounts = await pendingRes.json();

    if (pendingAccounts.success) {
      const testAccount = pendingAccounts.data.find(acc => acc.account_id === testAccountId);
      if (testAccount) {
        log.success(`Found test pending account: ${testAccountId}`);
        log.info(`Status: ${testAccount.current_status}`);
      } else {
        log.error(`Test pending account not found: ${testAccountId}`);
      }
    }

    // 6. Convertir pending a master
    log.section('Converting Pending to Master');
    const convertRes = await fetch(`${API_BASE}/accounts/${testAccountId}/convert-to-master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Master Account' }),
    });

    const convertResult = await convertRes.json();
    if (convertResult.success) {
      log.success('Converted to master successfully');
    } else {
      log.error('Failed to convert: ' + convertResult.error);
    }

    // 7. Verificar conversión en el CSV
    log.section('Verifying Conversion in CSV');
    const updatedLines = readCSV();
    const masterLine = updatedLines.find(
      line => line.includes(testAccountId) && line.includes('[MASTER]')
    );

    if (masterLine) {
      log.success('Master account found in CSV');
      log.info(`Line: ${masterLine}`);
    } else {
      log.error('Master account not found in CSV');
    }

    // 8. Actualizar configuración del master
    log.section('Updating Master Configuration');
    const updateRes = await fetch(`${API_BASE}/accounts/master/${testAccountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        name: 'Updated Test Master',
      }),
    });

    const updateResult = await updateRes.json();
    if (updateResult.success) {
      log.success('Master configuration updated');
    } else {
      log.error('Failed to update: ' + updateResult.error);
    }

    // 9. Verificar estado del copier
    log.section('Checking Copier Status');
    const copierRes = await fetch(`${API_BASE}/copier/status`);
    const copierStatus = await copierRes.json();

    if (copierStatus.success) {
      log.success('Got copier status');
      log.info(`Global status: ${copierStatus.data.globalStatusText}`);
      log.info(`Total masters: ${copierStatus.data.totalMasterAccounts}`);

      Object.entries(copierStatus.data.masterAccounts).forEach(([id, status]) => {
        log.info(
          `  Master ${id}: ${status.masterStatus ? 'enabled' : 'disabled'} (${status.status})`
        );
      });
    }

    // 10. Eliminar cuenta de prueba
    log.section('Deleting Test Account');
    const deleteRes = await fetch(`${API_BASE}/accounts/${testAccountId}`, {
      method: 'DELETE',
    });

    const deleteResult = await deleteRes.json();
    if (deleteResult.success) {
      log.success('Test account deleted');
    } else {
      log.error('Failed to delete: ' + deleteResult.error);
    }

    // Verificar eliminación
    const finalLines = readCSV();
    const deletedLine = finalLines.find(line => line.includes(testAccountId));

    if (!deletedLine) {
      log.success('Account successfully removed from CSV');
    } else {
      log.error('Account still exists in CSV');
    }

    log.section('Test Complete');
    log.success('All tests completed');
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    console.error(error);
  }
}

// Ejecutar tests
log.info('Starting Unified CSV System Test...');
runTests().catch(console.error);
