const fs = require('fs');
const path = require('path');

// Función para limpiar archivos de cache
function clearCacheFiles() {
  const cacheFiles = [
    'server/config/auto_link_cache.json',
    'server/csv_data/csv_cache.json',
    'server/csv_data/loaded_files.json',
    'server/csv_data/mql_paths_cache.json'
  ];

  console.log('🧹 Limpiando archivos de cache...');
  
  cacheFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`✅ Eliminado: ${file}`);
      } catch (error) {
        console.error(`❌ Error eliminando ${file}:`, error.message);
      }
    } else {
      console.log(`ℹ️ No existe: ${file}`);
    }
  });
}

// Función para limpiar cache de validación de suscripción via API
async function clearSubscriptionCache() {
  try {
    console.log('🔐 Limpiando cache de validación de suscripción...');
    
    const response = await fetch('http://localhost:30/api/clear-subscription-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Cache de suscripción limpiado: ${result.message}`);
    } else {
      console.log('⚠️ No se pudo limpiar el cache de suscripción (servidor no disponible)');
    }
  } catch (error) {
    console.log('⚠️ No se pudo limpiar el cache de suscripción:', error.message);
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando limpieza de cache...\n');
  
  // Limpiar archivos de cache
  clearCacheFiles();
  
  console.log('\n📡 Intentando limpiar cache de validación de suscripción...');
  await clearSubscriptionCache();
  
  console.log('\n✅ Limpieza completada!');
  console.log('💡 Reinicia el servidor para aplicar los cambios.');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { clearCacheFiles, clearSubscriptionCache };
