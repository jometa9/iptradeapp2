#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanupTestAccounts() {
  console.log('🧹 Limpiando cuentas de prueba...');

  const accountsDir = path.join(__dirname, '..', 'accounts');

  if (!fs.existsSync(accountsDir)) {
    console.log('📁 El directorio accounts no existe. No hay nada que limpiar.');
    return;
  }

  const files = fs.readdirSync(accountsDir);
  let cleanedCount = 0;

  files.forEach(file => {
    const filePath = path.join(accountsDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && (file.endsWith('.csv') || file.endsWith('.json'))) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Eliminado: ${file}`);
      cleanedCount++;
    }
  });

  console.log(`\n✅ Limpieza completada. ${cleanedCount} archivos eliminados.`);

  // Intentar eliminar el directorio si está vacío
  try {
    const remainingFiles = fs.readdirSync(accountsDir);
    if (remainingFiles.length === 0) {
      fs.rmdirSync(accountsDir);
      console.log('📁 Directorio accounts eliminado (estaba vacío).');
    }
  } catch (error) {
    // Directorio no vacío o error, no importa
  }
}

// Script CLI
if (require.main === module) {
  try {
    cleanupTestAccounts();
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
    process.exit(1);
  }
}

module.exports = { cleanupTestAccounts };
