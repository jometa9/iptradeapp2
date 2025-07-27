const API_BASE_URL = 'http://localhost:30/api';
const API_KEY = 'iptrade_89536f5b9e643c0433f3';

// Función para detectar plataforma basada en accountId
function detectPlatformFromAccountId(accountId) {
  if (accountId.includes('MT4') || accountId.includes('mt4')) {
    return 'MT4';
  } else if (accountId.includes('MT5') || accountId.includes('mt5')) {
    return 'MT5';
  } else if (accountId.includes('CTRADER') || accountId.includes('cTrader')) {
    return 'cTrader';
  } else if (accountId.includes('NINJA') || accountId.includes('NinjaTrader')) {
    return 'NinjaTrader';
  } else if (accountId.includes('TV') || accountId.includes('TradingView')) {
    return 'TradingView';
  } else {
    // Para cuentas numéricas simples, asignar basándose en el patrón
    const numId = parseInt(accountId);
    if (numId % 2 === 0) {
      return 'MT4'; // Cuentas pares = MT4
    } else {
      return 'MT5'; // Cuentas impares = MT5
    }
  }
}

// Función para actualizar una cuenta con información de plataforma
async function updateAccountPlatform(accountId, platform) {
  try {
    console.log(`🔄 Actualizando ${accountId} con plataforma: ${platform}`);

    // Simular un ping para actualizar la cuenta con la nueva información
    const response = await fetch(`${API_BASE_URL}/accounts/ping`, {
      method: 'POST',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'online',
        lastActivity: new Date().toISOString(),
        platform: platform, // Incluir la plataforma en el ping
      }),
    });

    if (response.ok) {
      console.log(`✅ ${accountId} actualizado correctamente`);
      return true;
    } else {
      const errorData = await response.text();
      console.error(`❌ Error actualizando ${accountId}: ${response.status} - ${errorData}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error de conexión para ${accountId}:`, error.message);
    return false;
  }
}

// Función para obtener cuentas pendientes
async function getPendingAccounts() {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.pendingAccounts || {};
    } else {
      console.error('❌ Error obteniendo cuentas pendientes');
      return {};
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return {};
  }
}

// Función principal
async function updateOldAccountsPlatforms() {
  console.log('🚀 Iniciando actualización de plataformas para cuentas antiguas...\n');
  console.log(`📝 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`🌐 Servidor: ${API_BASE_URL}\n`);

  // Obtener cuentas pendientes
  console.log('📊 Obteniendo cuentas pendientes...');
  const pendingAccounts = await getPendingAccounts();

  if (Object.keys(pendingAccounts).length === 0) {
    console.log('❌ No se encontraron cuentas pendientes');
    return;
  }

  console.log(`📋 Encontradas ${Object.keys(pendingAccounts).length} cuentas pendientes`);

  // Filtrar cuentas que necesitan actualización (platform null o undefined)
  const accountsToUpdate = Object.entries(pendingAccounts)
    .filter(([id, account]) => !account.platform || account.platform === null)
    .map(([id, account]) => ({
      id,
      currentPlatform: account.platform,
      detectedPlatform: detectPlatformFromAccountId(id),
    }));

  console.log(`\n🔍 Cuentas que necesitan actualización: ${accountsToUpdate.length}`);

  if (accountsToUpdate.length === 0) {
    console.log('✅ Todas las cuentas ya tienen información de plataforma');
    return;
  }

  // Mostrar cuentas que se van a actualizar
  console.log('\n📋 Cuentas a actualizar:');
  accountsToUpdate.forEach(({ id, currentPlatform, detectedPlatform }) => {
    console.log(`  - ${id}: ${currentPlatform || 'null'} → ${detectedPlatform}`);
  });

  // Actualizar cuentas
  console.log('\n🔄 Actualizando cuentas...');
  let successCount = 0;
  let errorCount = 0;

  for (const { id, detectedPlatform } of accountsToUpdate) {
    const success = await updateAccountPlatform(id, detectedPlatform);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Pequeño delay entre actualizaciones
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Resumen de actualización:');
  console.log(`✅ Exitosos: ${successCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log(`📝 Total procesados: ${accountsToUpdate.length}`);

  // Verificar estado final
  console.log('\n📋 Verificando estado final...');
  const finalAccounts = await getPendingAccounts();
  const updatedAccounts = Object.entries(finalAccounts)
    .filter(([id, account]) => account.platform && account.platform !== null)
    .slice(0, 10); // Mostrar máximo 10 cuentas

  if (updatedAccounts.length > 0) {
    console.log('📋 Cuentas con plataforma actualizada:');
    updatedAccounts.forEach(([id, account]) => {
      console.log(`  - ${id}: ${account.platform}`);
    });
  }

  const totalAccounts = Object.keys(finalAccounts).length;
  const accountsWithPlatform = Object.values(finalAccounts).filter(
    account => account.platform && account.platform !== null
  ).length;
  console.log(
    `\n📊 Resumen final: ${accountsWithPlatform}/${totalAccounts} cuentas tienen información de plataforma`
  );

  console.log('\n✅ Proceso completado');
}

// Ejecutar el script
updateOldAccountsPlatforms().catch(console.error);
