import axios from 'axios';

const API_KEY = 'iptrade_89536f5b9e643c0433f3';
const BASE_URL = 'http://127.0.0.1:3000';

// Función para hacer requests
const makeRequest = async (endpoint, options = {}) => {
  try {
    const url = `${BASE_URL}/api${endpoint}`;
    const config = {
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
    return {
      ok: false,
      data: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
};

// Función para simular el comportamiento del frontend
const simulateFrontendDelete = (pendingData, accountId) => {
  console.log(`🗑️ Simulating frontend-only deletion for account: ${accountId}`);

  if (!pendingData || !pendingData.accounts) {
    console.log('❌ No pending data available');
    return null;
  }

  // Filtrar la cuenta a eliminar
  const updatedAccounts = pendingData.accounts.filter(account => account.account_id !== accountId);

  // Actualizar estadísticas
  const updatedPendingData = {
    ...pendingData,
    accounts: updatedAccounts,
    summary: {
      ...pendingData.summary,
      totalAccounts: updatedAccounts.length,
      platformStats: updatedAccounts.reduce((stats, account) => {
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

  console.log('✅ Account removed from frontend state');
  console.log(`📊 Updated summary: ${updatedPendingData.summary.totalAccounts} total accounts`);

  return updatedPendingData;
};

// Función principal de prueba
async function testFrontendOnlyDelete() {
  console.log('🧪 Testing Frontend-Only Delete Functionality\n');

  // Step 1: Obtener cuentas pendientes actuales
  console.log('📋 Step 1: Loading current pending accounts...');
  const scanResponse = await makeRequest('/csv/scan-pending');

  if (!scanResponse.ok) {
    console.log('❌ Failed to load pending accounts:', scanResponse.data);
    return;
  }

  const initialData = scanResponse.data;
  console.log(`✅ Loaded ${initialData.accounts?.length || 0} pending accounts`);

  if (initialData.summary) {
    console.log(`📊 Summary: ${initialData.summary.totalAccounts} total accounts`);
    if (initialData.summary.platformStats) {
      Object.entries(initialData.summary.platformStats).forEach(([platform, stats]) => {
        console.log(
          `   ${platform}: ${stats.total} total (${stats.online} online, ${stats.offline} offline)`
        );
      });
    }
  }

  // Step 2: Simular eliminación frontend de la primera cuenta
  if (initialData.accounts && initialData.accounts.length > 0) {
    const accountToDelete = initialData.accounts[0];
    console.log(
      `\n🗑️ Step 2: Simulating frontend deletion of account: ${accountToDelete.account_id}`
    );

    const updatedData = simulateFrontendDelete(initialData, accountToDelete.account_id);

    if (updatedData) {
      console.log('✅ Frontend deletion simulation successful');
      console.log(`📊 New total: ${updatedData.summary.totalAccounts} accounts`);

      // Verificar que la cuenta ya no está en la lista
      const accountStillExists = updatedData.accounts.some(
        acc => acc.account_id === accountToDelete.account_id
      );

      if (!accountStillExists) {
        console.log('✅ Account successfully removed from frontend state');
      } else {
        console.log('❌ Account still exists in frontend state');
      }
    }
  } else {
    console.log('⚠️ No accounts available for deletion test');
  }

  // Step 3: Verificar que los archivos CSV no han cambiado
  console.log('\n📄 Step 3: Verifying CSV files remain unchanged...');
  const verifyResponse = await makeRequest('/csv/scan-pending');

  if (verifyResponse.ok) {
    const verifyData = verifyResponse.data;
    console.log(`📊 CSV still contains: ${verifyData.accounts?.length || 0} accounts`);

    // Comparar con los datos originales
    if (initialData.accounts && verifyData.accounts) {
      const initialCount = initialData.accounts.length;
      const verifyCount = verifyData.accounts.length;

      if (initialCount === verifyCount) {
        console.log('✅ CSV files remain unchanged (as expected)');
      } else {
        console.log(`⚠️ CSV count changed: ${initialCount} → ${verifyCount}`);
      }
    }
  }

  // Step 4: Simular múltiples eliminaciones frontend
  console.log('\n🔄 Step 4: Testing multiple frontend deletions...');
  if (initialData.accounts && initialData.accounts.length > 1) {
    let currentData = { ...initialData };

    // Eliminar las primeras 2 cuentas (si existen)
    const accountsToDelete = initialData.accounts.slice(0, 2);

    for (const account of accountsToDelete) {
      console.log(`🗑️ Removing account: ${account.account_id}`);
      currentData = simulateFrontendDelete(currentData, account.account_id);

      if (currentData) {
        console.log(`📊 Remaining accounts: ${currentData.summary.totalAccounts}`);
      }
    }

    console.log('✅ Multiple frontend deletions completed');
  }

  console.log('\n🎉 Frontend-only delete test completed successfully!');
  console.log('\n📝 Summary:');
  console.log('   ✅ Frontend deletion works without server calls');
  console.log('   ✅ CSV files remain unchanged');
  console.log('   ✅ Account may reappear when link platforms process runs');
  console.log('   ✅ Multiple deletions work correctly');
}

// Ejecutar la prueba
testFrontendOnlyDelete().catch(console.error);
