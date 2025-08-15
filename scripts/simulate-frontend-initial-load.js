#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Simulating Frontend Initial Load Behavior\n');

// Simular el comportamiento del hook usePendingAccounts
async function simulateFrontendLoad() {
  console.log('🚀 Simulating frontend initial load...');

  // Paso 1: Intentar cargar desde cache primero
  console.log('\n📋 Step 1: Loading from cache (immediate)...');
  const cacheData = await loadFromCache();

  if (cacheData && cacheData.accounts && cacheData.accounts.length > 0) {
    console.log(`✅ Cache data found: ${cacheData.accounts.length} accounts`);
    console.log('📊 Accounts from cache:');
    cacheData.accounts.forEach((account, index) => {
      console.log(
        `   ${index + 1}. ${account.account_id} (${account.platform}) - ${account.status}`
      );
    });

    // Simular que se muestran inmediatamente en la UI
    console.log('\n🎯 UI would show these accounts immediately in pending tray');
    return;
  }

  // Paso 2: Si no hay cache, cargar desde endpoint regular
  console.log('\n🔄 Step 2: No cache data, loading from regular endpoint...');
  const regularData = await loadFromRegularEndpoint();

  if (regularData && regularData.accounts && regularData.accounts.length > 0) {
    console.log(`✅ Regular endpoint data: ${regularData.accounts.length} accounts`);
  } else {
    console.log('❌ No accounts found from any source');
  }
}

// Simular carga desde cache
async function loadFromCache() {
  try {
    // Simular el endpoint /api/accounts/pending/cache
    const cachePath = join(process.cwd(), 'server', 'config', 'csv_watching_cache.json');

    if (!existsSync(cachePath)) {
      console.log('   ❌ No cache file found');
      return null;
    }

    const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`   📋 Cache file found with ${cacheData.totalFiles} files`);

    // Simular procesamiento de archivos CSV desde cache
    const accounts = [];

    for (const filePath of cacheData.csvFiles) {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8').trim();
        const lines = content.split('\n').filter(line => line.trim());

        // Procesar líneas para encontrar cuentas pendientes
        lines.forEach(line => {
          if (line.includes('[PENDING]')) {
            // Parsear formato [TYPE] [PENDING] [PLATFORM] [ACCOUNT_ID]
            const parts = line.match(/\[([^\]]+)\]/g);
            if (parts && parts.length >= 4) {
              const platform = parts[2].replace(/[\[\]]/g, '');
              const accountId = parts[3].replace(/[\[\]]/g, '');

              accounts.push({
                account_id: accountId,
                platform: platform,
                status: 'online', // Asumir online por defecto
                timestamp: new Date().toISOString(),
                current_status: 'online',
              });
            }
          }
        });
      }
    }

    return {
      accounts: accounts,
      summary: {
        totalAccounts: accounts.length,
        onlineAccounts: accounts.filter(a => a.status === 'online').length,
        offlineAccounts: accounts.filter(a => a.status === 'offline').length,
      },
    };
  } catch (error) {
    console.error('   ❌ Error loading from cache:', error.message);
    return null;
  }
}

// Simular carga desde endpoint regular
async function loadFromRegularEndpoint() {
  console.log('   🔄 Simulating regular endpoint call...');
  // En un caso real, esto haría una llamada HTTP
  // Por ahora, simulamos que no hay datos adicionales
  return { accounts: [] };
}

// Ejecutar simulación
simulateFrontendLoad().then(() => {
  console.log('\n✅ Frontend initial load simulation completed');
  console.log('\n📝 Summary:');
  console.log('   - Frontend would try cache first for immediate display');
  console.log('   - If cache has data, accounts show immediately in pending tray');
  console.log('   - If no cache, it would fall back to regular endpoint');
  console.log('   - This ensures pending accounts are visible even before link accounts completes');
});
