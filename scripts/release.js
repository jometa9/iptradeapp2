#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const versionType = args[0]; // patch, minor, major

if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Uso: node scripts/release.js <patch|minor|major>');
  console.log('');
  console.log('Ejemplos:');
  console.log('  node scripts/release.js patch   # 1.0.0 -> 1.0.1');
  console.log('  node scripts/release.js minor   # 1.0.0 -> 1.1.0');
  console.log('  node scripts/release.js major   # 1.0.0 -> 2.0.0');
  process.exit(1);
}

console.log(`🚀 Iniciando release ${versionType}...`);

try {
  // 1. Verificar que el repositorio esté limpio
  console.log('📋 Verificando estado del repositorio...');
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.trim()) {
    console.error(
      '❌ El repositorio tiene cambios sin commitear. Haz commit o stash antes de continuar.'
    );
    process.exit(1);
  }

  // 2. Actualizar la versión
  console.log(`📦 Actualizando versión (${versionType})...`);
  execSync(`npm version ${versionType}`, { stdio: 'inherit' });

  // 3. Leer la nueva versión
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const newVersion = packageJson.version;
  console.log(`✅ Nueva versión: ${newVersion}`);

  // 4. Push cambios y tags (GitHub Actions se encarga del resto)
  console.log('📤 Subiendo cambios al repositorio...');
  execSync('git push', { stdio: 'inherit' });
  execSync('git push --tags', { stdio: 'inherit' });

  console.log('');
  console.log('🎉 ¡Release iniciado!');
  console.log(`📦 Versión: ${newVersion}`);
  console.log('🤖 GitHub Actions construirá y publicará automáticamente');
  console.log('⏱️  Espera 5-10 minutos para que se complete');
  console.log('📍 Ve el progreso en: https://github.com/jometa9/iptradeapp2/actions');
} catch (error) {
  console.error('❌ Error durante el release:', error.message);
  process.exit(1);
}
