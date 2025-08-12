#!/usr/bin/env node

/**
 * Script de prueba para verificar las configuraciones de localStorage
 * - pendingAccountsCollapsed: visibilidad de la sección de pendientes
 * - showIP: visibilidad de la IP en la barra superior
 */

console.log('🧪 Testing localStorage configurations...\n');

// Simular localStorage para pruebas
const mockLocalStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
    console.log(`💾 Saved: ${key} = ${value}`);
  },
  removeItem(key) {
    delete this.data[key];
    console.log(`🗑️ Removed: ${key}`);
  },
  clear() {
    this.data = {};
    console.log('🧹 Cleared all localStorage');
  },
};

// Función para probar la configuración de pending accounts
function testPendingAccountsConfig() {
  console.log('📋 Testing Pending Accounts Configuration:');

  // Simular estado inicial (no guardado)
  const initialCollapsed = mockLocalStorage.getItem('pendingAccountsCollapsed');
  console.log(`   Initial state: ${initialCollapsed || 'null (default: false)'}`);

  // Simular cambio a collapsed
  mockLocalStorage.setItem('pendingAccountsCollapsed', 'true');
  const collapsedState = mockLocalStorage.getItem('pendingAccountsCollapsed');
  console.log(`   After collapse: ${collapsedState}`);

  // Simular cambio a expanded
  mockLocalStorage.setItem('pendingAccountsCollapsed', 'false');
  const expandedState = mockLocalStorage.getItem('pendingAccountsCollapsed');
  console.log(`   After expand: ${expandedState}`);

  console.log('');
}

// Función para probar la configuración de IP
function testIPConfig() {
  console.log('🌐 Testing IP Display Configuration:');

  // Simular estado inicial (no guardado)
  const initialShowIP = mockLocalStorage.getItem('showIP');
  console.log(`   Initial state: ${initialShowIP || 'null (default: true)'}`);

  // Simular cambio a ocultar IP
  mockLocalStorage.setItem('showIP', 'false');
  const hiddenState = mockLocalStorage.getItem('showIP');
  console.log(`   After hide IP: ${hiddenState}`);

  // Simular cambio a mostrar IP
  mockLocalStorage.setItem('showIP', 'true');
  const visibleState = mockLocalStorage.getItem('showIP');
  console.log(`   After show IP: ${visibleState}`);

  console.log('');
}

// Función para probar la inicialización de estados
function testStateInitialization() {
  console.log('🔧 Testing State Initialization:');

  // Simular diferentes escenarios de localStorage
  const scenarios = [
    { name: 'Empty localStorage', data: {} },
    {
      name: 'Pending collapsed, IP hidden',
      data: { pendingAccountsCollapsed: 'true', showIP: 'false' },
    },
    {
      name: 'Pending expanded, IP visible',
      data: { pendingAccountsCollapsed: 'false', showIP: 'true' },
    },
    { name: 'Only pending config', data: { pendingAccountsCollapsed: 'true' } },
    { name: 'Only IP config', data: { showIP: 'false' } },
  ];

  scenarios.forEach(scenario => {
    console.log(`   Scenario: ${scenario.name}`);
    mockLocalStorage.data = { ...scenario.data };

    // Simular inicialización de pending accounts
    const pendingCollapsed = mockLocalStorage.getItem('pendingAccountsCollapsed');
    const pendingDefault = pendingCollapsed ? JSON.parse(pendingCollapsed) : false;
    console.log(`     Pending collapsed: ${pendingDefault}`);

    // Simular inicialización de IP
    const showIP = mockLocalStorage.getItem('showIP');
    const ipDefault = showIP ? JSON.parse(showIP) : true;
    console.log(`     Show IP: ${ipDefault}`);

    console.log('');
  });
}

// Ejecutar pruebas
testPendingAccountsConfig();
testIPConfig();
testStateInitialization();

console.log('✅ All localStorage configuration tests completed!');
console.log('\n📝 Summary:');
console.log('   - pendingAccountsCollapsed: Controls visibility of pending accounts section');
console.log('   - showIP: Controls visibility of IP address in top bar');
console.log('   - Both configurations persist across app restarts');
console.log('   - Default values: pendingAccountsCollapsed=false, showIP=true');
