import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta del archivo MT5 real que está causando problemas
const mt5FilePath = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv';

console.log('🧪 Testing MT5 file watching with busy file handling...');
console.log(`📁 Target file: ${mt5FilePath}`);

// Función para leer archivo con manejo de archivos bloqueados
async function readMT5FileWithRetry(filePath, maxRetries = 3, retryDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📖 Attempt ${attempt}/${maxRetries} to read MT5 file...`);
      
      const buffer = await new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            if (err.code === 'EBUSY' || err.code === 'EACCES') {
              console.log(`📁 MT5 file is busy (attempt ${attempt}), retrying...`);
              reject(err);
            } else {
              reject(err);
            }
          } else {
            resolve(data);
          }
        });
      });

      const content = buffer.toString('utf8');
      console.log('✅ Successfully read MT5 file content:');
      console.log('--- Content Start ---');
      console.log(content);
      console.log('--- Content End ---');
      return content;

    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EACCES') {
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          console.warn(`⚠️ Failed to read MT5 file after ${maxRetries} attempts`);
          return null;
        }
      } else {
        console.error('❌ Unexpected error:', error);
        return null;
      }
    }
  }
}

// Función para verificar si el archivo existe
function checkFileExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ MT5 file exists`);
      console.log(`📊 File size: ${stats.size} bytes`);
      console.log(`🕒 Last modified: ${stats.mtime}`);
      return true;
    } else {
      console.log(`❌ MT5 file does not exist`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking file:', error.message);
    return false;
  }
}

// Función principal de prueba
async function testMT5FileWatching() {
  console.log('\n🔍 Checking MT5 file status...');
  
  if (!checkFileExists(mt5FilePath)) {
    console.log('❌ Cannot proceed - MT5 file not found');
    return;
  }

  console.log('\n🚀 Starting MT5 file watching test...');
  console.log('📡 This will attempt to read the file every 2 seconds for 30 seconds...');
  
  let readCount = 0;
  let successCount = 0;
  let busyCount = 0;
  
  const readInterval = setInterval(async () => {
    readCount++;
    console.log(`\n📡 Read attempt #${readCount}...`);
    
    const content = await readMT5FileWithRetry(mt5FilePath);
    
    if (content) {
      successCount++;
      console.log(`✅ Read successful (${successCount}/${readCount})`);
    } else {
      busyCount++;
      console.log(`⚠️ File busy (${busyCount}/${readCount})`);
    }
  }, 2000); // Leer cada 2 segundos

  // Detener después de 30 segundos
  setTimeout(() => {
    console.log('\n🛑 Stopping MT5 file watching test...');
    clearInterval(readInterval);
    
    console.log('\n📊 Test Results:');
    console.log(`📈 Total read attempts: ${readCount}`);
    console.log(`✅ Successful reads: ${successCount}`);
    console.log(`⚠️ Busy file errors: ${busyCount}`);
    console.log(`📊 Success rate: ${((successCount / readCount) * 100).toFixed(1)}%`);
    
    if (busyCount > 0) {
      console.log('\n💡 Recommendations:');
      console.log('- The file is being written by the MT5 bot');
      console.log('- The new async file reading should handle this better');
      console.log('- Consider increasing retry delay if needed');
    }
    
    console.log('\n✅ MT5 file watching test completed');
    process.exit(0);
  }, 30000);
}

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Iniciar prueba
testMT5FileWatching().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
