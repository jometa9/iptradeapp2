const API_BASE_URL = 'http://localhost:30/api';

const API_KEY = 'iptrade_6616c788f776a3b114f0';
//const API_KEY = 'iptrade_89536f5b9e643c0433f3';

// Array de cuentas pendientes para agregar
const pendingAccounts = [
  { accountId: '111111', platform: 'MT5', broker: 'MetaQuotes' },
  { accountId: '222222', platform: 'MT4', broker: 'MetaQuotes' },
  { accountId: '333333', platform: 'MT5', broker: 'IC Markets' },
  { accountId: '444444', platform: 'MT4', broker: 'FXPro' },
  { accountId: '555555', platform: 'MT5', broker: 'Pepperstone' },
  { accountId: '666666', platform: 'MT4', broker: 'OANDA' },
  { accountId: '777777', platform: 'MT5', broker: 'XM' },
  { accountId: '888888', platform: 'MT4', broker: 'FxPro' },
  { accountId: '999999', platform: 'MT5', broker: 'IC Markets' },
  { accountId: '101010', platform: 'MT4', broker: 'Pepperstone' },
];

// Función para simular EA y registrar cuenta pendiente
async function simulateEAAndRegister(accountData) {
  try {
    console.log(`🤖 Simulando EA para cuenta: ${accountData.accountId} (${accountData.platform})`);

    // Simular el comportamiento de un EA haciendo ping
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
        Object.entries(data.pendingAccounts).forEach(([id, account]) => {
          const status = account.status || 'pending';
          const lastActivity = account.lastActivity ? new Date(account.lastActivity) : null;
          const timeSinceActivity = lastActivity ? Date.now() - lastActivity.getTime() : null;

          console.log(
            `  - ${id}: ${account.platform || 'Unknown'} (${status}) - ${timeSinceActivity ? Math.round(timeSinceActivity / 1000) + 's ago' : 'never'}`
          );
        });
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

// Función principal
async function addPendingAccounts() {
  console.log('🚀 Iniciando simulación de EA para registrar cuentas pendientes...\n');
  console.log(`📝 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`🌐 Servidor: ${API_BASE_URL}\n`);

  // Verificar cuentas existentes primero
  console.log('📊 Verificando cuentas pendientes existentes...');
  await checkExistingPendingAccounts();

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
}

// Ejecutar el script
addPendingAccounts().catch(console.error);
