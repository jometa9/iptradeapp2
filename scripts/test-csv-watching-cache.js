#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Testing CSV Watching Cache System\n');

// Función para mostrar información del cache
function showCacheInfo() {
  const cachePath = join(process.cwd(), 'server', 'config', 'csv_watching_cache.json');

  if (existsSync(cachePath)) {
    try {
      const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
      console.log('📋 CSV Watching Cache Info:');
      console.log(`   - Total files cached: ${cacheData.totalFiles}`);
      console.log(`   - Cache timestamp: ${cacheData.timestamp}`);
      console.log(`   - Last scan: ${cacheData.lastScan}`);
      console.log(`   - Version: ${cacheData.version}`);

      if (cacheData.csvFiles.length > 0) {
        console.log('\n📁 Cached CSV files:');
        cacheData.csvFiles.forEach((filePath, index) => {
          const exists = existsSync(filePath) ? '✅' : '❌';
          console.log(`   ${index + 1}. ${exists} ${filePath}`);
        });
      }
    } catch (error) {
      console.error('❌ Error reading cache:', error.message);
    }
  } else {
    console.log('❌ CSV watching cache not found');
  }
}

// Función para comparar con mql_paths_cache.json
function compareWithMQLCache() {
  const mqlCachePath = join(process.cwd(), 'config', 'mql_paths_cache.json');

  if (existsSync(mqlCachePath)) {
    try {
      const mqlCache = JSON.parse(readFileSync(mqlCachePath, 'utf8'));
      console.log('\n📊 Comparison with MQL Paths Cache:');
      console.log(`   - MQL4 folders: ${mqlCache.paths.mql4Folders.length}`);
      console.log(`   - MQL5 folders: ${mqlCache.paths.mql5Folders.length}`);
      console.log(`   - MQL timestamp: ${mqlCache.timestamp}`);
    } catch (error) {
      console.error('❌ Error reading MQL cache:', error.message);
    }
  }
}

// Función para verificar archivos CSV reales
function checkRealCSVFiles() {
  const csvLocationsPath = join(process.cwd(), 'server', 'config', 'csv_locations.json');

  if (existsSync(csvLocationsPath)) {
    try {
      const csvLocations = JSON.parse(readFileSync(csvLocationsPath, 'utf8'));
      console.log('\n🔍 Checking configured CSV locations:');

      let totalFound = 0;
      csvLocations.csvLocations.forEach(location => {
        const fullPath = join(location, 'IPTRADECSV2.csv');
        const exists = existsSync(fullPath) ? '✅' : '❌';
        console.log(`   ${exists} ${fullPath}`);
        if (existsSync(fullPath)) totalFound++;
      });

      console.log(`\n📊 Summary: ${totalFound} CSV files found in configured locations`);
    } catch (error) {
      console.error('❌ Error reading CSV locations:', error.message);
    }
  }
}

// Ejecutar pruebas
showCacheInfo();
compareWithMQLCache();
checkRealCSVFiles();

console.log('\n✅ CSV Watching Cache test completed');
