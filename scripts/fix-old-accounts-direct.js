import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

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

// Función para actualizar cuentas antiguas
function updateOldAccounts() {
  try {
    console.log(
      '🚀 Actualizando cuentas antiguas directamente en el archivo de configuración...\n'
    );

    // Leer el archivo de configuración del servidor
    const configPath = join(__dirname, 'server', 'config', 'registered_accounts.json');
    console.log(`📁 Leyendo configuración desde: ${configPath}`);

    const configData = JSON.parse(readFileSync(configPath, 'utf8'));
    const apiKey = 'iptrade_89536f5b9e643c0433f3';

    if (!configData.userAccounts || !configData.userAccounts[apiKey]) {
      console.log('❌ No se encontraron cuentas para el API key especificado');
      return;
    }

    const userAccounts = configData.userAccounts[apiKey];
    const pendingAccounts = userAccounts.pendingAccounts || {};

    console.log(`📊 Encontradas ${Object.keys(pendingAccounts).length} cuentas pendientes`);

    // Filtrar cuentas que necesitan actualización
    const accountsToUpdate = Object.entries(pendingAccounts)
      .filter(([id, account]) => !account.platform || account.platform === null)
      .map(([id, account]) => ({
        id,
        currentPlatform: account.platform,
        detectedPlatform: detectPlatformFromAccountId(id),
      }));

    console.log(`🔍 Cuentas que necesitan actualización: ${accountsToUpdate.length}`);

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
    let updatedCount = 0;
    accountsToUpdate.forEach(({ id, detectedPlatform }) => {
      if (pendingAccounts[id]) {
        pendingAccounts[id].platform = detectedPlatform;
        pendingAccounts[id].broker = pendingAccounts[id].broker || 'Unknown';
        updatedCount++;
        console.log(`✅ Actualizado ${id} con plataforma: ${detectedPlatform}`);
      }
    });

    // Guardar cambios
    writeFileSync(configPath, JSON.stringify(configData, null, 2));

    console.log(`\n📊 Resumen de actualización:`);
    console.log(`✅ Cuentas actualizadas: ${updatedCount}`);
    console.log(`📝 Total procesadas: ${accountsToUpdate.length}`);

    // Verificar estado final
    const finalPendingAccounts = configData.userAccounts[apiKey].pendingAccounts;
    const accountsWithPlatform = Object.values(finalPendingAccounts).filter(
      account => account.platform && account.platform !== null
    ).length;
    const totalAccounts = Object.keys(finalPendingAccounts).length;

    console.log(
      `\n📊 Resumen final: ${accountsWithPlatform}/${totalAccounts} cuentas tienen información de plataforma`
    );

    // Mostrar algunas cuentas actualizadas
    console.log('\n📋 Ejemplos de cuentas actualizadas:');
    Object.entries(finalPendingAccounts)
      .filter(([id, account]) => account.platform && account.platform !== null)
      .slice(0, 10)
      .forEach(([id, account]) => {
        console.log(`  - ${id}: ${account.platform}`);
      });

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error actualizando cuentas:', error.message);
  }
}

// Ejecutar el script
updateOldAccounts();
