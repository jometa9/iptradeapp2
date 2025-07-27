import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Función para agregar cuentas pendientes correctas
function addCorrectPendingAccounts() {
  try {
    console.log('🚀 Agregando cuentas pendientes correctas al archivo del servidor...\n');

    // Leer el archivo de configuración del servidor
    const serverConfigPath = join(__dirname, 'server', 'config', 'registered_accounts.json');
    console.log(`📁 Leyendo configuración desde: ${serverConfigPath}`);

    const serverConfig = JSON.parse(readFileSync(serverConfigPath, 'utf8'));
    const apiKey = 'iptrade_89536f5b9e643c0433f3';

    // Asegurar que existe la estructura para el API key
    if (!serverConfig.userAccounts) {
      serverConfig.userAccounts = {};
    }

    if (!serverConfig.userAccounts[apiKey]) {
      serverConfig.userAccounts[apiKey] = {
        masterAccounts: {},
        slaveAccounts: {},
        pendingAccounts: {},
        connections: {},
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };
    }

    // Agregar cuentas pendientes correctas
    const correctPendingAccounts = {
      PENDING_MT4_001: {
        id: 'PENDING_MT4_001',
        name: 'MT4 Test Account 001',
        description: 'High frequency scalping EA detected',
        firstSeen: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'pending',
        platform: 'MT4',
        broker: 'IC Markets',
      },
      PENDING_MT5_002: {
        id: 'PENDING_MT5_002',
        name: 'MT5 Test Account 002',
        description: 'Swing trading EA - awaiting configuration',
        firstSeen: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'pending',
        platform: 'MT5',
        broker: 'FTMO',
      },
      PENDING_CTRADER_003: {
        id: 'PENDING_CTRADER_003',
        name: 'cTrader Test Account 003',
        description: 'Grid trading strategy detected',
        firstSeen: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'pending',
        platform: 'cTrader',
        broker: 'Pepperstone',
      },
      PENDING_NINJA_004: {
        id: 'PENDING_NINJA_004',
        name: 'NinjaTrader Test Account 004',
        description: 'Futures trading algorithm',
        firstSeen: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'pending',
        platform: 'NinjaTrader',
        broker: 'AMP Futures',
      },
      PENDING_TV_005: {
        id: 'PENDING_TV_005',
        name: 'TradingView Test Account 005',
        description: 'Web-based trading strategy',
        firstSeen: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'pending',
        platform: 'TradingView',
        broker: 'TradingView',
      },
    };

    // Actualizar las cuentas pendientes
    serverConfig.userAccounts[apiKey].pendingAccounts = correctPendingAccounts;

    // Guardar cambios
    writeFileSync(serverConfigPath, JSON.stringify(serverConfig, null, 2));

    console.log(`\n✅ Archivo del servidor actualizado correctamente`);

    // Verificar estado final
    const finalPendingAccounts = serverConfig.userAccounts[apiKey].pendingAccounts;
    const accountsWithPlatform = Object.values(finalPendingAccounts).filter(
      account => account.platform && account.platform !== null
    ).length;
    const totalAccounts = Object.keys(finalPendingAccounts).length;

    console.log(`\n📊 Resumen final:`);
    console.log(`  - Total cuentas pendientes: ${totalAccounts}`);
    console.log(`  - Con información de plataforma: ${accountsWithPlatform}`);

    // Mostrar cuentas
    console.log(`\n📋 Cuentas pendientes agregadas:`);
    Object.entries(finalPendingAccounts).forEach(([id, account]) => {
      console.log(`  - ${id}: ${account.platform} (${account.status})`);
    });

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error agregando cuentas:', error.message);
  }
}

// Ejecutar el script
addCorrectPendingAccounts();
