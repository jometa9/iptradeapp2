#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Obtener el nombre del script desde los argumentos
const scriptName = process.argv[2];

if (!scriptName) {
  console.log('❌ Error: Debes especificar el nombre del script');
  console.log('');
  console.log('💡 Uso:');
  console.log('   node scripts/run.js nombre-del-script');
  console.log('');
  console.log('📋 Scripts disponibles:');

  // Listar todos los scripts disponibles
  const scriptFiles = fs
    .readdirSync(__dirname)
    .filter(file => file.endsWith('.js') || file.endsWith('.cjs'))
    .filter(file => !['run.js', 'list-scripts.js'].includes(file));

  scriptFiles.forEach(file => {
    console.log(`   📄 ${file}`);
  });

  console.log('');
  console.log('💡 Ejemplo:');
  console.log('   node scripts/run.js add-pending-accounts.js');
  process.exit(1);
}

// Construir la ruta completa del script
const scriptPath = path.join(__dirname, scriptName);

// Verificar si el script existe
if (!fs.existsSync(scriptPath)) {
  console.log(`❌ Error: El script "${scriptName}" no existe`);
  console.log('');
  console.log('📋 Scripts disponibles:');

  const scriptFiles = fs
    .readdirSync(__dirname)
    .filter(file => file.endsWith('.js') || file.endsWith('.cjs'))
    .filter(file => !['run.js', 'list-scripts.js'].includes(file));

  scriptFiles.forEach(file => {
    console.log(`   📄 ${file}`);
  });

  process.exit(1);
}

console.log(`🚀 Ejecutando: ${scriptName}`);
console.log('');

// Ejecutar el script
const child = spawn('node', [scriptPath], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('close', code => {
  console.log('');
  console.log(`✅ Script completado con código: ${code}`);
  process.exit(code);
});

child.on('error', error => {
  console.error(`❌ Error ejecutando el script: ${error.message}`);
  process.exit(1);
});
