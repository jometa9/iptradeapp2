#!/usr/bin/env node

console.log('🔧 Forcing SSE Pending Accounts Events\n');

async function forceSSEEvent() {
  try {
    const baseUrl = 'http://localhost:30';
    const apiKey = 'iptrade_6616c788f776a3b114f0';

    console.log('📤 Step 1: Forcing CSV refresh to trigger events...');

    // Forzar refresh de CSV data
    const refreshResponse = await fetch(`${baseUrl}/api/csv/refresh`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json();
      console.log('✅ CSV refresh response:', refreshData.message);
    }

    console.log('📤 Step 2: Getting current pending accounts...');

    // Obtener cuentas pendientes actuales
    const pendingResponse = await fetch(`${baseUrl}/api/accounts/pending`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json();
      console.log('✅ Current pending accounts:', {
        total: pendingData.totalPending,
        accounts: Object.keys(pendingData.pendingAccounts || {}),
      });
    }

    console.log('📤 Step 3: Forcing scan-pending to trigger SSE event...');

    // Forzar scan de pending accounts
    const scanResponse = await fetch(`${baseUrl}/api/csv/scan-pending`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (scanResponse.ok) {
      const scanData = await scanResponse.json();
      console.log('✅ Scan pending response:', {
        success: scanData.success,
        accountsFound: scanData.accounts?.length || 0,
        offlineCount: scanData.summary?.offlineAccounts || 0,
      });

      if (scanData.accounts) {
        scanData.accounts.forEach(acc => {
          console.log(
            `   📱 ${acc.account_id}: ${acc.current_status} (${acc.timeSinceLastPing?.toFixed(1)}s ago)`
          );
        });
      }
    }

    console.log('\n🎯 Multiple events sent - check browser console for:');
    console.log('   - 📡 [SSE RAW] events');
    console.log('   - 🎯 [SSE IMPORTANT] pendingAccountsUpdate events');
    console.log('   - ⏰ [POLLING] updates every 10 seconds');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Ejecutar la función
forceSSEEvent();

// Ejecutar cada 15 segundos para mantener eventos activos
setInterval(() => {
  console.log('\n⏰ Triggering periodic SSE events...');
  forceSSEEvent();
}, 15000);
