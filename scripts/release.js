#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const versionType = args[0]; // patch, minor, major

if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Usage: node scripts/release.js <patch|minor|major>');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/release.js patch   # 1.0.0 -> 1.0.1');
  console.log('  node scripts/release.js minor   # 1.0.0 -> 1.1.0');
  console.log('  node scripts/release.js major   # 1.0.0 -> 2.0.0');
  process.exit(1);
}

console.log(`🚀 Starting ${versionType} release...`);

try {
  // 1. Check that the repository is clean
  console.log('📋 Checking repository status...');
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.trim()) {
    console.error('❌ Repository has uncommitted changes. Commit or stash before continuing.');
    process.exit(1);
  }

  // 2. Update version
  console.log(`📦 Updating version (${versionType})...`);
  execSync(`npm version ${versionType}`, { stdio: 'inherit' });

  // 3. Read the new version
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const newVersion = packageJson.version;
  console.log(`✅ New version: ${newVersion}`);

  // 4. Push changes and tags (GitHub Actions handles the rest)
  console.log('📤 Pushing changes to repository...');
  execSync('git push', { stdio: 'inherit' });
  execSync('git push --tags', { stdio: 'inherit' });

  console.log('');
  console.log('🎉 Release started!');
  console.log(`📦 Version: ${newVersion}`);
  console.log('🤖 GitHub Actions will build and publish automatically');
  console.log('⏱️  Wait 5-10 minutes for completion');
  console.log('📍 See progress at: https://github.com/jometa9/iptradeapp2/actions');
} catch (error) {
  console.error('❌ Error during release:', error.message);
  process.exit(1);
}
