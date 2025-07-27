#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Categorías de documentación
const categories = {
  '🚀 Documentación Principal': [
    'README.md',
    'REQUIREMENT.md',
    'TODO.md'
  ],
  '🔧 Implementación y Desarrollo': [
    'IMPLEMENTATION_SUMMARY.md',
    'VERSIONING_AND_DEPLOYMENT.md',
    'DISTRIBUTION_STRATEGY.md'
  ],
  '📡 APIs y Endpoints': [
    'API_DOCUMENTATION.md',
    'EA_API_ENDPOINTS.md',
    'CTRADER_INTEGRATION.md'
  ],
  '👥 Cuentas Pendientes': [
    'PENDING_ACCOUNTS_REALTIME_FIX.md',
    'PENDING_ACCOUNTS_OFFLINE_IMPLEMENTATION.md',
    'PENDING_ACCOUNTS_LIMITS_FIX.md'
  ],
  '💳 Suscripciones y Límites': [
    'SUBSCRIPTION_STRUCTURE_UPDATE.md',
    'SUBSCRIPTION_LIMITS_IMPLEMENTATION.md',
    'SUBSCRIPTION_LIMITS_CARD_FIX.md',
    'SUBSCRIPTION_VALIDATION_OPTIMIZATION.md',
    'SUBSCRIPTION_DEBUG.md'
  ],
  '🖥️ Configuración y Límites': [
    'MANAGED_VPS_LIMITS_CONFIGURATION.md',
    'PLAN_MAPPING_FIX.md'
  ],
  '🔗 Integraciones Externas': [
    'EXTERNAL_LINKS_INTEGRATION.md'
  ]
};

// Obtener todos los archivos .md en el directorio actual
const docFiles = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.md'))
  .filter(file => file !== 'list-docs.js');

console.log('📚 Documentación Disponible en /docs\n');

// Mostrar documentos por categoría
Object.entries(categories).forEach(([category, expectedFiles]) => {
  const availableFiles = expectedFiles.filter(file => docFiles.includes(file));

  if (availableFiles.length > 0) {
    console.log(`${category}:`);
    availableFiles.forEach(file => {
      console.log(`  📄 ${file}`);
    });
    console.log('');
  }
});

// Mostrar documentos que no están categorizados
const categorizedFiles = Object.values(categories).flat();
const uncategorizedFiles = docFiles.filter(file => !categorizedFiles.includes(file));

if (uncategorizedFiles.length > 0) {
  console.log('📄 Documentos sin categorizar:');
  uncategorizedFiles.forEach(file => {
    console.log(`  📄 ${file}`);
  });
  console.log('');
}

console.log('💡 Para ver un documento:');
console.log('   cat docs/nombre-del-documento.md');
console.log('');
console.log('📖 Para ver el índice completo:');
console.log('   cat docs/README.md');
console.log('');
console.log('🔍 Búsqueda rápida por tema:');
console.log('   APIs: API_DOCUMENTATION.md, EA_API_ENDPOINTS.md');
console.log('   Cuentas Pendientes: PENDING_ACCOUNTS_*.md');
console.log('   Suscripciones: SUBSCRIPTION_*.md');
console.log('   Fixes: *_FIX.md');
console.log('   Debug: *_DEBUG.md');
