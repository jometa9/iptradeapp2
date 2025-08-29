const fs = require('fs');
const path = require('path');

// Función para limpiar archivos de cache
function clearCacheFiles() {
  const cacheFiles = [
    'server/config/auto_link_cache.json',
    'server/csv_data/csv_cache.json',
    'server/csv_data/loaded_files.json',
    'server/csv_data/mql_paths_cache.json',
  ];

  cacheFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error(`❌ Error eliminando ${file}:`, error.message);
      }
    }
  });
}

// Función para limpiar cache de validación de suscripción via API
async function clearSubscriptionCache() {
  try {
    const response = await fetch('http://localhost:30/api/clear-subscription-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
    }
  } catch (error) {}
}

// Función principal
async function main() {
  clearCacheFiles();

  await clearSubscriptionCache();
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { clearCacheFiles, clearSubscriptionCache };
