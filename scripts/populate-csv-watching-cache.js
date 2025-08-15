#!/usr/bin/env node
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cambiar al directorio del servidor
process.chdir(join(__dirname, '..', 'server'));

console.log('🔧 Populating CSV Watching Cache...\n');

try {
  // Importar la instancia del CSV Manager
  const { default: csvManager } = await import('../server/src/services/csvManager.js');

  console.log('📋 CSV Manager initialized');
  console.log(`📁 Current CSV files in memory: ${csvManager.csvFiles.size}`);

  // Forzar escaneo de archivos CSV
  console.log('\n🔍 Scanning for CSV files...');
  const foundFiles = await csvManager.scanCSVFiles();

  console.log(`✅ Found ${foundFiles.length} CSV files`);
  foundFiles.forEach((filePath, index) => {
    console.log(`   ${index + 1}. ${filePath}`);
  });

  // Verificar que se guardó en cache
  console.log('\n💾 Checking cache after scan...');
  const cachedPaths = csvManager.loadCSVPathsFromCache();
  console.log(`📋 Cached paths: ${cachedPaths.length}`);

  // Mostrar información del cache
  const { readFileSync, existsSync } = await import('fs');
  const cachePath = join(process.cwd(), 'config', 'csv_watching_cache.json');
  if (existsSync(cachePath)) {
    const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log('\n📊 Cache Summary:');
    console.log(`   - Total files: ${cacheData.totalFiles}`);
    console.log(`   - Timestamp: ${cacheData.timestamp}`);
    console.log(`   - Last scan: ${cacheData.lastScan}`);
  }

  console.log('\n✅ CSV Watching Cache populated successfully!');
} catch (error) {
  console.error('❌ Error populating CSV cache:', error);
  process.exit(1);
}
