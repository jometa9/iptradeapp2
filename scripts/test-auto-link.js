import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Auto-Link Platforms functionality...\n');

// 1. Check server cache
const AUTO_LINK_CACHE_FILE = path.join(__dirname, '../server/config/auto-link-cache.json');
console.log('1️⃣ Checking server cache...');

if (fs.existsSync(AUTO_LINK_CACHE_FILE)) {
  const cache = JSON.parse(fs.readFileSync(AUTO_LINK_CACHE_FILE, 'utf8'));
  const cacheTime = new Date(cache.timestamp);
  const now = new Date();
  const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
  
  console.log(`   📋 Cache found: ${cache.timestamp}`);
  console.log(`   ⏰ Cache timestamp: ${cache.timestamp}`);
  console.log(`   🔄 Will auto-run: NO (permanent cache)`);
} else {
  console.log('   ❌ No server cache found - will auto-run on startup');
}

// 2. Check if Link Platforms controller exists
const LINK_PLATFORMS_CONTROLLER = path.join(__dirname, '../server/src/controllers/linkPlatformsController.js');
console.log('\n2️⃣ Checking Link Platforms controller...');

if (fs.existsSync(LINK_PLATFORMS_CONTROLLER)) {
  console.log('   ✅ Link Platforms controller found');
} else {
  console.log('   ❌ Link Platforms controller not found');
}

// 3. Check auto-link hook
const AUTO_LINK_HOOK = path.join(__dirname, '../src/hooks/useAutoLinkPlatforms.ts');
console.log('\n3️⃣ Checking auto-link hook...');

if (fs.existsSync(AUTO_LINK_HOOK)) {
  console.log('   ✅ Auto-link hook found');
} else {
  console.log('   ❌ Auto-link hook not found');
}

// 4. Check if Dashboard uses the hook
const DASHBOARD = path.join(__dirname, '../src/components/Dashboard.tsx');
console.log('\n4️⃣ Checking Dashboard integration...');

if (fs.existsSync(DASHBOARD)) {
  const dashboardContent = fs.readFileSync(DASHBOARD, 'utf8');
  if (dashboardContent.includes('useAutoLinkPlatforms')) {
    console.log('   ✅ Dashboard uses auto-link hook');
  } else {
    console.log('   ❌ Dashboard does not use auto-link hook');
  }
} else {
  console.log('   ❌ Dashboard not found');
}

// 5. Instructions
console.log('\n📋 Instructions to test auto-link:');
console.log('   1. Clear server cache: delete server/config/auto_link_cache.json');
console.log('   2. Clear frontend cache: localStorage.removeItem("iptrade_auto_link_executed")');
console.log('   3. Restart the app with: npm run electron:dev');
console.log('   4. Check server logs for "Auto-running Link Platforms" message');
console.log('   5. Check frontend for auto-execution when accounts load');

console.log('\n🎯 Auto-link should run when:');
console.log('   - Server starts (if cache is manually cleared)');
console.log('   - Frontend loads accounts (if localStorage cache is cleared)');
console.log('   - Cache duration: PERMANENT (server) / until cleared (frontend)');
