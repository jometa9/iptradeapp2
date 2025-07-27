import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Función para actualizar el archivo de configuración del servidor
function updateServerConfig() {
  try {
    console.log('🚀 Actualizando archivo de configuración del servidor...\n');

    // Leer el archivo de configuración correcto
    const correctConfigPath = join(__dirname, 'config', 'registered_accounts.json');
    const serverConfigPath = join(__dirname, 'server', 'config', 'registered_accounts.json');

    console.log(`📁 Leyendo configuración correcta desde: ${correctConfigPath}`);
    const correctConfig = JSON.parse(readFileSync(correctConfigPath, 'utf8'));

    console.log(`📁 Leyendo configuración del servidor desde: ${serverConfigPath}`);
    const serverConfig = JSON.parse(readFileSync(serverConfigPath, 'utf8'));

    const apiKey = 'iptrade_89536f5b9e643c0433f3';

    // Obtener las cuentas correctas
    const correctAccounts = correctConfig.userAccounts[apiKey];
    if (!correctAccounts) {
      console.log('❌ No se encontraron cuentas correctas para el API key especificado');
      return;
    }

    console.log(`📊 Cuentas correctas encontradas:`);
    console.log(
      `  - Pending accounts: ${Object.keys(correctAccounts.pendingAccounts || {}).length}`
    );
    console.log(`  - Master accounts: ${Object.keys(correctAccounts.masterAccounts || {}).length}`);
    console.log(`  - Slave accounts: ${Object.keys(correctAccounts.slaveAccounts || {}).length}`);

    // Actualizar el archivo del servidor
    if (!serverConfig.userAccounts) {
      serverConfig.userAccounts = {};
    }

    serverConfig.userAccounts[apiKey] = correctAccounts;

    // Guardar cambios
    writeFileSync(serverConfigPath, JSON.stringify(serverConfig, null, 2));

    console.log(`\n✅ Archivo del servidor actualizado correctamente`);

    // Verificar que las cuentas tienen información de plataforma
    const pendingAccounts = correctAccounts.pendingAccounts || {};
    const accountsWithPlatform = Object.values(pendingAccounts).filter(
      account => account.platform && account.platform !== null
    ).length;
    const totalAccounts = Object.keys(pendingAccounts).length;

    console.log(`\n📊 Resumen de cuentas pendientes:`);
    console.log(`  - Total: ${totalAccounts}`);
    console.log(`  - Con plataforma: ${accountsWithPlatform}`);

    // Mostrar algunas cuentas
    console.log(`\n📋 Ejemplos de cuentas pendientes:`);
    Object.entries(pendingAccounts)
      .slice(0, 5)
      .forEach(([id, account]) => {
        console.log(`  - ${id}: ${account.platform} (${account.status})`);
      });

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error actualizando configuración:', error.message);
  }
}

// Ejecutar el script
updateServerConfig();
