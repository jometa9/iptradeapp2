#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Categorías de scripts
const categories = {
  '🆕 Agregar Cuentas': [
    'add-pending-accounts.js',
    'add-pending-accounts-new.js',
    'add-test-pending-accounts.js',
    'add-old-accounts-with-platforms.js',
    'add-correct-pending-accounts.js',
    'add-test-slaves.js',
  ],
  '🧹 Limpieza': ['clear-pending-accounts.js', 'clean-old-accounts.js', 'final-cleanup.js'],
  '🔧 Actualización y Configuración': [
    'update-server-config-with-correct-accounts.js',
    'update-server-config-with-platforms.js',
    'update-old-accounts-platforms.js',
    'update-all-accounts-with-platforms.js',
    'fix-old-accounts-direct.js',
  ],
  '🔗 Conectividad': [
    'fix-connectivity-function.js',
    'fix-connectivity-stats.js',
    'temp-getConnectivityStats.js',
  ],
  '🧪 Testing': [
    'test-platform-fix.js',
    'test-add-pending-with-platforms.js',
    'test-connectivity-simple.js',
    'test-connectivity-simple.cjs',
    'test-connectivity-fix.js',
    'test-connectivity-stats.js',
    'test-pending-accounts.cjs',
    'test-pending-accounts-limits.js',
    'test-subscription.js',
    'test-subscription-limits.cjs',
    'test-new-subscription-structure.js',
    'test-account-limit-message.js',
    'test-managed-vps-limits.js',
    'test-delete-accounts.js',
    'test-endpoint-simple.js',
    'test-frontend-numbers.js',
    'test-tray.js',
    'test-load-config.cjs',
    'test-offline-never-enabled.cjs',
  ],
  '🐛 Debug': ['debug-numbers.js', 'debug-offline-count.cjs'],
  '🛠️ Utilidad': [
    'simple-fix.js',
    'replace-function.cjs',
    'generate-realistic-trading-environment.js',
    'release.js',
  ],
};

// Obtener todos los archivos .js y .cjs en el directorio actual
const scriptFiles = fs
  .readdirSync(__dirname)
  .filter(file => file.endsWith('.js') || file.endsWith('.cjs'))
  .filter(file => file !== 'list-scripts.js');

console.log('📁 Scripts Disponibles en /scripts\n');

// Mostrar scripts por categoría
Object.entries(categories).forEach(([category, expectedFiles]) => {
  const availableFiles = expectedFiles.filter(file => scriptFiles.includes(file));

  if (availableFiles.length > 0) {
    console.log(`${category}:`);
    availableFiles.forEach(file => {
      console.log(`  📄 ${file}`);
    });
    console.log('');
  }
});

// Mostrar scripts que no están categorizados
const categorizedFiles = Object.values(categories).flat();
const uncategorizedFiles = scriptFiles.filter(file => !categorizedFiles.includes(file));

if (uncategorizedFiles.length > 0) {
  console.log('📄 Scripts sin categorizar:');
  uncategorizedFiles.forEach(file => {
    console.log(`  📄 ${file}`);
  });
  console.log('');
}

console.log('💡 Para ejecutar un script:');
console.log('   node scripts/nombre-del-script.js');
console.log('');
console.log('📖 Para más información, consulta:');
console.log('   cat scripts/README.md');
