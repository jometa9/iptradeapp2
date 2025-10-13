import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔨 Building IPTRADE Installer...');

// Ensure dist directory exists
const distPath = join(rootDir, 'dist');
if (!existsSync(distPath)) {
  console.error('❌ dist directory not found. Run "npm run build:all" first.');
  process.exit(1);
}

// Ensure release directory exists
const releasePath = join(rootDir, 'release');
if (!existsSync(releasePath)) {
  mkdirSync(releasePath, { recursive: true });
}

// Check if NSIS is installed
try {
  execSync('makensis /VERSION', { stdio: 'pipe' });
} catch (error) {
  console.error('❌ NSIS not found. Please install NSIS from https://nsis.sourceforge.io/');
  console.error('   Or use Chocolatey: choco install nsis');
  process.exit(1);
}

// Build the installer
console.log('📦 Compiling installer...');
try {
  execSync('makensis /V3 installer.nsi', { 
    cwd: rootDir,
    stdio: 'inherit' 
  });
  console.log('✅ Installer created successfully!');
  console.log(`📍 Location: ${join(releasePath, 'IPTRADE-Setup.exe')}`);
} catch (error) {
  console.error('❌ Failed to build installer');
  process.exit(1);
}

