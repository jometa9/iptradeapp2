import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the auto-link cache file
const AUTO_LINK_CACHE_FILE = path.join(__dirname, '../server/config/auto-link-cache.json');

console.log('🧹 Clearing auto-link cache...');

try {
  // Check if cache file exists
  if (fs.existsSync(AUTO_LINK_CACHE_FILE)) {
    // Read current cache
    const cache = JSON.parse(fs.readFileSync(AUTO_LINK_CACHE_FILE, 'utf8'));
    console.log('📋 Current cache:', cache);
    
    // Delete the cache file
    fs.unlinkSync(AUTO_LINK_CACHE_FILE);
    console.log('✅ Auto-link cache file deleted');
  } else {
    console.log('ℹ️ No auto-link cache file found');
  }

  // Also clear localStorage cache (frontend)
  console.log('💡 To clear frontend cache, restart the app or clear browser localStorage');
  console.log('   localStorage.removeItem("iptrade_auto_link_executed")');
  
  console.log('🎯 Next time you start the app, Link Platforms will run automatically!');
  
} catch (error) {
  console.error('❌ Error clearing cache:', error.message);
}
