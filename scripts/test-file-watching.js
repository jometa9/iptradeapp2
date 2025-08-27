import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simular el comportamiento del bot escribiendo un archivo CSV
const testFilePath = path.join(__dirname, '../csv_data/test_busy_file.csv');

console.log('🧪 Testing file watching with busy file handling...');

// Crear archivo de prueba
const testContent = `[TYPE] [PENDING] [MT5] [52381082]
[STATUS] [ONLINE] [${Math.floor(Date.now() / 1000)}]
[CONFIG] [PENDING] []`;

fs.writeFileSync(testFilePath, testContent, 'utf8');
console.log(`✅ Created test file: ${testFilePath}`);

// Función para simular lectura con manejo de archivos bloqueados
async function readFileWithRetry(filePath, maxRetries = 3, retryDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📖 Attempt ${attempt}/${maxRetries} to read file...`);
      
      const buffer = await new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            if (err.code === 'EBUSY' || err.code === 'EACCES') {
              console.log(`📁 File is busy (attempt ${attempt}), retrying...`);
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
      console.log('✅ Successfully read file content:');
      console.log(content);
      return content;

    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EACCES') {
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          console.warn(`⚠️ Failed to read file after ${maxRetries} attempts`);
          return null;
        }
      } else {
        console.error('❌ Unexpected error:', error);
        return null;
      }
    }
  }
}

// Simular el bot escribiendo el archivo continuamente
let writeInterval;
let readInterval;

async function startTest() {
  console.log('\n🚀 Starting file watching test...');
  
  // Simular escritura continua del bot
  writeInterval = setInterval(() => {
    const newContent = `[TYPE] [PENDING] [MT5] [52381082]
[STATUS] [ONLINE] [${Math.floor(Date.now() / 1000)}]
[CONFIG] [PENDING] []`;
    
    try {
      fs.writeFileSync(testFilePath, newContent, 'utf8');
      console.log('✍️ Bot wrote to file');
    } catch (error) {
      console.error('❌ Bot write error:', error.message);
    }
  }, 500); // Escribir cada 500ms

  // Simular lectura del servidor
  readInterval = setInterval(async () => {
    console.log('\n📡 Server attempting to read file...');
    await readFileWithRetry(testFilePath);
  }, 1000); // Leer cada 1 segundo

  // Detener después de 10 segundos
  setTimeout(() => {
    console.log('\n🛑 Stopping test...');
    clearInterval(writeInterval);
    clearInterval(readInterval);
    
    // Limpiar archivo de prueba
    try {
      fs.unlinkSync(testFilePath);
      console.log('🧹 Cleaned up test file');
    } catch (error) {
      console.error('❌ Error cleaning up:', error.message);
    }
    
    console.log('✅ Test completed');
    process.exit(0);
  }, 10000);
}

startTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
