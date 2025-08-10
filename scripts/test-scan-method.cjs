const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function testScanMethod() {
  console.log('🧪 Testing scanSimplifiedPendingCSVFiles method simulation\n');

  // Buscar todos los archivos IPTRADECSV2.csv en el sistema
  const patterns = [
    '**/IPTRADECSV2.csv',
    '**/csv_data/**/IPTRADECSV2.csv',
    '**/accounts/**/IPTRADECSV2.csv',
  ];

  const allFiles = [];
  const currentTime = new Date();

  console.log('🔍 Searching for files...');

  for (const pattern of patterns) {
    try {
      console.log(`\n📁 Processing pattern: ${pattern}`);

      // Si es una ruta absoluta específica, agregarla directamente
      if (pattern.startsWith('/')) {
        if (fs.existsSync(pattern)) {
          allFiles.push(pattern);
          console.log(`✅ Added specific path: ${pattern}`);
        } else {
          console.log(`❌ Specific path does not exist: ${pattern}`);
        }
      } else {
        // Usar glob para patrones
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/.git/**'],
          absolute: true,
        });
        console.log(`📋 Found ${files.length} files with pattern: ${pattern}`);
        files.forEach(file => console.log(`   - ${file}`));
        allFiles.push(...files);
      }
    } catch (error) {
      console.error(`❌ Error searching pattern ${pattern}:`, error);
    }
  }

  console.log(`\n📊 Total files found: ${allFiles.length}`);
  allFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });

  // Procesar archivos encontrados
  const validPendingAccounts = [];

  console.log('\n🔍 Processing files for pending accounts...');

  for (const filePath of allFiles) {
    try {
      console.log(`\n📄 Processing file: ${filePath}`);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        console.log(`   Lines: ${lines.length}`);
        if (lines.length > 0) {
          console.log(`   First line: ${lines[0]}`);
        }

        if (lines.length < 2) {
          console.log(`   ⏭️ Skipping - not enough lines`);
          continue;
        }

        // Verificar si es el nuevo formato simplificado [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
        const firstDataLine = lines[1]; // Primera línea de datos (después del header)
        const values = firstDataLine.split(',').map(v => v.trim());

        console.log(`   First data line: ${firstDataLine}`);
        console.log(`   Values: [${values.join(', ')}]`);

        // Verificar si el primer valor es "0" (indicador de pending)
        if (values[0] === '0' && values.length >= 5) {
          console.log(`   ✅ Processing simplified pending format`);

          // Procesar todas las líneas de datos
          for (let i = 1; i < lines.length; i++) {
            const lineValues = lines[i].split(',').map(v => v.trim());

            // Verificar formato: [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
            if (lineValues[0] === '0' && lineValues.length >= 5) {
              const account = {
                pending_indicator: lineValues[0], // "0"
                account_id: lineValues[1],
                platform: lineValues[2],
                status: lineValues[3],
                timestamp: lineValues[4],
                account_type: 'pending', // Siempre pending para este formato
              };

              console.log(`   📱 Found account: ${account.account_id} (${account.platform})`);

              if (account.account_id && account.timestamp) {
                // Función helper para parsear timestamp (Unix o ISO)
                const parseTimestamp = timestamp => {
                  // Si es un número (Unix timestamp en segundos)
                  if (!isNaN(timestamp) && timestamp.toString().length === 10) {
                    return new Date(parseInt(timestamp) * 1000);
                  }
                  // Si es un número más largo (Unix timestamp en milisegundos)
                  if (!isNaN(timestamp) && timestamp.toString().length === 13) {
                    return new Date(parseInt(timestamp));
                  }
                  // Si es string ISO o cualquier otro formato
                  return new Date(timestamp);
                };

                const accountTime = parseTimestamp(account.timestamp);
                const timeDiff = (currentTime - accountTime) / 1000; // diferencia en segundos

                console.log(`   ⏰ Time diff: ${timeDiff.toFixed(1)}s`);

                // Solo incluir si no ha pasado más de 1 hora
                if (timeDiff <= 3600) {
                  // Determinar status basado en el tiempo transcurrido
                  account.current_status = timeDiff <= 5 ? 'online' : 'offline';
                  account.timeDiff = timeDiff;
                  account.filePath = filePath;
                  validPendingAccounts.push(account);
                  console.log(
                    `   ✅ Added pending account: ${account.account_id} (${account.platform}) - ${account.current_status}`
                  );
                } else {
                  console.log(
                    `   ⏰ Ignoring account ${account.account_id} - too old (${(timeDiff / 60).toFixed(1)} minutes)`
                  );
                }
              }
            }
          }
        } else {
          console.log(`   ❌ Not simplified pending format`);
        }
      } else {
        console.log(`   ❌ File does not exist`);
      }
    } catch (error) {
      console.error(`   ❌ Error processing file ${filePath}:`, error);
    }
  }

  console.log(`\n🎉 Scan completed!`);
  console.log(`📊 Found ${validPendingAccounts.length} valid pending accounts`);

  validPendingAccounts.forEach((account, index) => {
    console.log(
      `   ${index + 1}. ${account.account_id} (${account.platform}) - ${account.current_status} - ${account.filePath}`
    );
  });
}

testScanMethod();
