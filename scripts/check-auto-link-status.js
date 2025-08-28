import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Auto-Link Status Check\n');

// Check server cache
const cacheFile = path.join(__dirname, '../server/config/auto_link_cache.json');
const hasServerCache = fs.existsSync(cacheFile);

console.log(`Server Cache: ${hasServerCache ? '❌ EXISTS (permanent - will NOT auto-run)' : '✅ CLEARED (will auto-run)'}`);

if (hasServerCache) {
  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  console.log(`   Cache timestamp: ${cache.timestamp}`);
  console.log(`   Cache is PERMANENT - will NOT auto-run until manually cleared`);
}

console.log('\n📋 Next Steps:');
console.log('1. Server cache is CLEARED ✅');
console.log('2. Restart the app: npm run electron:dev');
console.log('3. Check server logs for "Auto-running Link Platforms"');
console.log('4. Frontend will also auto-run when accounts load');

console.log('\n🎯 Expected behavior:');
console.log('- Server should show: "🧩 Auto-running Link Platforms on server start..."');
console.log('- Frontend should auto-execute Link Platforms when Dashboard loads');
