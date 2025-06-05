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

  // 4. Construir la aplicación
  console.log('🔨 Construyendo aplicación...');
  execSync('npm run electron:build', { stdio: 'inherit' });

  // 5. Crear tag de git
  console.log('🏷️  Creando tag de git...');
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

  // 6. Push cambios y tags
  console.log('📤 Subiendo cambios al repositorio...');
  execSync('git push', { stdio: 'inherit' });
  execSync('git push --tags', { stdio: 'inherit' });

  console.log('');
  console.log('🎉 ¡Release completado!');
  console.log(`📦 Versión: ${newVersion}`);
  console.log('🚀 La aplicación se distribuirá automáticamente a través de GitHub Releases');
  console.log('💫 Los usuarios recibirán notificación de actualización automáticamente');
} catch (error) {
  console.error('❌ Error durante el release:', error.message);
  process.exit(1);
}
