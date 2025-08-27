const fs = require('fs');
const path = require('path');

// Función para verificar el estado del cache de validación de suscripción
async function checkSubscriptionCacheStatus() {
  try {
    console.log('🔍 Verificando estado del cache de validación de suscripción...');
    
    const response = await fetch('http://localhost:30/api/subscription-cache-status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const status = await response.json();
      
      console.log('\n📊 Estado del Cache de Validación de Suscripción:');
      console.log(`   Tamaño del cache: ${status.cacheSize} entradas`);
      console.log(`   Validaciones en progreso: ${status.ongoingValidations}`);
      
      if (status.entries && status.entries.length > 0) {
        console.log('\n📋 Entradas en cache:');
        status.entries.forEach((entry, index) => {
          const ageMinutes = Math.floor(entry.age / (1000 * 60));
          const ageHours = Math.floor(ageMinutes / 60);
          const ageDisplay = ageHours > 0 ? `${ageHours}h ${ageMinutes % 60}m` : `${ageMinutes}m`;
          
          console.log(`   ${index + 1}. API Key: ${entry.apiKey}`);
          console.log(`      Usuario: ${entry.userData.email} (${entry.userData.subscriptionType})`);
          console.log(`      Edad: ${ageDisplay}`);
          console.log(`      Timestamp: ${new Date(entry.timestamp).toLocaleString()}`);
          console.log('');
        });
      } else {
        console.log('\n📭 Cache vacío');
      }
    } else {
      console.log('❌ No se pudo obtener el estado del cache (servidor no disponible)');
    }
  } catch (error) {
    console.log('❌ Error verificando estado del cache:', error.message);
  }
}

// Función para verificar archivos de cache locales
function checkLocalCacheFiles() {
  console.log('\n📁 Verificando archivos de cache locales...');
  
  const cacheFiles = [
    { path: 'server/config/auto_link_cache.json', name: 'Auto Link Cache' },
    { path: 'server/csv_data/csv_cache.json', name: 'CSV Cache' },
    { path: 'server/csv_data/loaded_files.json', name: 'Loaded Files Cache' },
    { path: 'server/csv_data/mql_paths_cache.json', name: 'MQL Paths Cache' }
  ];

  cacheFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file.path);
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        const modified = new Date(stats.mtime).toLocaleString();
        console.log(`   ✅ ${file.name}: ${sizeKB}KB, modificado: ${modified}`);
      } catch (error) {
        console.log(`   ❌ ${file.name}: Error leyendo archivo`);
      }
    } else {
      console.log(`   ⚠️ ${file.name}: No existe`);
    }
  });
}

// Función principal
async function main() {
  console.log('🚀 Verificando estado del cache...\n');
  
  await checkSubscriptionCacheStatus();
  checkLocalCacheFiles();
  
  console.log('\n✅ Verificación completada!');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkSubscriptionCacheStatus, checkLocalCacheFiles };

