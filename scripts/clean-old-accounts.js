import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Función para limpiar cuentas antiguas
function cleanOldAccounts() {
  try {
    console.log('🚀 Limpiando cuentas antiguas sin información de plataforma...\n');

    // Leer el archivo de configuración del servidor
    const serverConfigPath = join(__dirname, 'server', 'config', 'registered_accounts.json');
    console.log(`📁 Leyendo configuración desde: ${serverConfigPath}`);

    const serverConfig = JSON.parse(readFileSync(serverConfigPath, 'utf8'));
    const apiKey = 'iptrade_89536f5b9e643c0433f3';

    if (!serverConfig.userAccounts || !serverConfig.userAccounts[apiKey]) {
      console.log('❌ No se encontraron cuentas para el API key especificado');
      return;
    }

    const userAccounts = serverConfig.userAccounts[apiKey];
    const pendingAccounts = userAccounts.pendingAccounts || {};

    console.log(`📊 Cuentas pendientes antes de limpiar: ${Object.keys(pendingAccounts).length}`);

    // Filtrar cuentas que tienen información de plataforma
    const accountsToKeep = Object.entries(pendingAccounts)
      .filter(([id, account]) => account.platform && account.platform !== null)
      .reduce((acc, [id, account]) => {
        acc[id] = account;
        return acc;
      }, {});

    const accountsToRemove = Object.entries(pendingAccounts)
      .filter(([id, account]) => !account.platform || account.platform === null)
      .map(([id, account]) => id);

    console.log(`🔍 Cuentas a mantener: ${Object.keys(accountsToKeep).length}`);
    console.log(`🗑️ Cuentas a eliminar: ${accountsToRemove.length}`);

    if (accountsToRemove.length > 0) {
      console.log('\n📋 Cuentas que se eliminarán:');
      accountsToRemove.forEach(id => {
        console.log(`  - ${id}`);
      });
    }

    // Actualizar el archivo
    userAccounts.pendingAccounts = accountsToKeep;
    writeFileSync(serverConfigPath, JSON.stringify(serverConfig, null, 2));

    console.log(`\n✅ Archivo actualizado correctamente`);

    // Verificar estado final
    const finalPendingAccounts = userAccounts.pendingAccounts;
    const accountsWithPlatform = Object.values(finalPendingAccounts).filter(
      account => account.platform && account.platform !== null
    ).length;
    const totalAccounts = Object.keys(finalPendingAccounts).length;

    console.log(`\n📊 Resumen final:`);
    console.log(`  - Total cuentas pendientes: ${totalAccounts}`);
    console.log(`  - Con información de plataforma: ${accountsWithPlatform}`);

    // Mostrar cuentas restantes
    console.log(`\n📋 Cuentas pendientes restantes:`);
    Object.entries(finalPendingAccounts).forEach(([id, account]) => {
      console.log(`  - ${id}: ${account.platform} (${account.status})`);
    });

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error limpiando cuentas:', error.message);
  }
}

// Ejecutar el script
cleanOldAccounts();
