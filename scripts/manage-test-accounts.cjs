#!/usr/bin/env node

const { generatePendingAccounts } = require('./generate-realistic-pending-accounts.cjs');
const { cleanupTestAccounts } = require('./cleanup-test-pending-accounts.cjs');

function showHelp() {
  console.log('🔧 IPTRADE - Gestor de Cuentas de Prueba');
  console.log('');
  console.log('📖 Uso:');
  console.log('  node manage-test-accounts.js <comando> [opciones]');
  console.log('');
  console.log('📋 Comandos disponibles:');
  console.log('  generate [cantidad]  - Generar cuentas pendientes (por defecto: 8)');
  console.log('  cleanup             - Limpiar todas las cuentas de prueba');
  console.log('  reset [cantidad]    - Limpiar y generar nuevas cuentas');
  console.log('  help                - Mostrar esta ayuda');
  console.log('');
  console.log('📖 Ejemplos:');
  console.log('  node manage-test-accounts.js generate 5     # Genera 5 cuentas');
  console.log('  node manage-test-accounts.js cleanup        # Limpia todas las cuentas');
  console.log('  node manage-test-accounts.js reset 10       # Limpia y genera 10 nuevas');
  console.log('');
  console.log('💡 Tip: Después de generar cuentas, el servidor las detectará automáticamente.');
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const command = args[0];
  const param = args[1];

  try {
    switch (command) {
      case 'generate':
        const generateCount = param ? parseInt(param) : 8;
        if (isNaN(generateCount) || generateCount < 1 || generateCount > 50) {
          console.error('❌ Error: Cantidad debe ser un número entre 1 y 50');
          return;
        }
        console.log(`\n🎯 Generando ${generateCount} cuentas pendientes...\n`);
        generatePendingAccounts(generateCount);
        break;

      case 'cleanup':
        console.log('\n🧹 Limpiando cuentas de prueba...\n');
        cleanupTestAccounts();
        break;

      case 'reset':
        const resetCount = param ? parseInt(param) : 8;
        if (isNaN(resetCount) || resetCount < 1 || resetCount > 50) {
          console.error('❌ Error: Cantidad debe ser un número entre 1 y 50');
          return;
        }
        console.log(`\n🔄 Reseteando cuentas (limpiar + generar ${resetCount})...\n`);
        cleanupTestAccounts();
        console.log('');
        generatePendingAccounts(resetCount);
        break;

      default:
        console.error(`❌ Comando desconocido: ${command}`);
        console.log('💡 Usa "help" para ver los comandos disponibles.');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error ejecutando comando:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
