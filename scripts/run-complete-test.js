#!/usr/bin/env node
/**
 * Script Principal para Test Completo del Servidor
 *
 * Este script ejecuta el test completo de funcionalidad y luego limpia los datos
 * para mantener el sistema en un estado limpio.
 */
import { runCleanup } from './cleanup-test-data.js';
import { runCompleteTest } from './test-complete-server-functionality.js';

// Colores para console.log
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: msg => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  success: msg => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: msg => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  error: msg => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  step: msg => console.log(`\n${colors.cyan}🔹 ${msg}${colors.reset}`),
  header: msg => console.log(`\n${colors.magenta}${colors.bright}${msg}${colors.reset}`),
};

// Función para esperar
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Función principal
async function runFullTest() {
  log.header('🚀 INICIANDO TEST COMPLETO DEL SERVIDOR');
  log.info('Este script ejecutará todas las funcionalidades del servidor');
  log.info('y luego limpiará todos los datos de prueba');

  const startTime = Date.now();

  try {
    // Paso 1: Ejecutar test completo
    log.header('📋 PASO 1: EJECUTANDO TEST COMPLETO');
    await runCompleteTest();

    // Pausa entre test y limpieza
    log.step('Esperando 3 segundos antes de la limpieza...');
    await sleep(3000);

    // Paso 2: Limpiar datos de prueba
    log.header('🧹 PASO 2: LIMPIANDO DATOS DE PRUEBA');
    await runCleanup();

    // Resumen final
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    log.header('📊 RESUMEN FINAL');
    log.success(`✅ Test completo ejecutado exitosamente en ${duration} segundos`);
    log.info('El servidor está funcionando correctamente con todas las funcionalidades');
    log.info('Todos los datos de prueba han sido eliminados');
    log.info('El sistema está listo para uso normal');
  } catch (error) {
    log.error(`Error durante el test completo: ${error.message}`);
    console.error(error);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullTest();
}

export { runFullTest };
