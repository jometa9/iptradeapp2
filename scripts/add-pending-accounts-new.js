const API_BASE_URL = 'http://localhost:30/api';

// Usar el API key correcto que hemos estado usando en las pruebas
//const API_KEY = 'iptrade_89536f5b9e643c0433f3';
const API_KEY = 'iptrade_6616c788f776a3b114f0';
// Array de cuentas pendientes para agregar con plataformas específicas
const pendingAccounts = [
  { accountId: 'PENDING_MT4_001', platform: 'MT4', broker: 'IC Markets' },
  { accountId: 'PENDING_MT5_002', platform: 'MT5', broker: 'FTMO' },
  { accountId: 'PENDING_CTRADER_003', platform: 'cTrader', broker: 'Pepperstone' },
  { accountId: 'PENDING_NINJA_004', platform: 'NinjaTrader', broker: 'AMP Futures' },
  { accountId: 'PENDING_TV_005', platform: 'TradingView', broker: 'TradingView' },
  { accountId: 'TEST_MT4_006', platform: 'MT4', broker: 'XM' },
  { accountId: 'TEST_MT5_007', platform: 'MT5', broker: 'Admiral Markets' },
  { accountId: 'TEST_CTRADER_008', platform: 'cTrader', broker: 'FXPro' },
  { accountId: 'TEST_NINJA_009', platform: 'NinjaTrader', broker: 'Interactive Brokers' },
  { accountId: 'TEST_TV_010', platform: 'TradingView', broker: 'TradingView' },
];

// Función para simular EA y registrar cuenta pendiente
async function simulateEAAndRegister(accountData) {
  try {
    console.log(`🤖 Simulando EA para cuenta: ${accountData.accountId} (${accountData.platform})`);

    // Simular el comportamiento de un EA haciendo ping
    // El nuevo sistema detectará automáticamente la plataforma basándose en el accountId
    const response = await fetch(`${API_BASE_URL}/accounts/ping`, {
      method: 'POST',
      headers: {
        'x-account-id': accountData.accountId,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'online',
        lastActivity: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        `✅ EA simulado exitosamente para ${accountData.accountId}: ${data.accountType} account`
      );
      return true;
    } else {
      const errorData = await response.text();
      console.error(
        `❌ Error simulando EA para ${accountData.accountId}: ${response.status} - ${errorData}`
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Error de conexión para ${accountData.accountId}:`, error.message);
    return false;
  }
}

// Función para verificar cuentas pendientes existentes
async function checkExistingPendingAccounts() {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`\n📋 Cuentas pendientes existentes: ${data.totalPending}`);

      if (data.pendingAccounts && Object.keys(data.pendingAccounts).length > 0) {
        // Mostrar solo las cuentas que empiezan con PENDING_ o TEST_ para mayor claridad
        const relevantAccounts = Object.entries(data.pendingAccounts)
          .filter(([id, account]) => id.startsWith('PENDING_') || id.startsWith('TEST_'))
          .slice(0, 10); // Mostrar máximo 10 cuentas relevantes

        if (relevantAccounts.length > 0) {
          console.log('📋 Cuentas relevantes con información de plataforma:');
          relevantAccounts.forEach(([id, account]) => {
            const status = account.status || 'pending';
            const platform = account.platform || 'Unknown';
            const lastActivity = account.lastActivity ? new Date(account.lastActivity) : null;
            const timeSinceActivity = lastActivity ? Date.now() - lastActivity.getTime() : null;

            console.log(
              `  - ${id}: ${platform} (${status}) - ${timeSinceActivity ? Math.round(timeSinceActivity / 1000) + 's ago' : 'never'}`
            );
          });
        } else {
          console.log('  No hay cuentas relevantes (PENDING_ o TEST_)');
        }

        // Mostrar resumen de todas las cuentas
        const totalAccounts = Object.keys(data.pendingAccounts).length;
        const accountsWithPlatform = Object.values(data.pendingAccounts).filter(
          account => account.platform
        ).length;
        console.log(
          `\n📊 Resumen: ${accountsWithPlatform}/${totalAccounts} cuentas tienen información de plataforma`
        );
      } else {
        console.log('  No hay cuentas pendientes existentes');
      }
    } else {
      console.error('❌ Error verificando cuentas pendientes existentes');
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  }
}

// Función para verificar que el sistema de detección de plataformas funciona
async function testPlatformDetection() {
  console.log('\n🔍 Probando detección automática de plataformas...');

  const testAccounts = [
    'TEST_MT4_DETECTION',
    'TEST_MT5_DETECTION',
    'TEST_CTRADER_DETECTION',
    'TEST_NINJA_DETECTION',
    'TEST_TV_DETECTION',
    'TEST_UNKNOWN_PLATFORM',
  ];

  for (const accountId of testAccounts) {
    try {
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
        }),
      });

      if (response.ok) {
        console.log(`✅ ${accountId} registrado correctamente`);
      }
    } catch (error) {
      console.error(`❌ Error registrando ${accountId}:`, error.message);
    }

    // Pequeño delay entre registros
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Verificar que las cuentas se crearon con la plataforma correcta
  console.log('\n📋 Verificando detección de plataformas:');
  const response = await fetch(`${API_BASE_URL}/accounts/pending`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (response.ok) {
    const data = await response.json();
    testAccounts.forEach(accountId => {
      const account = data.pendingAccounts[accountId];
      if (account) {
        console.log(
          `  - ${accountId}: ${account.platform || 'undefined'} (detectado automáticamente)`
        );
      }
    });
  }
}

// Función principal
async function addPendingAccounts() {
  console.log('🚀 Iniciando simulación de EA para registrar cuentas pendientes...\n');
  console.log(`📝 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`🌐 Servidor: ${API_BASE_URL}\n`);

  // Verificar cuentas existentes primero
  console.log('📊 Verificando cuentas pendientes existentes...');
  await checkExistingPendingAccounts();

  // Probar el sistema de detección de plataformas
  await testPlatformDetection();

  console.log('\n🤖 Simulando EAs para registrar cuentas pendientes...');

  let successCount = 0;
  let errorCount = 0;

  // Simular EA para cada cuenta
  for (const account of pendingAccounts) {
    const success = await simulateEAAndRegister(account);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Pequeño delay entre registros
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Resumen del registro:');
  console.log(`✅ Exitosos: ${successCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log(`📝 Total procesados: ${pendingAccounts.length}`);

  // Verificar estado final
  console.log('\n📋 Estado final de cuentas pendientes:');
  await checkExistingPendingAccounts();

  console.log('\n✅ Proceso completado');
  console.log('\n🎯 Características del nuevo sistema:');
  console.log('   - Detección automática de plataformas basada en accountId');
  console.log('   - Soporte para MT4, MT5, cTrader, NinjaTrader, TradingView');
  console.log('   - Información de plataforma incluida en todas las cuentas nuevas');
  console.log('   - Compatible con el sistema de mapeo de plataformas del frontend');
}

// Ejecutar el script
addPendingAccounts().catch(console.error);
