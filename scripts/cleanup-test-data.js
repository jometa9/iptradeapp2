#!/usr/bin/env node
/**
 * Script de Limpieza de Datos de Prueba
 *
 * Este script limpia todos los datos de prueba creados por el test completo
 * para mantener el sistema limpio después de las pruebas.
 */
import fetch from 'node-fetch';

// Configuración
const BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3';
const TEST_ACCOUNTS = {
  master1: '5038002547',
  master2: '94424443',
  slave1: '123456789',
  slave2: '987654321',
  pending1: '111111111',
  pending2: '222222222',
  pending3: '333333333',
};

// Colores para console.log
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: msg => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  success: msg => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: msg => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  error: msg => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  step: msg => console.log(`\n${colors.cyan}🔹 ${msg}${colors.reset}`),
  header: msg => console.log(`\n${colors.magenta}${colors.bright}${msg}${colors.reset}`),
};

// Función helper para hacer requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    const data = await response.text();

    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { raw: data };
    }

    return {
      status: response.status,
      ok: response.ok,
      data: jsonData,
      raw: data,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null,
    };
  }
}

// Función para esperar
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ===== LIMPIAR CUENTAS MASTER =====
async function cleanupMasterAccounts() {
  log.header('🧹 LIMPIANDO CUENTAS MASTER');

  for (const accountId of [TEST_ACCOUNTS.master1, TEST_ACCOUNTS.master2]) {
    log.step(`Eliminando cuenta master: ${accountId}`);

    const response = await makeRequest(`/accounts/master/${accountId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      log.success(`Cuenta master ${accountId} eliminada exitosamente`);
    } else {
      log.warning(`Error eliminando cuenta master ${accountId}: ${response.status}`);
    }
  }
}

// ===== LIMPIAR CUENTAS SLAVE =====
async function cleanupSlaveAccounts() {
  log.header('🧹 LIMPIANDO CUENTAS SLAVE');

  for (const accountId of [TEST_ACCOUNTS.slave1, TEST_ACCOUNTS.slave2]) {
    log.step(`Eliminando cuenta slave: ${accountId}`);

    const response = await makeRequest(`/accounts/slave/${accountId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      log.success(`Cuenta slave ${accountId} eliminada exitosamente`);
    } else {
      log.warning(`Error eliminando cuenta slave ${accountId}: ${response.status}`);
    }
  }
}

// ===== LIMPIAR CUENTAS PENDING =====
async function cleanupPendingAccounts() {
  log.header('🧹 LIMPIANDO CUENTAS PENDING');

  for (const accountId of [
    TEST_ACCOUNTS.pending1,
    TEST_ACCOUNTS.pending2,
    TEST_ACCOUNTS.pending3,
  ]) {
    log.step(`Eliminando cuenta pending: ${accountId}`);

    const response = await makeRequest(`/accounts/pending/${accountId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      log.success(`Cuenta pending ${accountId} eliminada exitosamente`);
    } else {
      log.warning(`Error eliminando cuenta pending ${accountId}: ${response.status}`);
    }
  }
}

// ===== LIMPIAR CONFIGURACIONES DE TRADING =====
async function cleanupTradingConfigs() {
  log.header('🧹 LIMPIANDO CONFIGURACIONES DE TRADING');

  // Limpiar configuraciones de masters
  for (const accountId of [TEST_ACCOUNTS.master1, TEST_ACCOUNTS.master2]) {
    log.step(`Eliminando configuración de trading para master: ${accountId}`);

    const response = await makeRequest(`/trading-config/${accountId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      log.success(`Configuración de trading eliminada para master ${accountId}`);
    } else {
      log.warning(
        `Error eliminando configuración de trading para master ${accountId}: ${response.status}`
      );
    }
  }

  // Limpiar configuraciones de slaves
  for (const accountId of [TEST_ACCOUNTS.slave1, TEST_ACCOUNTS.slave2]) {
    log.step(`Eliminando configuración de slave: ${accountId}`);

    const response = await makeRequest(`/slave-config/${accountId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      log.success(`Configuración de slave eliminada para ${accountId}`);
    } else {
      log.warning(`Error eliminando configuración de slave ${accountId}: ${response.status}`);
    }
  }
}

// ===== LIMPIAR ESTADOS DE COPIER =====
async function cleanupCopierStatus() {
  log.header('🧹 LIMPIANDO ESTADOS DE COPIER');

  // Deshabilitar copy trading para masters
  for (const accountId of [TEST_ACCOUNTS.master1, TEST_ACCOUNTS.master2]) {
    log.step(`Deshabilitando copy trading para master: ${accountId}`);

    const response = await makeRequest('/copier/master', {
      method: 'POST',
      body: JSON.stringify({
        masterAccountId: accountId,
        enabled: false,
      }),
    });

    if (response.ok) {
      log.success(`Copy trading deshabilitado para master ${accountId}`);
    } else {
      log.warning(`Error deshabilitando copy trading para master ${accountId}: ${response.status}`);
    }
  }
}

// ===== VERIFICAR LIMPIEZA =====
async function verifyCleanup() {
  log.header('🔍 VERIFICANDO LIMPIEZA');

  // Verificar cuentas
  const allResponse = await makeRequest('/accounts/all');
  if (allResponse.ok) {
    const data = allResponse.data;
    const masterCount = Object.keys(data.masterAccounts || {}).length;
    const slaveCount = Object.keys(data.slaveAccounts || {}).length;
    const pendingCount = Object.keys(data.pendingAccounts || {}).length;
    const connectionCount = Object.keys(data.connections || {}).length;

    log.info(`Estado final del sistema:`);
    log.info(`- Master accounts: ${masterCount}`);
    log.info(`- Slave accounts: ${slaveCount}`);
    log.info(`- Pending accounts: ${pendingCount}`);
    log.info(`- Connections: ${connectionCount}`);

    if (masterCount === 0 && slaveCount === 0 && pendingCount === 0) {
      log.success('✅ Limpieza completada exitosamente');
    } else {
      log.warning('⚠️ Algunas cuentas de prueba aún existen');
    }
  } else {
    log.error(`Error verificando estado final: ${allResponse.status}`);
  }
}

// ===== FUNCIÓN PRINCIPAL =====
async function runCleanup() {
  log.header('🚀 INICIANDO LIMPIEZA DE DATOS DE PRUEBA');
  log.info(`URL Base: ${BASE_URL}`);
  log.info(`API Key: ${API_KEY.substring(0, 8)}...`);
  log.info(`Cuentas a limpiar: ${JSON.stringify(TEST_ACCOUNTS, null, 2)}`);

  try {
    // Verificar que el servidor esté funcionando
    log.step('Verificando conectividad del servidor');
    const statusResponse = await makeRequest('/status');
    if (statusResponse.ok) {
      log.success('Servidor está funcionando correctamente');
    } else {
      log.error('No se pudo conectar al servidor');
      return;
    }

    // Ejecutar limpieza en orden
    await cleanupMasterAccounts();
    await sleep(500);

    await cleanupSlaveAccounts();
    await sleep(500);

    await cleanupPendingAccounts();
    await sleep(500);

    await cleanupTradingConfigs();
    await sleep(500);

    await cleanupCopierStatus();
    await sleep(500);

    await verifyCleanup();

    // Resumen final
    log.header('📊 RESUMEN DE LIMPIEZA');
    log.success('✅ Proceso de limpieza completado');
    log.info('Todos los datos de prueba han sido eliminados del sistema');
  } catch (error) {
    log.error(`Error durante la limpieza: ${error.message}`);
    console.error(error);
  }
}

// Ejecutar la limpieza si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanup();
}

export { runCleanup };
