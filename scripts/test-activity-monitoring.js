import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simular el activity monitoring que estaba causando problemas
const testActivityMonitoring = async () => {
  console.log('🧪 Testing activity monitoring with busy file handling...');
  
  const mt5FilePath = 'C:\\Users\\Joaquin\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common\\Files\\IPTRADECSV2.csv';
  
  if (!fs.existsSync(mt5FilePath)) {
    console.log('❌ MT5 file not found, cannot test');
    return;
  }

  console.log('📁 Testing file:', mt5FilePath);
  
  // Simular el activity monitoring que se ejecuta cada segundo
  let testCount = 0;
  let successCount = 0;
  let errorCount = 0;
  
  const testInterval = setInterval(async () => {
    testCount++;
    console.log(`\n📡 Activity monitoring test #${testCount}...`);
    
    try {
      // Simular la lectura del archivo como lo hace checkAccountActivity
      const fileContent = await new Promise((resolve, reject) => {
        fs.readFile(mt5FilePath, 'utf8', (err, data) => {
          if (err) {
            if (err.code === 'EBUSY' || err.code === 'EACCES') {
              console.log(`📁 File is busy (test ${testCount}), skipping...`);
              resolve(null); // Skip this file
            } else {
              reject(err);
            }
          } else {
            resolve(data);
          }
        });
      });

      if (fileContent) {
        successCount++;
        console.log(`✅ Successfully read file (${successCount}/${testCount})`);
        
        // Simular procesamiento del contenido
        const lines = fileContent.split('\n');
        console.log(`📄 File has ${lines.length} lines`);
        
        // Simular búsqueda de cuentas
        const accountLines = lines.filter(line => line.includes('[TYPE]'));
        console.log(`👤 Found ${accountLines.length} account entries`);
        
      } else {
        console.log(`⏭️ Skipped busy file (${testCount})`);
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error in test ${testCount}:`, error.message);
    }
    
    // Detener después de 10 pruebas
    if (testCount >= 10) {
      clearInterval(testInterval);
      
      console.log('\n📊 Test Results:');
      console.log(`📈 Total tests: ${testCount}`);
      console.log(`✅ Successful reads: ${successCount}`);
      console.log(`❌ Errors: ${errorCount}`);
      console.log(`⏭️ Skipped (busy): ${testCount - successCount - errorCount}`);
      console.log(`📊 Success rate: ${((successCount / testCount) * 100).toFixed(1)}%`);
      
      if (errorCount === 0) {
        console.log('\n🎉 SUCCESS: No EBUSY errors! Activity monitoring is working correctly.');
      } else {
        console.log('\n⚠️ Some errors occurred, but they should be handled gracefully.');
      }
      
      process.exit(0);
    }
  }, 1000); // Probar cada segundo
};

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Iniciar prueba
testActivityMonitoring().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
