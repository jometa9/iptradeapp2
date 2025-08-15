#!/usr/bin/env node
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('🔧 Manually populating CSV Watching Cache...\n');

// Rutas conocidas de archivos CSV
const knownCSVPaths = [
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv',
];

// Filtrar solo las rutas que existen
const existingPaths = knownCSVPaths.filter(path => existsSync(path));

console.log(`📁 Found ${existingPaths.length} existing CSV files:`);
existingPaths.forEach((path, index) => {
  console.log(`   ${index + 1}. ${path}`);
});

// Crear datos del cache
const cacheData = {
  csvFiles: existingPaths,
  timestamp: new Date().toISOString(),
  version: '1.0',
  totalFiles: existingPaths.length,
  lastScan: new Date().toISOString(),
};

// Guardar en cache
const cachePath = join(process.cwd(), 'server', 'config', 'csv_watching_cache.json');
writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');

console.log(`\n💾 Saved ${existingPaths.length} CSV paths to cache: ${cachePath}`);
console.log('✅ CSV Watching Cache populated manually!');
