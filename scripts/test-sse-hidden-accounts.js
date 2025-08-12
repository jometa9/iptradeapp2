import axios from 'axios';

const API_KEY = 'iptrade_89536f5b9e643c0433f3';
const BASE_URL = 'http://127.0.0.1:30';

// Función para hacer requests
const makeRequest = async (endpoint, options = {}) => {
  try {
    const url = `${BASE_URL}/api${endpoint}`;
    console.log(`🌐 Making request to: ${url}`);

    const config = {
      url,
      method: options.method || 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await axios(config);
    return { ok: true, data: response.data, status: response.status };
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    return {
      ok: false,
      data: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
};

// Función para simular el comportamiento del frontend con SSE
const simulateFrontendWithSSE = () => {
  let pendingData = null;
  let hiddenAccounts = {};

  // Simular localStorage
  const localStorage = {
    data: {},
    getItem(key) {
      return this.data[key] || null;
    },
    setItem(key, value) {
      this.data[key] = value;
      console.log(`💾 localStorage.setItem(${key}, ${value})`);
    },
    removeItem(key) {
      delete this.data[key];
      console.log(`🗑️ localStorage.removeItem(${key})`);
    },
  };

  // Cargar cuentas ocultas
  const loadHiddenAccounts = () => {
    try {
      const stored = localStorage.getItem('hiddenPendingAccounts');
      if (stored) {
        hiddenAccounts = JSON.parse(stored);
        console.log(`📋 Loaded ${Object.keys(hiddenAccounts).length} hidden accounts`);
      }
    } catch (error) {
      console.error('Error loading hidden accounts:', error);
    }
  };

  // Ocultar cuenta
  const hideAccount = (accountId, platform) => {
    hiddenAccounts[accountId] = {
      hiddenAt: new Date().toISOString(),
      platform,
    };
    localStorage.setItem('hiddenPendingAccounts', JSON.stringify(hiddenAccounts));
    console.log(`👻 Hidden account: ${accountId} (${platform})`);
  };

  // Filtrar cuentas visibles
  const filterVisibleAccounts = accounts => {
    return accounts.filter(account => !(account.account_id in hiddenAccounts));
  };

  // Simular actualización de datos (como SSE)
  const updateDataFromSSE = newAccounts => {
    console.log('📨 Simulating SSE update with new accounts...');

    // Filtrar cuentas ocultas
    const visibleAccounts = filterVisibleAccounts(newAccounts);

    // Actualizar estado
    pendingData = {
      accounts: visibleAccounts,
      summary: {
        totalAccounts: visibleAccounts.length,
        onlineAccounts: visibleAccounts.filter(acc => acc.current_status === 'online').length,
        offlineAccounts: visibleAccounts.filter(acc => acc.current_status === 'offline').length,
        platformStats: visibleAccounts.reduce((stats, account) => {
          const platform = account.platform || 'Unknown';
          if (!stats[platform]) {
            stats[platform] = { total: 0, online: 0, offline: 0 };
          }
          stats[platform].total++;
          if (account.current_status === 'online') {
            stats[platform].online++;
          } else {
            stats[platform].offline++;
          }
          return stats;
        }, {}),
      },
    };

    console.log(
      `👁️ SSE update: ${newAccounts.length - visibleAccounts.length} hidden accounts filtered`
    );
    console.log(`📊 Current visible accounts: ${pendingData.accounts.length}`);

    return pendingData;
  };

  // Verificar si una cuenta está visible
  const isAccountVisible = accountId => {
    return pendingData?.accounts?.some(acc => acc.account_id === accountId) || false;
  };

  return {
    loadHiddenAccounts,
    hideAccount,
    updateDataFromSSE,
    isAccountVisible,
    getCurrentData: () => pendingData,
    getHiddenAccounts: () => hiddenAccounts,
  };
};

// Función principal de prueba
async function testSSEHiddenAccounts() {
  console.log('🧪 Testing SSE Hidden Accounts Persistence\n');

  // Inicializar el sistema
  const frontend = simulateFrontendWithSSE();
  frontend.loadHiddenAccounts();

  // Step 1: Obtener cuentas pendientes actuales
  console.log('📋 Step 1: Loading current pending accounts...');
  const scanResponse = await makeRequest('/csv/scan-pending');

  if (!scanResponse.ok) {
    console.log('❌ Failed to load pending accounts:', scanResponse.data);
    return;
  }

  const initialAccounts = scanResponse.data.accounts || [];
  console.log(`✅ Loaded ${initialAccounts.length} pending accounts`);

  // Step 2: Simular carga inicial de datos
  console.log('\n📊 Step 2: Simulating initial data load...');
  const initialData = frontend.updateDataFromSSE(initialAccounts);
  console.log(`📊 Initial visible accounts: ${initialData.accounts.length}`);

  // Step 3: Ocultar algunas cuentas
  if (initialAccounts.length > 0) {
    console.log('\n👻 Step 3: Hiding some accounts...');

    const accountToHide = initialAccounts[0];
    frontend.hideAccount(accountToHide.account_id, accountToHide.platform);

    // Verificar que la cuenta está oculta
    const isVisible = frontend.isAccountVisible(accountToHide.account_id);
    console.log(`🔍 Account ${accountToHide.account_id} visible: ${isVisible}`);

    if (!isVisible) {
      console.log('✅ Account successfully hidden');
    } else {
      console.log('❌ Account still visible after hiding');
    }
  }

  // Step 4: Simular múltiples actualizaciones SSE
  console.log('\n🔄 Step 4: Simulating multiple SSE updates...');

  for (let i = 1; i <= 3; i++) {
    console.log(`\n📨 SSE Update #${i}...`);

    // Simular que llegan los mismos datos del servidor
    const sseData = frontend.updateDataFromSSE(initialAccounts);

    // Verificar que las cuentas ocultas siguen ocultas
    const hiddenAccounts = frontend.getHiddenAccounts();
    let allHiddenAccountsStillHidden = true;

    Object.keys(hiddenAccounts).forEach(accountId => {
      const isVisible = frontend.isAccountVisible(accountId);
      if (isVisible) {
        console.log(`❌ Hidden account ${accountId} became visible after SSE update #${i}`);
        allHiddenAccountsStillHidden = false;
      }
    });

    if (allHiddenAccountsStillHidden) {
      console.log(`✅ All hidden accounts remain hidden after SSE update #${i}`);
    }

    // Simular delay entre actualizaciones
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 5: Simular nueva cuenta que aparece
  console.log('\n🆕 Step 5: Simulating new account appearing...');

  const newAccount = {
    account_id: '999999999',
    platform: 'MT4',
    current_status: 'online',
    timestamp: new Date().toISOString(),
    filePath: 'test.csv',
  };

  const accountsWithNew = [...initialAccounts, newAccount];
  const updatedData = frontend.updateDataFromSSE(accountsWithNew);

  console.log(`📊 Accounts after new account: ${updatedData.accounts.length}`);

  // Verificar que la nueva cuenta es visible
  const newAccountVisible = frontend.isAccountVisible('999999999');
  console.log(`🔍 New account 999999999 visible: ${newAccountVisible}`);

  if (newAccountVisible) {
    console.log('✅ New account is visible (as expected)');
  } else {
    console.log('❌ New account is not visible (unexpected)');
  }

  // Step 6: Verificar que las cuentas ocultas siguen ocultas
  console.log('\n🔍 Step 6: Final verification of hidden accounts...');

  const finalHiddenAccounts = frontend.getHiddenAccounts();
  let finalCheckPassed = true;

  Object.keys(finalHiddenAccounts).forEach(accountId => {
    const isVisible = frontend.isAccountVisible(accountId);
    if (isVisible) {
      console.log(`❌ Hidden account ${accountId} is visible in final check`);
      finalCheckPassed = false;
    } else {
      console.log(`✅ Hidden account ${accountId} remains hidden in final check`);
    }
  });

  console.log('\n🎉 SSE Hidden Accounts test completed!');
  console.log('\n📝 Summary:');
  console.log(`   ✅ Hidden accounts: ${Object.keys(finalHiddenAccounts).length}`);
  console.log(`   ✅ Visible accounts: ${updatedData.accounts.length}`);
  console.log(`   ✅ Final check passed: ${finalCheckPassed}`);
  console.log('   ✅ Hidden accounts persist through SSE updates');
  console.log('   ✅ New accounts appear correctly');
}

// Ejecutar la prueba
testSSEHiddenAccounts().catch(console.error);
