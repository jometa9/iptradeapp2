import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Ensure directories exist
const dirs = [
  'resources/dist',
  'resources/server',
  'resources/server/src',
  'resources/server/dist',
];

dirs.forEach(dir => {
  const fullPath = join(rootDir, dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
});

// Copy frontend build
copyDirectory(join(rootDir, 'dist'), join(rootDir, 'resources/dist'));

// Copy server files
copyDirectory(join(rootDir, 'server/dist'), join(rootDir, 'resources/server/dist'));

copyDirectory(join(rootDir, 'server/src'), join(rootDir, 'resources/server/src'));

// Copy package.json and other necessary files
const filesToCopy = [
  ['server/package.json', 'resources/server/package.json'],
  ['server/package-lock.json', 'resources/server/package-lock.json'],
];

filesToCopy.forEach(([src, dest]) => {
  const srcPath = join(rootDir, src);
  const destPath = join(rootDir, dest);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
  }
});

function copyDirectory(src, dest) {
  if (!existsSync(src)) {
    console.warn(`Source directory does not exist: ${src}`);
    return;
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);

    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
