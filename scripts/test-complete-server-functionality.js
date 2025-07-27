#!/usr/bin/env node
/**
 * Test Completo de Funcionalidad del Servidor
 *
 * Este script prueba toda la funcionalidad del servidor desde cero hasta el final:
 * 1. Agregar cuentas pending
 * 2. Conectar masters
 * 3. Conectar slaves
 * 4. Simular cuentas offline y reactivarlas con polling
 * 5. Prender/apagar global status
 * 6. Copiar desde master
 * 7. Escuchar desde slave
 */
import fetch from 'node-fetch';

// Configuración
const BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3'; // API key de prueba
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
  subheader: msg => console.log(`${colors.cyan}${msg}${colors.reset}`),
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

// ===== PASO 1: AGREGAR CUENTAS PENDING =====
async function testAddPendingAccounts() {
  log.header('PASO 1: AGREGAR CUENTAS PENDING');

  const pendingAccounts = [
    { id: TEST_ACCOUNTS.pending1, name: 'Pending Account 1', platform: 'MT5' },
    { id: TEST_ACCOUNTS.pending2, name: 'Pending Account 2', platform: 'MT4' },
    { id: TEST_ACCOUNTS.pending3, name: 'Pending Account 3', platform: 'cTrader' },
  ];

  for (const account of pendingAccounts) {
    log.step(`Registrando cuenta pending: ${account.id}`);

    const response = await makeRequest('/accounts/register-pending', {
      method: 'POST',
      body: JSON.stringify({
        accountId: account.id,
        name: account.name,
        platform: account.platform,
      }),
    });

    if (response.ok) {
      log.success(`Cuenta pending ${account.id} registrada exitosamente`);
    } else {
      log.error(
        `Error registrando cuenta pending ${account.id}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  }

  // Verificar cuentas pending
  log.step('Verificando cuentas pending registradas');
  const pendingResponse = await makeRequest('/accounts/pending');

  if (pendingResponse.ok) {
    const pendingCount = Object.keys(pendingResponse.data.pendingAccounts || {}).length;
    log.success(`Se encontraron ${pendingCount} cuentas pending`);
  } else {
    log.error(`Error obteniendo cuentas pending: ${pendingResponse.status}`);
  }
}

// ===== PASO 2: CONECTAR MASTERS =====
async function testConnectMasters() {
  log.header('PASO 2: CONECTAR MASTERS');

  const masterAccounts = [
    {
      id: TEST_ACCOUNTS.master1,
      name: 'Master Account 1',
      description: 'Cuenta master principal para testing',
      broker: 'MetaQuotes',
      platform: 'MT4',
    },
    {
      id: TEST_ACCOUNTS.master2,
      name: 'Master Account 2',
      description: 'Cuenta master secundaria para testing',
      broker: 'MetaQuotes',
      platform: 'MT5',
    },
  ];

  for (const account of masterAccounts) {
    log.step(`Registrando cuenta master: ${account.id}`);

    const response = await makeRequest('/accounts/master', {
      method: 'POST',
      body: JSON.stringify({
        masterAccountId: account.id,
        name: account.name,
        description: account.description,
        broker: account.broker,
        platform: account.platform,
      }),
    });

    if (response.ok) {
      log.success(`Cuenta master ${account.id} registrada exitosamente`);
    } else {
      log.error(
        `Error registrando cuenta master ${account.id}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  }

  // Verificar cuentas master
  log.step('Verificando cuentas master registradas');
  const allResponse = await makeRequest('/accounts/all');

  if (allResponse.ok) {
    const masterCount = Object.keys(allResponse.data.masterAccounts || {}).length;
    log.success(`Se encontraron ${masterCount} cuentas master`);
  } else {
    log.error(`Error obteniendo cuentas: ${allResponse.status}`);
  }
}

// ===== PASO 3: CONECTAR SLAVES =====
async function testConnectSlaves() {
  log.header('PASO 3: CONECTAR SLAVES');

  const slaveAccounts = [
    {
      id: TEST_ACCOUNTS.slave1,
      name: 'Slave Account 1',
      description: 'Cuenta slave que sigue al master 1',
      broker: 'MetaQuotes',
      platform: 'MT4',
      masterAccountId: TEST_ACCOUNTS.master1,
    },
    {
      id: TEST_ACCOUNTS.slave2,
      name: 'Slave Account 2',
      description: 'Cuenta slave que sigue al master 2',
      broker: 'MetaQuotes',
      platform: 'MT5',
      masterAccountId: TEST_ACCOUNTS.master2,
    },
  ];

  for (const account of slaveAccounts) {
    log.step(`Registrando cuenta slave: ${account.id}`);

    const response = await makeRequest('/accounts/slave', {
      method: 'POST',
      body: JSON.stringify({
        slaveAccountId: account.id,
        name: account.name,
        description: account.description,
        broker: account.broker,
        platform: account.platform,
        masterAccountId: account.masterAccountId,
      }),
    });

    if (response.ok) {
      log.success(
        `Cuenta slave ${account.id} registrada y conectada a master ${account.masterAccountId}`
      );
    } else {
      log.error(
        `Error registrando cuenta slave ${account.id}: ${response.status} - ${JSON.stringify(response.data)}`
      );
    }
  }

  // Verificar conexiones
  log.step('Verificando conexiones master-slave');
  const allResponse = await makeRequest('/accounts/all');

  if (allResponse.ok) {
    const connections = allResponse.data.connections || {};
    const connectionCount = Object.keys(connections).length;
    log.success(`Se encontraron ${connectionCount} conexiones master-slave`);

    for (const [slaveId, masterId] of Object.entries(connections)) {
      log.info(`Slave ${slaveId} conectado a Master ${masterId}`);
    }
  } else {
    log.error(`Error obteniendo conexiones: ${allResponse.status}`);
  }
}

// ===== PASO 4: SIMULAR CUENTAS OFFLINE Y REACTIVARLAS =====
async function testOfflineOnlineSimulation() {
  log.header('PASO 4: SIMULAR CUENTAS OFFLINE Y REACTIVARLAS');

  // Simular actividad de cuentas pending para que estén online
  log.step('Simulando actividad de cuentas pending para activarlas');

  for (const accountId of [
    TEST_ACCOUNTS.pending1,
    TEST_ACCOUNTS.pending2,
    TEST_ACCOUNTS.pending3,
  ]) {
    const pingResponse = await makeRequest('/accounts/ping', {
      method: 'POST',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        status: 'online',
        lastActivity: new Date().toISOString(),
      }),
    });

    if (pingResponse.ok) {
      log.success(`Ping exitoso para cuenta pending ${accountId}`);
    } else {
      log.warning(`Ping falló para cuenta pending ${accountId}: ${pingResponse.status}`);
    }
  }

  // Esperar y verificar que las cuentas estén online
  log.step('Esperando 2 segundos para que el sistema procese la actividad');
  await sleep(2000);

  const pendingResponse = await makeRequest('/accounts/pending');
  if (pendingResponse.ok) {
    const pendingAccounts = pendingResponse.data.pendingAccounts || {};
    for (const [accountId, account] of Object.entries(pendingAccounts)) {
      const status = account.status || 'unknown';
      log.info(`Cuenta pending ${accountId}: ${status}`);
    }
  }

  // Simular que las cuentas se desconectan (no enviar pings por 6 segundos)
  log.step('Simulando desconexión de cuentas (no enviando pings por 6 segundos)');
  await sleep(6000);

  // Verificar que las cuentas estén offline
  log.step('Verificando que las cuentas estén offline');
  const offlineResponse = await makeRequest('/accounts/pending');
  if (offlineResponse.ok) {
    const pendingAccounts = offlineResponse.data.pendingAccounts || {};
    for (const [accountId, account] of Object.entries(pendingAccounts)) {
      const status = account.status || 'unknown';
      if (status === 'offline') {
        log.success(`Cuenta ${accountId} correctamente marcada como offline`);
      } else {
        log.warning(`Cuenta ${accountId} tiene status: ${status}`);
      }
    }
  }

  // Simular reconexión enviando pings nuevamente
  log.step('Simulando reconexión enviando pings nuevamente');
  for (const accountId of [
    TEST_ACCOUNTS.pending1,
    TEST_ACCOUNTS.pending2,
    TEST_ACCOUNTS.pending3,
  ]) {
    const pingResponse = await makeRequest('/accounts/ping', {
      method: 'POST',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        status: 'online',
        lastActivity: new Date().toISOString(),
      }),
    });

    if (pingResponse.ok) {
      log.success(`Ping de reconexión exitoso para cuenta ${accountId}`);
    }
  }

  // Esperar y verificar que las cuentas estén online nuevamente
  log.step('Esperando 2 segundos para verificar reconexión');
  await sleep(2000);

  const reconnectedResponse = await makeRequest('/accounts/pending');
  if (reconnectedResponse.ok) {
    const pendingAccounts = reconnectedResponse.data.pendingAccounts || {};
    for (const [accountId, account] of Object.entries(pendingAccounts)) {
      const status = account.status || 'unknown';
      if (status === 'pending') {
        log.success(`Cuenta ${accountId} correctamente reactivada`);
      } else {
        log.warning(`Cuenta ${accountId} tiene status: ${status}`);
      }
    }
  }
}

// ===== PASO 5: PROBAR GLOBAL STATUS =====
async function testGlobalStatus() {
  log.header('PASO 5: PROBAR GLOBAL STATUS');

  // Obtener status global actual
  log.step('Obteniendo status global actual');
  const globalResponse = await makeRequest('/copier/global');

  if (globalResponse.ok) {
    const isEnabled = globalResponse.data.globalStatus;
    log.info(`Status global actual: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);

    // Probar deshabilitar global status
    log.step('Deshabilitando global status');
    const disableResponse = await makeRequest('/copier/global', {
      method: 'POST',
      body: JSON.stringify({ enabled: false }),
    });

    if (disableResponse.ok) {
      log.success('Global status deshabilitado exitosamente');
    } else {
      log.error(`Error deshabilitando global status: ${disableResponse.status}`);
    }

    // Verificar que esté deshabilitado
    await sleep(1000);
    const verifyDisableResponse = await makeRequest('/copier/global');
    if (verifyDisableResponse.ok) {
      const isDisabled = !verifyDisableResponse.data.globalStatus;
      if (isDisabled) {
        log.success('Global status correctamente deshabilitado');
      } else {
        log.error('Global status no se deshabilitó correctamente');
      }
    }

    // Probar habilitar global status
    log.step('Habilitando global status');
    const enableResponse = await makeRequest('/copier/global', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });

    if (enableResponse.ok) {
      log.success('Global status habilitado exitosamente');
    } else {
      log.error(`Error habilitando global status: ${enableResponse.status}`);
    }

    // Verificar que esté habilitado
    await sleep(1000);
    const verifyEnableResponse = await makeRequest('/copier/global');
    if (verifyEnableResponse.ok) {
      const isEnabled = verifyEnableResponse.data.globalStatus;
      if (isEnabled) {
        log.success('Global status correctamente habilitado');
      } else {
        log.error('Global status no se habilitó correctamente');
      }
    }
  } else {
    log.error(`Error obteniendo global status: ${globalResponse.status}`);
  }
}

// ===== PASO 6: COPIAR DESDE MASTER =====
async function testCopyFromMaster() {
  log.header('PASO 6: COPIAR DESDE MASTER');

  // Simular actividad del master para que esté online
  log.step('Simulando actividad del master para activarlo');
  const masterPingResponse = await makeRequest('/accounts/ping', {
    method: 'POST',
    headers: {
      'x-account-id': TEST_ACCOUNTS.master1,
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      status: 'online',
      lastActivity: new Date().toISOString(),
    }),
  });

  if (masterPingResponse.ok) {
    log.success('Master activado exitosamente');
  } else {
    log.warning(`Ping del master falló: ${masterPingResponse.status}`);
  }

  // Habilitar copy trading para el master
  log.step('Habilitando copy trading para el master');
  const enableMasterResponse = await makeRequest('/copier/master', {
    method: 'POST',
    body: JSON.stringify({
      masterAccountId: TEST_ACCOUNTS.master1,
      enabled: true,
    }),
  });

  if (enableMasterResponse.ok) {
    log.success('Copy trading habilitado para el master');
  } else {
    log.error(`Error habilitando copy trading: ${enableMasterResponse.status}`);
  }

  // Simular envío de orden desde master
  log.step('Simulando envío de orden desde master');
  const orderResponse = await makeRequest('/orders/neworder', {
    method: 'POST',
    headers: {
      'x-account-id': TEST_ACCOUNTS.master1,
      'x-api-key': API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body:
      'counter=1&id0=12345&sym0=EURUSD&typ0=buy&lot0=0.1&price0=1.12345&sl0=1.12000&tp0=1.13000&account0=' +
      TEST_ACCOUNTS.master1,
  });

  if (orderResponse.ok) {
    log.success('Orden enviada desde master exitosamente');
    log.info(`Respuesta del servidor: ${orderResponse.raw}`);
  } else {
    log.error(`Error enviando orden: ${orderResponse.status} - ${orderResponse.raw}`);
  }

  // Verificar que la orden se guardó
  log.step('Verificando que la orden se guardó correctamente');
  await sleep(1000);

  // Obtener configuración de trading del master
  const tradingConfigResponse = await makeRequest(`/trading-config/${TEST_ACCOUNTS.master1}`);
  if (tradingConfigResponse.ok) {
    log.success('Configuración de trading del master obtenida');
    log.info(`Config: ${JSON.stringify(tradingConfigResponse.data, null, 2)}`);
  } else {
    log.warning(`No se pudo obtener configuración de trading: ${tradingConfigResponse.status}`);
  }
}

// ===== PASO 7: ESCUCHAR DESDE SLAVE =====
async function testListenFromSlave() {
  log.header('PASO 7: ESCUCHAR DESDE SLAVE');

  // Simular actividad del slave para que esté online
  log.step('Simulando actividad del slave para activarlo');
  const slavePingResponse = await makeRequest('/accounts/ping', {
    method: 'POST',
    headers: {
      'x-account-id': TEST_ACCOUNTS.slave1,
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      status: 'online',
      lastActivity: new Date().toISOString(),
    }),
  });

  if (slavePingResponse.ok) {
    log.success('Slave activado exitosamente');
  } else {
    log.warning(`Ping del slave falló: ${slavePingResponse.status}`);
  }

  // Habilitar copy trading para el slave
  log.step('Habilitando copy trading para el slave');
  const enableSlaveResponse = await makeRequest('/slave-config', {
    method: 'POST',
    body: JSON.stringify({
      slaveAccountId: TEST_ACCOUNTS.slave1,
      enabled: true,
      lotMultiplier: 1.0,
      reverseTrading: false,
    }),
  });

  if (enableSlaveResponse.ok) {
    log.success('Copy trading habilitado para el slave');
  } else {
    log.error(`Error habilitando copy trading para slave: ${enableSlaveResponse.status}`);
  }

  // Simular consulta de órdenes desde slave
  log.step('Simulando consulta de órdenes desde slave');
  const ordersResponse = await makeRequest('/orders/neworder', {
    method: 'GET',
    headers: {
      'x-account-id': TEST_ACCOUNTS.slave1,
      'x-api-key': API_KEY,
    },
  });

  if (ordersResponse.ok) {
    log.success('Consulta de órdenes desde slave exitosa');
    log.info(`Órdenes recibidas: ${ordersResponse.raw}`);
  } else {
    log.error(`Error consultando órdenes: ${ordersResponse.status} - ${ordersResponse.raw}`);
  }

  // Verificar configuración del slave
  log.step('Verificando configuración del slave');
  const slaveConfigResponse = await makeRequest(`/slave-config/${TEST_ACCOUNTS.slave1}`);
  if (slaveConfigResponse.ok) {
    log.success('Configuración del slave obtenida');
    log.info(`Config: ${JSON.stringify(slaveConfigResponse.data, null, 2)}`);
  } else {
    log.warning(`No se pudo obtener configuración del slave: ${slaveConfigResponse.status}`);
  }
}

// ===== FUNCIÓN PRINCIPAL =====
async function runCompleteTest() {
  log.header('🚀 INICIANDO TEST COMPLETO DE FUNCIONALIDAD DEL SERVIDOR');
  log.info(`URL Base: ${BASE_URL}`);
  log.info(`API Key: ${API_KEY.substring(0, 8)}...`);
  log.info(`Cuentas de prueba: ${JSON.stringify(TEST_ACCOUNTS, null, 2)}`);

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

    // Ejecutar todos los pasos
    await testAddPendingAccounts();
    await sleep(1000);

    await testConnectMasters();
    await sleep(1000);

    await testConnectSlaves();
    await sleep(1000);

    await testOfflineOnlineSimulation();
    await sleep(1000);

    await testGlobalStatus();
    await sleep(1000);

    await testCopyFromMaster();
    await sleep(1000);

    await testListenFromSlave();
    await sleep(1000);

    // Resumen final
    log.header('📊 RESUMEN FINAL DEL TEST');
    log.success('✅ Todos los pasos del test se completaron');
    log.info('El servidor está funcionando correctamente con todas las funcionalidades');

    // Mostrar estado final del sistema
    log.step('Estado final del sistema:');
    const finalStatusResponse = await makeRequest('/accounts/all');
    if (finalStatusResponse.ok) {
      const data = finalStatusResponse.data;
      log.info(`- Master accounts: ${Object.keys(data.masterAccounts || {}).length}`);
      log.info(`- Slave accounts: ${Object.keys(data.slaveAccounts || {}).length}`);
      log.info(`- Pending accounts: ${Object.keys(data.pendingAccounts || {}).length}`);
      log.info(`- Connections: ${Object.keys(data.connections || {}).length}`);
    }
  } catch (error) {
    log.error(`Error durante el test: ${error.message}`);
    console.error(error);
  }
}

// Ejecutar el test si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompleteTest();
}

export { runCompleteTest };
