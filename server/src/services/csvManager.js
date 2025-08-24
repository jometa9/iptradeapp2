import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { basename, join } from 'path';

import { validateBeforeWrite } from './csvValidator2.js';
import { detectOrderChanges } from './orderChangeDetector.js';

class CSVManager extends EventEmitter {
  constructor() {
    super();
    this.csvFiles = new Map(); // Cache de archivos CSV encontrados
    this.watchers = new Map(); // File watchers
    this.scanTimer = null; // Timer para escaneo periódico (deshabilitado por defecto)
    this.debounceTimers = new Map(); // Debounce por archivo para eventos de watch
    this.debounceTimeoutMs = 400; // Ventana de debounce para agrupar cambios de archivo
    this.csvDirectory = join(process.cwd(), 'csv_data');
    this.heartbeatInterval = null; // Para el heartbeat de los watchers
    this.pollingInterval = null; // Para el polling de archivos
    this.pendingEvaluationInterval = null; // Para re-evaluar cuentas pendientes
    this.init();
  }

  init() {
    // Inicializar el estado global del copier
    this.initGlobalCopierStatus();

    // Crear directorio si no existe
    if (!existsSync(this.csvDirectory)) {
      mkdirSync(this.csvDirectory, { recursive: true });
    }

    // Cargar rutas desde cache si existen (como fallback)
    const cachedPaths = this.loadCSVPathsFromCache();
    if (cachedPaths.length > 0) {
      console.log(`📋 CSV Manager initialized - loaded ${cachedPaths.length} cached CSV paths`);
      // Cargar archivos desde cache
      cachedPaths.forEach(filePath => {
        if (existsSync(filePath) && !this.csvFiles.has(filePath)) {
          this.csvFiles.set(filePath, {
            lastModified: this.getFileLastModified(filePath),
            data: this.parseCSVFile(filePath),
          });
        }
      });
    }

    // Iniciar file watching si hay archivos cargados
    if (this.csvFiles.size > 0) {
      console.log(`👀 Starting file watching for ${this.csvFiles.size} CSV files`);
      this.startFileWatching();
    }
  }

  // Parse new CSV2 format: [TYPE][PENDING][MT4][12345] or [TYPE] [PENDING] [MT4] [12345]
  parseCSV2Format(lines, filePath, currentTime) {
    try {
      if (lines.length < 3) return null; // Need at least TYPE, STATUS, CONFIG lines

      let typeData = null;
      let statusData = null;
      let configData = null;

      // Parse each line looking for the CSV2 format
      for (const line of lines) {
        // Handle both formats: [TYPE] and [TYPE] (with spaces)
        if (line.includes('[TYPE]')) {
          const matches = line.match(/\[([^\]]+)\]/g);
          if (matches && matches.length >= 4) {
            const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
            typeData = {
              type: values[1], // PENDING, MASTER, SLAVE
              platform: values[2], // MT4, MT5, CTRADER
              accountId: values[3], // Account ID
            };
          }
        } else if (line.includes('[STATUS]')) {
          const matches = line.match(/\[([^\]]+)\]/g);
          if (matches && matches.length >= 3) {
            const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
            statusData = {
              status: values[1], // ONLINE, OFFLINE
              timestamp: parseInt(values[2]), // Unix timestamp
            };
          }
        } else if (line.includes('[CONFIG]')) {
          const matches = line.match(/\[([^\]]+)\]/g);
          if (matches && matches.length >= 2) {
            const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
            configData = {
              configType: values[1], // PENDING, MASTER, SLAVE
              details: values.slice(2), // Additional config details
            };
          }
        }
      }

      // Process all account types (PENDING, MASTER, SLAVE)
      if (typeData && statusData && configData) {
        const accountTime = statusData.timestamp * 1000; // Convert to milliseconds
        const timeDiff = (currentTime - accountTime) / 1000; // Difference in seconds

        // Only include if not older than 1 hour
        if (timeDiff <= 3600) {
          const account = {
            account_id: typeData.accountId,
            platform: typeData.platform,
            account_type: configData.configType.toLowerCase(), // Use CONFIG as source of truth
            status: timeDiff <= 5 ? 'online' : 'offline',
            current_status: timeDiff <= 5 ? 'online' : 'offline',
            timestamp: statusData.timestamp,
            timeDiff: timeDiff,
            filePath: filePath,
            format: 'csv2',
          };

          // Add config details for SLAVE accounts
          if (configData.configType === 'SLAVE' && configData.details.length >= 6) {
            account.config = {
              enabled: configData.details[1] === 'ENABLED',
              lotMultiplier: parseFloat(configData.details[2]) || 1,
              forceLot: configData.details[3] === 'NULL' ? null : parseFloat(configData.details[3]),
              reverseTrading: configData.details[4] === 'TRUE',
              masterId: configData.details[5] === 'NULL' ? null : configData.details[5],
              masterCsvPath: configData.details[6] || null,
            };
          } else if (configData.configType === 'MASTER') {
            account.config = {
              enabled: configData.details[1] === 'ENABLED',
              name: configData.details[2] || `Account ${typeData.accountId}`,
            };
          }

          console.log(
            `📱 Found CSV2 ${configData.configType.toLowerCase()} account ${account.account_id} (${account.platform}) - ${account.status} (${timeDiff.toFixed(1)}s ago)`
          );
          return account;
        } else {
          console.log(
            `⏰ Ignoring CSV2 account ${typeData.accountId} - too old (${(timeDiff / 60).toFixed(1)} minutes)`
          );
        }
      }

      return null;
    } catch (error) {
      console.error(`Error parsing CSV2 format in ${filePath}:`, error);
      return null;
    }
  }

  // Nuevo método para escanear archivos pending simplificados
  async scanPendingCSVFiles() {
    try {
      // Solo loguear si hay archivos para escanear
      if (this.csvFiles.size > 0) {
        console.log('🔍 Scanning for simplified pending CSV files...');
      }

      // Buscar todos los archivos IPTRADECSV2.csv en el sistema
      const patterns = [
        '**/IPTRADECSV2.csv',
        '**/csv_data/**/IPTRADECSV2.csv',
        '**/accounts/**/IPTRADECSV2.csv',
      ];

      const allFiles = [];
      const currentTime = new Date();

      for (const pattern of patterns) {
        try {
          const files = await glob(pattern, {
            ignore: ['**/node_modules/**', '**/.git/**'],
            absolute: true,
          });
          allFiles.push(...files);
        } catch (error) {
          console.error(`Error searching pattern ${pattern}:`, error);
        }
      }

      // Procesar archivos encontrados
      const validPendingAccounts = [];

      for (const filePath of allFiles) {
        try {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            const sanitizedContent = content.replace(/\uFEFF/g, '').replace(/\r/g, '');
            const lines = sanitizedContent.split('\n').filter(line => line.trim());

            if (lines.length < 2) continue; // Sin datos válidos

            const headers = lines[0].split(',').map(h => h.trim());

            // Verificar que sea el formato simplificado para pending
            const expectedHeaders = ['timestamp', 'account_id', 'account_type', 'platform'];
            const isSimplifiedFormat = expectedHeaders.every(h => headers.includes(h));

            if (!isSimplifiedFormat) {
              console.log(`📄 Skipping ${filePath} - not simplified pending format`);
              continue;
            }

            // Procesar solo la línea de datos (asumiendo un solo account por archivo)
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              const account = {};

              headers.forEach((header, index) => {
                account[header] = values[index];
              });

              if (account.account_type === 'pending' && account.timestamp && account.account_id) {
                const accountTime = this.parseTimestamp(account.timestamp);
                const timeDiff = (currentTime - accountTime) / 1000; // diferencia en segundos

                // Solo incluir si no ha pasado más de 1 hora
                if (timeDiff <= 3600) {
                  // 3600 segundos = 1 hora
                  account.status = timeDiff <= 5 ? 'online' : 'offline';
                  account.timeDiff = timeDiff;
                  account.filePath = filePath;
                  validPendingAccounts.push(account);
                  console.log(
                    `📱 Found pending account ${account.account_id} (${account.platform}) - ${account.status} (${timeDiff.toFixed(1)}s ago) - Timestamp: ${account.timestamp}`
                  );
                } else {
                  console.log(
                    `⏰ Ignoring account ${account.account_id} - too old (${(timeDiff / 60).toFixed(1)} minutes) - Timestamp: ${account.timestamp}`
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }

      // Solo loguear cuando hay archivos o cuentas pendientes
      if (allFiles.length > 0 || validPendingAccounts.length > 0) {
        console.log(
          `✅ Found ${validPendingAccounts.length} valid pending accounts from ${allFiles.length} CSV files`
        );
      }
      return validPendingAccounts;
    } catch (error) {
      console.error('Error scanning pending CSV files:', error);
      return [];
    }
  }

  // Función helper para parsear timestamp (Unix o ISO)
  parseTimestamp(timestamp) {
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
  }

  // Nuevo método para escanear archivos pending con formato simplificado [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
  async scanSimplifiedPendingCSVFiles() {
    try {
      console.log('🔍 Scanning for simplified pending CSV files with [0] format...');

      // Preferir archivos ya observados (válidos). Si no hay, usar búsqueda amplia como fallback
      let allFiles = [];
      if (this.csvFiles.size > 0) {
        allFiles = Array.from(this.csvFiles.keys());
      } else {
        const patterns = [
          '**/IPTRADECSV2.csv',
          '**/csv_data/**/IPTRADECSV2.csv',
          '**/accounts/**/IPTRADECSV2.csv',
          process.env.HOME + '/**/IPTRADECSV2.csv',
        ];
        for (const pattern of patterns) {
          try {
            const files = await glob(pattern, {
              ignore: ['**/node_modules/**', '**/.git/**'],
              absolute: true,
            });
            allFiles.push(...files);
          } catch (error) {
            console.error(`Error searching pattern ${pattern}:`, error);
          }
        }
      }
      const currentTime = new Date();

      // Procesar archivos encontrados
      const validPendingAccounts = [];

      for (const filePath of allFiles) {
        try {
          if (existsSync(filePath)) {
            // Leer como buffer para detectar encoding
            const buffer = readFileSync(filePath);
            let content;

            // Detectar UTF-16 LE BOM (FF FE)
            if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
              content = buffer.toString('utf16le');
            } else {
              content = buffer.toString('utf8');
            }

            const lines = content.split('\n').filter(line => line.trim());

            // Check if this is the new CSV2 format first
            const csv2Account = this.parseCSV2Format(lines, filePath, currentTime);
            if (csv2Account) {
              validPendingAccounts.push(csv2Account);
              continue;
            }

            // Log detallado del contenido del archivo
            console.log(`\n📄 === CSV FILE CONTENT ===`);
            console.log(`📁 File: ${filePath}`);
            console.log(`📊 Total lines: ${lines.length}`);
            console.log(`📋 Raw content:`);
            console.log(content);
            console.log(`📋 Processed lines:`);
            lines.forEach((line, index) => {
              console.log(`   Line ${index + 1}: "${line}"`);
            });
            console.log(`📄 === END CSV CONTENT ===\n`);

            if (lines.length < 1) continue; // Sin datos válidos

            // Verificar si es el nuevo formato simplificado [N][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
            const firstDataLineRaw = lines[0];
            const firstDataLine = firstDataLineRaw
              .replace(/\uFEFF/g, '')
              .replace(/\r/g, '')
              // eliminar cualquier basura/no ASCII antes del primer '['
              .replace(/^[^\[]+/, '');

            // Detectar formato: con corchetes [0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP] o con comas 0,ACCOUNT_ID,PLATFORM,STATUS,TIMESTAMP
            let values;
            let isBracketFormat = false;

            if (firstDataLine.includes('[') && firstDataLine.includes(']')) {
              // Formato con corchetes: [0][250062001][MT4][PENDING][1754866078]
              isBracketFormat = true;
              values =
                firstDataLine.match(/\[([^\]]+)\]/g)?.map(v => v.replace(/[\[\]]/g, '').trim()) ||
                [];
            } else {
              // Formato con comas: 0,250062001,MT4,PENDING,1754866078
              values = firstDataLine.split(',').map(v => v.trim());
            }

            // Sanitizar tokens para evitar caracteres invisibles
            const sanitizeToken = t => (t || '').replace(/[^\x20-\x7E]/g, '').trim();
            values = values.map(sanitizeToken);

            // Log detallado para debugging
            console.log(`🔍 DEBUG - File: ${filePath}`);
            console.log(`   📄 First data line: ${firstDataLine}`);
            console.log(`   🔍 Format: ${isBracketFormat ? 'Brackets' : 'Commas'}`);
            console.log(`   📋 Values count: ${values.length}`);
            console.log(`   📋 Values: [${values.join(', ')}]`);
            const isFirstNumeric = /^\d+$/.test((values[0] || '').trim());
            console.log(
              `   🔍 First value ${isBracketFormat ? 'numeric' : 'is "0"'}: ${
                isBracketFormat ? isFirstNumeric : values[0] === '0'
              }`
            );
            console.log(`   🔍 Has 5+ values: ${values.length >= 5}`);

            // Verificar si el primer valor es "0" (indicador de pending)
            if (
              (isBracketFormat && /^\d+$/.test(values[0] || '') && values.length >= 4) ||
              (!isBracketFormat && values[0] === '0' && values.length >= 4)
            ) {
              console.log(`📄 Processing simplified pending format: ${filePath}`);

              // Procesar todas las líneas de datos
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let lineValues;

                // Detectar formato de la línea actual
                if (line.includes('[') && line.includes(']')) {
                  // Formato con corchetes
                  const normalizedLine = line
                    .replace(/\uFEFF/g, '')
                    .replace(/\r/g, '')
                    .replace(/^[^\[]+/, '');
                  lineValues =
                    normalizedLine
                      .replace(/\uFEFF/g, '')
                      .match(/\[([^\]]+)\]/g)
                      ?.map(v => v.replace(/[\[\]]/g, '').trim()) || [];
                } else {
                  // Formato con comas
                  lineValues = line.split(',').map(v => v.trim());
                }

                // Sanitizar tokens
                lineValues = lineValues.map(sanitizeToken);

                // Verificar formato: [N][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP] o 0,ACCOUNT_ID,PLATFORM,STATUS,TIMESTAMP
                const lineIsBracket = line.includes('[') && line.includes(']');
                const isValidBracket =
                  lineIsBracket && /^\d+$/.test(lineValues[0] || '') && lineValues.length >= 4;
                const isValidComma =
                  !lineIsBracket && lineValues[0] === '0' && lineValues.length >= 4;
                if (isValidBracket || isValidComma) {
                  const account = {
                    pending_indicator: lineValues[0], // número en bracket o "0" en comas
                    account_id: lineValues[1],
                    platform: lineValues[2],
                    status: lineValues[3],
                    timestamp: lineValues[4] || '', // Puede no tener timestamp
                    account_type:
                      lineValues[3] === 'PENDING' ? 'pending' : lineValues[3].toLowerCase(), // Solo pending si realmente dice PENDING
                  };

                  // Solo procesar cuentas que realmente están en estado PENDING
                  if (account.status === 'PENDING' && account.account_id && account.timestamp) {
                    const accountTime = this.parseTimestamp(account.timestamp);
                    const timeDiff = (currentTime - accountTime) / 1000; // diferencia en segundos

                    // Solo incluir si no ha pasado más de 1 hora
                    if (timeDiff <= 3600) {
                      // Determinar status basado en el tiempo transcurrido (usar valor absoluto)
                      const absTimeDiff = Math.abs(timeDiff);
                      account.current_status = absTimeDiff <= 5 ? 'online' : 'offline';
                      account.timeDiff = timeDiff;
                      account.filePath = filePath;
                      validPendingAccounts.push(account);
                      console.log(
                        `📱 Found pending account ${account.account_id} (${account.platform}) - ${account.current_status} (${timeDiff.toFixed(1)}s ago) - Timestamp: ${account.timestamp}`
                      );
                      if (account.current_status === 'offline') {
                        console.log(
                          `🔴 Account ${account.account_id} is OFFLINE - absolute time difference: ${absTimeDiff.toFixed(1)}s > 5s threshold`
                        );
                      } else {
                        console.log(
                          `🟢 Account ${account.account_id} is ONLINE - absolute time difference: ${absTimeDiff.toFixed(1)}s <= 5s threshold`
                        );
                      }
                    } else {
                      console.log(
                        `⏰ Ignoring account ${account.account_id} - too old (${(timeDiff / 60).toFixed(1)} minutes) - Timestamp: ${account.timestamp}`
                      );
                    }
                  } else if (account.account_id) {
                    // Log cuando se encuentra una cuenta que no está en estado PENDING
                    console.log(
                      `ℹ️ Found non-pending account ${account.account_id} (${account.platform}) - Status: ${account.status} - Skipping (not pending)`
                    );
                  }
                }
              }
            } else {
              // Log cuando no se detecta el formato simplificado
              console.log(`❌ DEBUG - File: ${filePath} - Not simplified pending format`);
              console.log(`   📄 Header: ${lines[0]}`);
              console.log(`   📄 First data line: ${firstDataLine}`);
              console.log(`   📋 Values: [${values.join(', ')}]`);
              console.log(`   🔍 Expected: First value "0" and 5+ values`);
              console.log(`   🔍 Actual: First value "${values[0]}" and ${values.length} values`);

              // Si no es el formato simplificado, intentar con el formato anterior
              const headers = lines[0].split(',').map(h => h.trim());
              const expectedHeaders = ['timestamp', 'account_id', 'account_type', 'platform'];
              const isSimplifiedFormat = expectedHeaders.every(h => headers.includes(h));

              if (isSimplifiedFormat) {
                console.log(`📄 Processing legacy simplified format: ${filePath}`);

                for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split(',').map(v => v.trim());
                  const account = {};

                  headers.forEach((header, index) => {
                    account[header] = values[index];
                  });

                  if (
                    account.account_type === 'pending' &&
                    account.timestamp &&
                    account.account_id
                  ) {
                    const accountTime = new Date(account.timestamp);
                    const timeDiff = (currentTime - accountTime) / 1000;

                    if (timeDiff <= 3600) {
                      account.current_status = timeDiff <= 5 ? 'online' : 'offline';
                      account.timeDiff = timeDiff;
                      account.filePath = filePath;
                      validPendingAccounts.push(account);
                      console.log(
                        `📱 Found legacy pending account ${account.account_id} (${account.platform}) - ${account.current_status} (${timeDiff.toFixed(1)}s ago)`
                      );
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }

      console.log(
        `✅ Found ${validPendingAccounts.length} valid pending accounts from ${allFiles.length} CSV files`
      );
      return validPendingAccounts;
    } catch (error) {
      console.error('Error scanning simplified pending CSV files:', error);
      return [];
    }
  }

  // Guardar rutas encontradas en cache
  saveCSVPathsToCache() {
    try {
      const cachePath = join(
        process.cwd(),
        'server',
        'server',
        'config',
        'csv_watching_cache.json'
      );
      const csvFiles = Array.from(this.csvFiles.keys());

      console.log(`🔍 Intentando guardar cache en: ${cachePath}`);
      console.log(`📁 Archivos CSV a guardar: ${csvFiles.length}`);

      // Crear directorio si no existe
      const cacheDir = join(process.cwd(), 'server', 'server', 'config');
      console.log(`📁 Directorio cache: ${cacheDir}`);

      if (!existsSync(cacheDir)) {
        console.log(`📁 Creando directorio: ${cacheDir}`);
        require('fs').mkdirSync(cacheDir, { recursive: true });
      }

      const cacheData = {
        csvFiles: csvFiles,
        timestamp: new Date().toISOString(),
        version: '1.0',
        totalFiles: csvFiles.length,
        lastScan: new Date().toISOString(),
      };

      console.log(`📝 Escribiendo archivo...`);
      writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');

      // Verificar que se escribió
      if (existsSync(cachePath)) {
        const stats = statSync(cachePath);
        console.log(`✅ Cache guardado exitosamente: ${csvFiles.length} archivos CSV`);
        console.log(`📏 Tamaño del archivo: ${stats.size} bytes`);
      } else {
        console.log(`❌ El archivo no se creó después de escribir`);
      }
    } catch (error) {
      console.error('❌ Error guardando cache:', error.message);
      console.error('❌ Stack trace:', error.stack);
    }
  }

  // Cargar rutas desde cache
  loadCSVPathsFromCache() {
    try {
      const cachePath = join(
        process.cwd(),
        'server',
        'server',
        'config',
        'csv_watching_cache.json'
      );

      if (existsSync(cachePath)) {
        const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
        console.log(`📋 Cache cargado: ${cacheData.csvFiles.length} archivos CSV`);
        return cacheData.csvFiles;
      } else {
        // Si no existe, crear un cache vacío
        const cacheDir = join(process.cwd(), 'server', 'server', 'config');
        if (!existsSync(cacheDir)) {
          mkdirSync(cacheDir, { recursive: true });
        }

        const emptyCache = {
          csvFiles: [],
          timestamp: new Date().toISOString(),
          version: '1.0',
          totalFiles: 0,
          lastScan: new Date().toISOString(),
        };

        writeFileSync(cachePath, JSON.stringify(emptyCache, null, 2), 'utf8');
        console.log(`📁 Cache creado: archivo vacío en ${cachePath}`);
        return [];
      }
    } catch (error) {
      console.error('❌ Error cargando cache:', error.message);
    }
    return [];
  }

  // Escanear todos los archivos IPTRADECSV2.csv en el sistema (método original)
  async scanCSVFiles() {
    try {
      // Cargar configuración de ubicaciones
      const configPath = join(process.cwd(), 'server', 'config', 'csv_locations.json');
      let config = {
        csvLocations: [],
        searchPatterns: [
          '**/IPTRADECSV2.csv',
          '**/csv_data/**/IPTRADECSV2.csv',
          '**/accounts/**/IPTRADECSV2.csv',
        ],
        autoScan: true,
        // scanInterval removed - file watching handled by SSE in real-time
      };

      if (existsSync(configPath)) {
        config = JSON.parse(readFileSync(configPath, 'utf8'));
      }

      // Buscar en ubicaciones configuradas
      const patterns = config.searchPatterns;

      for (const pattern of patterns) {
        const files = await glob(pattern, {
          ignore: ['node_modules/**', '.git/**'],
          absolute: true,
        });

        files.forEach(file => {
          this.csvFiles.set(file, {
            lastModified: this.getFileLastModified(file),
            data: this.parseCSVFile(file),
          });
        });
      }

      // También buscar en ubicaciones específicas
      for (const location of config.csvLocations) {
        if (existsSync(location)) {
          const locationPattern = join(location, '**/IPTRADECSV2.csv');
          const files = await glob(locationPattern, {
            ignore: ['node_modules/**', '.git/**'],
            absolute: true,
          });

          files.forEach(file => {
            this.csvFiles.set(file, {
              lastModified: this.getFileLastModified(file),
              data: this.parseCSVFile(file),
            });
          });
        }
      }

      console.log(`📁 Found ${this.csvFiles.size} CSV files`);
      console.log('📁 CSV files found:');
      this.csvFiles.forEach((fileData, filePath) => {
        console.log(`  - ${filePath}`);
      });

      // Guardar rutas encontradas en cache
      this.saveCSVPathsToCache();

      return Array.from(this.csvFiles.keys());
    } catch (error) {
      console.error('Error scanning CSV files:', error);
      return [];
    }
  }

  // Iniciar watching de archivos CSV
  startFileWatching() {
    console.log(`👀 Starting file watching for ${this.csvFiles.size} CSV files...`);

    // Limpiar watchers y polling anteriores
    this.watchers.forEach(watcher => {
      if (watcher.close) watcher.close();
    });
    this.watchers.clear();

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    if (this.pendingEvaluationInterval) {
      clearInterval(this.pendingEvaluationInterval);
    }

    // Almacenar últimas modificaciones para detectar cambios
    const lastModifiedTimes = new Map();
    this.csvFiles.forEach((fileData, filePath) => {
      lastModifiedTimes.set(filePath, this.getFileLastModified(filePath));
    });

    console.log(`🔄 Using polling method for file watching (macOS + Wine compatibility)`);

    // Polling cada 2 segundos para detectar cambios
    this.pollingInterval = setInterval(() => {
      let hasChanges = false;
      this.csvFiles.forEach((fileData, filePath) => {
        try {
          const currentModified = this.getFileLastModified(filePath);
          const lastModified = lastModifiedTimes.get(filePath);

          if (currentModified > lastModified) {
            hasChanges = true;
            const fileName = basename(filePath);

            lastModifiedTimes.set(filePath, currentModified);
            this.lastFileChange = Date.now(); // Registrar el último cambio

            // Procesar el cambio
            this.refreshFileData(filePath);

            // Emitir evento para el frontend
            this.emit('fileUpdated', filePath, this.csvFiles.get(filePath)?.data);

            // Forzar reevaluación de cuentas pendientes
            this.scanAndEmitPendingUpdates();
          }
        } catch (error) {
          console.error(`❌ Error checking file ${filePath}:`, error.message);
        }
      });
    }, 2000); // Cada 2 segundos

    console.log(`🎯 Polling configured for ${this.csvFiles.size} files`);

    // Heartbeat para confirmar que el polling está activo
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.csvFiles.forEach((fileData, filePath) => {});
    }, 30000); // Cada 30 segundos

    // Timer para re-evaluar cuentas pendientes cada 5 segundos (solo si no hay cambios recientes)
    if (this.pendingEvaluationInterval) {
      clearInterval(this.pendingEvaluationInterval);
    }

    this.pendingEvaluationInterval = setInterval(() => {
      // Solo re-evaluar si no ha habido cambios recientes
      const now = Date.now();
      const lastChange = this.lastFileChange || 0;
      if (now - lastChange > 3000) {
        // Solo si no ha habido cambios en los últimos 3 segundos
        this.scanAndEmitPendingUpdates();
      }
    }, 5000); // Cada 5 segundos
  }

  // Iniciar escaneo periódico para detectar nuevos archivos CSV (deshabilitado)
  startPeriodicScan() {
    // Intentionally disabled; scanning will be triggered explicitly by app events
    console.log('⏸️ Periodic CSV scan is disabled; using event-driven scans only');
  }

  // Método para escanear pending y emitir updates via SSE (solo si hay archivos para escanear)
  async scanAndEmitPendingUpdates() {
    try {
      // Solo escanear si hay archivos CSV disponibles
      if (this.csvFiles.size === 0) {
        // Sin archivos CSV, emitir estado vacío sin escanear
        this.emit('pendingAccountsUpdate', {
          accounts: [],
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Usar getAllActiveAccounts que ya parsea correctamente el nuevo formato
      const allAccounts = await this.getAllActiveAccounts();
      const pendingAccounts = allAccounts.pendingAccounts || [];

      // Solo mostrar logs si hay cambios significativos o es la primera vez
      const currentState = JSON.stringify(
        pendingAccounts.map(acc => ({
          id: acc.account_id,
          status: acc.status,
          time: acc.timeSinceLastPing,
        }))
      );

      if (!this.lastPendingState || this.lastPendingState !== currentState) {
        pendingAccounts.forEach(acc => {
          const timeSinceStr = acc.timeSinceLastPing
            ? `(${acc.timeSinceLastPing.toFixed(1)}s ago)`
            : '(no timestamp)';
          console.log(`   - ${acc.account_id}: ${acc.status} ${timeSinceStr}`);
        });
        this.lastPendingState = currentState;
      }

      this.emit('pendingAccountsUpdate', {
        accounts: pendingAccounts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error scanning pending accounts for SSE:', error);
    }
  }

  // Refrescar datos de un archivo específico
  refreshFileData(filePath) {
    try {
      const newData = this.parseCSVFile(filePath);
      const lastModified = this.getFileLastModified(filePath);

      // Obtener el accountId del archivo
      let accountId = null;
      if (newData && newData.length > 0) {
        accountId = newData[0].account_id;
      }

      // Si es una cuenta master, detectar cambios en órdenes
      if (accountId && newData.length > 0 && newData[0].account_type === 'master') {
        const content = readFileSync(filePath, 'utf8');
        const changes = detectOrderChanges(accountId, content);

        if (changes.hasChanges) {
          console.log(`📊 Detected ORDER changes in master ${accountId}:`, changes);
          // Emitir evento específico para cambios en órdenes
          this.emit('orderChanged', {
            accountId,
            filePath,
            changes,
            timestamp: Date.now(),
          });
        }
      }

      this.csvFiles.set(filePath, {
        lastModified,
        data: newData,
      });

      // Emitir evento general
      this.emit('csvFileChanged', { filePath, data: newData });

      // Si es un archivo pending, emitir evento específico
      this.checkAndEmitPendingUpdate(filePath);
    } catch (error) {
      console.error(`Error refreshing file ${filePath}:`, error);
    }
  }

  // Verificar si el archivo es pending y emitir update
  async checkAndEmitPendingUpdate(filePath) {
    try {
      // Simplificar: ante cualquier cambio de archivo observado, escanear y emitir
      await this.scanAndEmitPendingUpdates();
    } catch (error) {
      console.error('Error checking pending update:', error);
    }
  }

  // Obtener timestamp de última modificación
  getFileLastModified(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.mtime.getTime();
    } catch (error) {
      console.error(`Error getting file stats for ${filePath}:`, error.message);
      return 0;
    }
  }

  // Refrescar datos de todos los archivos ya cargados (sin buscar nuevos)
  refreshAllFileData() {
    this.csvFiles.forEach((fileData, filePath) => {
      if (existsSync(filePath)) {
        this.csvFiles.set(filePath, {
          lastModified: this.getFileLastModified(filePath),
          data: this.parseCSVFile(filePath),
        });
      } else {
        // Remover archivo si ya no existe
        this.csvFiles.delete(filePath);
        console.log(`🗑️ Removed non-existent file: ${filePath}`);
      }
    });
  }

  // Parsear archivo CSV con el nuevo formato de corchetes
  parseCSVFile(filePath) {
    try {
      if (!existsSync(filePath)) {
        return [];
      }

      // Leer como buffer para detectar encoding
      const buffer = readFileSync(filePath);
      let content;

      // Detectar UTF-16 LE BOM (FF FE)
      if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        content = buffer.toString('utf16le');
      } else {
        content = buffer.toString('utf8');
      }

      const lines = content
        .trim()
        .split('\n')
        .filter(line => line.trim());

      if (lines.length === 0) return [];

      // Detectar formato
      const firstLine = lines[0];
      const hasBrackets = firstLine.includes('[') && firstLine.includes(']');

      // Si es el formato antiguo con headers, usar el parser antiguo
      if (!hasBrackets && firstLine.includes(',')) {
        return this.parseOldCSVFormat(lines);
      }

      // Nuevo formato con corchetes - múltiples cuentas en un archivo
      const accounts = new Map();
      let currentAccountId = null;
      let currentAccountData = null;

      for (const line of lines) {
        // Extraer valores entre corchetes
        const matches = line.match(/\[([^\]]*)\]/g);
        if (!matches || matches.length < 2) continue;

        const values = matches.map(m => m.replace(/[\[\]]/g, ''));
        const lineType = values[0];

        switch (lineType) {
          case 'TYPE':
            // Nueva cuenta
            currentAccountId = values[3]; // [TYPE][MASTER][MT4][12345]
            currentAccountData = {
              account_id: currentAccountId,
              account_type: values[1].toLowerCase(), // master, slave, pending
              platform: values[2],
              status: 'offline', // Se actualizará con STATUS line
              timestamp: null,
              config: {},
              tickets: [],
            };
            accounts.set(currentAccountId, currentAccountData);
            break;

          case 'STATUS':
            // Actualizar status
            if (currentAccountData) {
              currentAccountData.status = values[1].toLowerCase(); // online/offline
              currentAccountData.timestamp = values[2];

              // Para cuentas pending, calcular si realmente está online basado en timestamp
              if (currentAccountData.account_type === 'pending') {
                const now = Date.now() / 1000;
                const pingTime = parseInt(values[2]) || 0;
                const timeDiff = now - pingTime; // No usar abs() para detectar timestamps futuros

                // Si el timestamp es mayor a 5 segundos en el pasado, está offline
                // También marcar offline si el timestamp está en el futuro (posible problema de sincronización)
                const PENDING_ONLINE_THRESHOLD = 5; // 5 segundos (igual que ACTIVITY_TIMEOUT)

                if (timeDiff > PENDING_ONLINE_THRESHOLD || timeDiff < -5) {
                  currentAccountData.status = 'offline';
                }
              }
            }
            break;

          case 'CONFIG':
            // Parsear configuración según tipo de cuenta
            if (currentAccountData) {
              // Usar CONFIG como fuente de verdad para el tipo de cuenta
              // Si CONFIG dice MASTER pero TYPE dice PENDING, usar MASTER
              const configType = values[1].toLowerCase();
              if (configType === 'master' && currentAccountData.account_type === 'pending') {
                console.log(
                  `🔄 [parseCSVFile] Account ${currentAccountData.account_id}: TYPE says PENDING but CONFIG says MASTER - using MASTER`
                );
                currentAccountData.account_type = 'master';
              } else if (configType === 'slave' && currentAccountData.account_type === 'pending') {
                console.log(
                  `🔄 [parseCSVFile] Account ${currentAccountData.account_id}: TYPE says PENDING but CONFIG says SLAVE - using SLAVE`
                );
                currentAccountData.account_type = 'slave';
              }

              if (currentAccountData.account_type === 'master') {
                currentAccountData.config = {
                  enabled: values[2] === 'ENABLED',
                  name: values[3] || 'Master Account',
                };
              } else if (currentAccountData.account_type === 'slave') {
                // Parse slave configuration: [CONFIG][SLAVE][ENABLED/DISABLED][LOT_MULT][FORCE_LOT][REVERSE][MASTER_ID][MASTER_CSV_PATH]
                currentAccountData.config = {
                  enabled: values[2] === 'ENABLED',
                  lotMultiplier: parseFloat(values[3]) || 1.0,
                  forceLot: values[4] !== 'NULL' ? parseFloat(values[4]) : null,
                  reverseTrading: values[5] === 'TRUE',
                  masterId: values[6] !== 'NULL' ? values[6] : null,
                  masterCsvPath: values[7] !== 'NULL' ? values[7] : null, // Include master CSV path
                };
                // Para compatibilidad con getAllActiveAccounts
                currentAccountData.master_id = currentAccountData.config.masterId;
              }
            }
            break;

          case 'TICKET':
            // Solo para masters - agregar trades
            if (currentAccountData && currentAccountData.account_type === 'master') {
              currentAccountData.tickets.push({
                ticket: values[1],
                symbol: values[2],
                type: values[3],
                lots: parseFloat(values[4]),
                price: parseFloat(values[5]),
                sl: parseFloat(values[6]),
                tp: parseFloat(values[7]),
                openTime: values[8],
              });
            }
            break;
        }
      }

      // Convertir Map a Array para compatibilidad
      return Array.from(accounts.values());
    } catch (error) {
      console.error(`Error parsing CSV file ${filePath}:`, error);
      return [];
    }
  }

  // Parser para formato antiguo (retrocompatibilidad)
  parseOldCSVFormat(lines) {
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};

      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim() : '';
      });

      data.push(row);
    }

    return data;
  }

  // Obtener todas las cuentas activas
  getAllActiveAccounts() {
    console.log('\n🔍 === getAllActiveAccounts START ===');
    console.log(`📁 Processing ${this.csvFiles.size} CSV files`);

    const accounts = {
      masterAccounts: {},
      slaveAccounts: {},
      unconnectedSlaves: [],
      pendingAccounts: [],
    };

    // Función helper para calcular estado online/offline
    const calculateStatus = timestamp => {
      if (!timestamp) return { status: 'offline', timeSinceLastPing: null };

      const now = Date.now() / 1000;
      const pingTime = parseInt(timestamp) || 0;
      const timeSinceLastPing = now - pingTime;
      const absTimeDiff = Math.abs(timeSinceLastPing);
      const status = absTimeDiff <= 5 ? 'online' : 'offline';

      return { status, timeSinceLastPing };
    };

    this.csvFiles.forEach((fileData, filePath) => {
      console.log(`📄 Processing file: ${filePath}`);
      console.log(`📊 File has ${fileData.data.length} rows`);

      fileData.data.forEach((row, index) => {
        console.log(`📋 Row ${index + 1}:`, {
          account_id: row.account_id,
          account_type: row.account_type,
          platform: row.platform,
          config: row.config,
        });

        if (row.account_id) {
          const accountId = row.account_id;
          const accountType = row.account_type;
          const platform = row.platform || this.extractPlatformFromPath(filePath);
          const { status, timeSinceLastPing } = calculateStatus(row.timestamp);

          console.log(`🔍 Processing account: ${accountId} (${accountType}) on ${platform}`);

          // Incluir cuentas pending
          if (accountType === 'pending') {
            // Solo incluir si no ha pasado más de 1 hora (3600 segundos)
            if (!timeSinceLastPing || timeSinceLastPing <= 3600) {
              accounts.pendingAccounts.push({
                account_id: accountId,
                platform: platform,
                status: status,
                current_status: status, // Agregar current_status para compatibilidad con frontend
                timestamp: row.timestamp,
                timeSinceLastPing: timeSinceLastPing,
                config: row.config || {},
                filePath: filePath, // Para debug
              });
              console.log(`✅ Added pending account: ${accountId}`);
            }
          }

          if (accountType === 'master') {
            // Preservar slaves conectadas si ya existen
            const existingMaster = accounts.masterAccounts[accountId];
            const existingConnectedSlaves = existingMaster ? existingMaster.connectedSlaves : [];
            const existingTotalSlaves = existingMaster ? existingMaster.totalSlaves : 0;

            accounts.masterAccounts[accountId] = {
              id: accountId,
              name: accountId,
              platform: platform,
              status: status,
              lastPing: row.timestamp,
              timeSinceLastPing: timeSinceLastPing,
              // Reflect CSV config for UI switches
              config: row.config || {},
              connectedSlaves: existingConnectedSlaves, // Preservar slaves existentes
              totalSlaves: existingTotalSlaves, // Preservar contador
            };
            console.log(
              `✅ Added master account: ${accountId} with ${existingTotalSlaves} existing slaves`
            );
          } else if (accountType === 'slave') {
            const masterId = row.config?.masterId || row.master_id;
            console.log(`🔗 Slave ${accountId} has masterId: ${masterId}`);

            if (masterId && masterId !== 'NULL') {
              // Es un slave conectado - CREAR el master si no existe
              if (!accounts.masterAccounts[masterId]) {
                accounts.masterAccounts[masterId] = {
                  id: masterId,
                  name: masterId,
                  platform: 'Unknown',
                  status: 'offline',
                  connectedSlaves: [],
                  totalSlaves: 0,
                };
                console.log(`✅ Created missing master account: ${masterId}`);
              }

              accounts.masterAccounts[masterId].connectedSlaves.push({
                id: accountId,
                name: accountId,
                platform: platform,
                status: status,
                timeSinceLastPing: timeSinceLastPing,
                masterOnline: true,
                config: row.config || {},
              });

              accounts.masterAccounts[masterId].totalSlaves++;
              console.log(`✅ Connected slave ${accountId} to master ${masterId}`);
            } else {
              // Es un slave no conectado
              accounts.unconnectedSlaves.push({
                id: accountId,
                name: accountId,
                platform: platform,
                status: status,
                timeSinceLastPing: timeSinceLastPing,
                config: row.config || {},
              });
              console.log(`✅ Added unconnected slave: ${accountId}`);
            }
          }
        }
      });
    });

    console.log('📊 Final accounts summary:', {
      masterAccounts: Object.keys(accounts.masterAccounts),
      unconnectedSlaves: accounts.unconnectedSlaves.map(s => s.id),
      pendingAccounts: accounts.pendingAccounts.map(p => p.account_id),
      connectedSlaves: Object.values(accounts.masterAccounts).map(master => ({
        masterId: master.id,
        slaves: master.connectedSlaves.map(s => s.id),
      })),
    });
    console.log('🔍 === getAllActiveAccounts END ===\n');

    return accounts;
  }

  // Obtener slaves conectados a un master
  getConnectedSlaves(masterId) {
    const slaves = [];

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_type === 'slave' && row.master_id === masterId) {
          slaves.push({
            id: row.account_id,
            name: row.account_id,
            platform: row.platform || 'Unknown',
            status: row.status || 'offline',
            masterOnline: true,
            config: row.config || {},
          });
        }
      });
    });

    return slaves;
  }

  // Obtener master de un slave
  getSlaveMaster(slaveId) {
    let masterId = null;

    this.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach(row => {
        if (row.account_id === slaveId && row.account_type === 'slave') {
          if (row.config && row.config.masterId && row.config.masterId !== 'NULL') {
            masterId = row.config.masterId;
          } else if (row.master_id && row.master_id !== 'NULL') {
            masterId = row.master_id;
          }

          // Si encontramos un masterId válido, salir del loop
          if (masterId && masterId !== 'NULL') {
            return;
          }
        }
      });
    });

    return masterId;
  }

  // Extraer plataforma del path del archivo
  extractPlatformFromPath(filePath) {
    const pathParts = filePath.split('/');
    const platformIndex = pathParts.findIndex(part =>
      ['MT4', 'MT5', 'cTrader', 'TradingView', 'NinjaTrader'].includes(part)
    );

    return platformIndex !== -1 ? pathParts[platformIndex] : 'Unknown';
  }

  // Obtener estado del copier
  getCopierStatus() {
    const accounts = this.getAllActiveAccounts();
    const masterAccounts = {};

    Object.keys(accounts.masterAccounts).forEach(masterId => {
      const master = accounts.masterAccounts[masterId];
      masterAccounts[masterId] = {
        masterStatus: this.isMasterEnabled(masterId),
        effectiveStatus: this.isMasterEffective(masterId),
        status: master.status,
      };
    });

    return {
      globalStatus: this.isGlobalCopierEnabled(),
      globalStatusText: this.isGlobalCopierEnabled() ? 'ON' : 'OFF',
      masterAccounts,
      totalMasterAccounts: Object.keys(accounts.masterAccounts).length,
    };
  }

  // Inicializar el estado global del copier
  initGlobalCopierStatus() {
    try {
      const configPath = join(process.cwd(), 'config', 'copier_status.json');
      const configDir = join(process.cwd(), 'config');

      // Crear directorio config si no existe
      if (!existsSync(configDir)) {
        require('fs').mkdirSync(configDir, { recursive: true });
      }

      // Si el archivo no existe, crear con estado por defecto
      if (!existsSync(configPath)) {
        const defaultConfig = {
          globalStatus: false, // Por defecto deshabilitado
          timestamp: new Date().toISOString(),
        };
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      }

      // Leer y validar el archivo
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (typeof config.globalStatus !== 'boolean') {
        config.globalStatus = false;
        writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } catch (error) {
      console.error('❌ Error initializing global copier status:', error);
    }
  }

  // Verificar si el copier global está habilitado
  isGlobalCopierEnabled() {
    try {
      const configPath = join(process.cwd(), 'config', 'copier_status.json');
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        return config.globalStatus === true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error reading global copier status:', error);
      return false;
    }
  }

  // Verificar si un master está habilitado
  isMasterEnabled(masterId) {
    // Buscar en el cache de CSV si el master está habilitado
    let enabled = false;

    this.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach(row => {
        if (row.account_id === masterId && row.account_type === 'master') {
          if (row.config && row.config.enabled === true) {
            enabled = true;
          }
        }
      });
    });

    return enabled;
  }

  // Verificar si un master es efectivo (global + master enabled + online)
  isMasterEffective(masterId) {
    // Primero verificar el estado global
    const globalEnabled = this.isGlobalCopierEnabled();
    if (!globalEnabled) {
      return false;
    }

    // Luego verificar el estado del master en su CSV
    let masterEnabled = false;
    let masterOnline = false;

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_id === masterId) {
          // Verificar el estado online/offline
          if (row.status === 'online') {
            masterOnline = true;
          }

          // Verificar la configuración ENABLED/DISABLED
          if (row.config && row.config.enabled === true) {
            masterEnabled = true;
          }
        }
      });
    });

    return globalEnabled && masterEnabled && masterOnline;
  }

  // Verificar si una cuenta está online
  isAccountOnline(accountId) {
    let online = false;

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_id === accountId && row.status === 'online') {
          online = true;
        }
      });
    });

    return online;
  }

  // Convertir una cuenta configurada a pending
  convertToPending(accountId) {
    try {
      // Buscar el archivo CSV correcto para esta cuenta
      let targetFile = null;

      // Buscar en todos los archivos CSV monitoreados
      this.csvFiles.forEach((fileData, filePath) => {
        fileData.data.forEach(row => {
          if (row.account_id === accountId) {
            targetFile = filePath;
          }
        });
      });

      if (!targetFile) {
        console.error(`❌ No CSV file found for account ${accountId}`);
        return false;
      }

      // Leer el archivo completo
      const content = readFileSync(targetFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Solo reemplazar MASTER/SLAVE por PENDING, sin agregar nada más
      const updatedLines = lines.map(line => {
        // Reemplazar MASTER o SLAVE por PENDING, manteniendo el resto igual
        return line.replace(/MASTER|SLAVE/g, 'PENDING');
      });

      // Escribir archivo actualizado
      writeFileSync(targetFile, updatedLines.join('\n') + '\n', 'utf8');

      // Refrescar datos en memoria
      this.refreshFileData(targetFile);

      // Emitir evento de conversión
      this.emit('accountConverted', {
        accountId,
        newType: 'pending',
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error(`Error converting account ${accountId} to pending:`, error);
      return false;
    }
  }

  // Escribir configuración en CSV
  writeConfig(accountId, config) {
    console.log(`🔄 writeConfig called for account ${accountId} with config:`, config);
    try {
      // Buscar el archivo CSV correcto para esta cuenta
      let targetFile = null;

      // Buscar en todos los archivos CSV monitoreados
      this.csvFiles.forEach((fileData, filePath) => {
        fileData.data.forEach(row => {
          if (row.account_id === accountId) {
            targetFile = filePath;
          }
        });
      });

      // Si no se encuentra en archivos monitoreados, buscar en el sistema de archivos
      if (!targetFile) {
        const searchPaths = [process.env.HOME + '/**/IPTRADECSV2.csv', '**/IPTRADECSV2.csv'];

        for (const searchPath of searchPaths) {
          try {
            if (existsSync(searchPath)) {
              // Verificar si el archivo contiene la cuenta
              const content = readFileSync(searchPath, 'utf8');
              if (content.includes(`[${accountId}]`)) {
                targetFile = searchPath;
                break;
              }
            }
          } catch (error) {
            // Ignore errors for individual paths
          }
        }
      }

      if (!targetFile) {
        console.error(`❌ No CSV file found for account ${accountId}`);
        return false;
      }

      // Leer el archivo completo
      const content = readFileSync(targetFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Buscar y actualizar la línea CONFIG para la cuenta específica
      let configUpdated = false;
      let currentAccountId = null;
      const updatedLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detectar línea TYPE para identificar la cuenta actual
        if (line.includes('[TYPE]')) {
          const matches = line.match(
            /\[TYPE\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/
          );
          if (matches) {
            currentAccountId = matches[4]; // El accountId está en la cuarta posición
          }
        }

        // Si encontramos la cuenta objetivo, buscar la siguiente línea CONFIG
        if (currentAccountId === accountId && line.includes('[CONFIG]')) {
          // Construir nueva línea CONFIG según el tipo de cuenta
          if (config.type === 'master') {
            configUpdated = true;
            updatedLines.push(
              `[CONFIG] [MASTER] [${config.enabled ? 'ENABLED' : 'DISABLED'}] [${config.name || 'Master Account'}]`
            );
          } else if (config.type === 'slave') {
            configUpdated = true;
            updatedLines.push(`[CONFIG] [SLAVE] [${config.enabled ? 'ENABLED' : 'DISABLED'}]`);
          }
        } else {
          updatedLines.push(line);
        }
      }

      // Si no encontramos línea CONFIG, agregar una al final
      if (!configUpdated) {
        if (config.type === 'master') {
          updatedLines.push(
            `[CONFIG] [MASTER] [${config.enabled ? 'ENABLED' : 'DISABLED'}] [${config.name || 'Master Account'}]`
          );
        } else if (config.type === 'slave') {
          const slaveConfig = config.slaveConfig || {};
          updatedLines.push(
            `[CONFIG] [SLAVE] [${config.enabled ? 'ENABLED' : 'DISABLED'}] [${slaveConfig.lotMultiplier || '1.0'}] [${slaveConfig.forceLot || 'NULL'}] [${slaveConfig.reverseTrading ? 'TRUE' : 'FALSE'}] [${slaveConfig.maxLotSize || 'NULL'}] [${slaveConfig.minLotSize || 'NULL'}] [${slaveConfig.masterId || 'NULL'}]`
          );
        }
      }

      // Validar antes de escribir
      const currentContent = readFileSync(targetFile, 'utf8');
      const newContent = updatedLines.join('\n') + '\n';

      const validationResult = validateBeforeWrite(currentContent, newContent);
      if (!validationResult.valid) {
        console.error(`❌ Validation failed: ${validationResult.error}`);
        return false;
      }

      // Escribir archivo actualizado usando archivo temporal
      const tmpFile = `${targetFile}.tmp`;
      try {
        writeFileSync(tmpFile, newContent, 'utf8');
        require('fs').renameSync(tmpFile, targetFile);
      } catch (error) {
        console.error(`❌ Error writing file: ${error.message}`);
        if (existsSync(tmpFile)) {
          require('fs').unlinkSync(tmpFile);
        }
        return false;
      }

      // Refrescar datos en memoria
      this.refreshFileData(targetFile);

      return true;
    } catch (error) {
      console.error(`Error writing config to CSV:`, error);
      return false;
    }
  }

  // Obtener configuración de slave
  getSlaveConfig(slaveId) {
    // Buscar en CSV la configuración del slave
    let config = null;

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_id === slaveId && row.action === 'config' && row.data) {
          try {
            config = JSON.parse(row.data);
          } catch (e) {
            // Ignore parsing errors
          }
        }
      });
    });

    return (
      config || {
        enabled: false,
        description: '',
        lastUpdated: null,
      }
    );
  }

  // Actualizar configuración de slave
  updateSlaveConfig(slaveId, slaveConfig) {
    const config = {
      type: 'slave',
      enabled: slaveConfig.enabled,
      slaveConfig: slaveConfig,
    };

    return this.writeConfig(slaveId, config);
  }

  // Actualizar estado global del copier
  async updateGlobalStatus(enabled) {
    try {
      // 1. Actualizar el archivo de configuración global
      const configPath = join(process.cwd(), 'config', 'copier_status.json');
      const config = {
        globalStatus: enabled,
        timestamp: new Date().toISOString(),
      };

      // Asegurar que el directorio existe
      const configDir = join(process.cwd(), 'config');
      if (!existsSync(configDir)) {
        require('fs').mkdirSync(configDir, { recursive: true });
      }

      // Guardar la configuración global
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // 2. Actualizar todos los archivos CSV2 que tenemos cacheados
      let updatedFiles = 0;

      // Procesar cada archivo cacheado
      for (const [filePath, fileData] of this.csvFiles.entries()) {
        try {
          if (existsSync(filePath)) {
            let fileModified = false;
            const content = readFileSync(filePath, 'utf8');

            // Buscar y reemplazar directamente ENABLED/DISABLED en líneas CONFIG
            const newStatus = enabled ? 'ENABLED' : 'DISABLED';
            const oldStatus = enabled ? 'DISABLED' : 'ENABLED';

            // Reemplazar ENABLED por DISABLED o viceversa en líneas CONFIG
            let updatedContent = content;

            // Buscar líneas CONFIG que contengan el estado opuesto y reemplazarlo
            const configLineRegex = new RegExp(`(\\[CONFIG\\].*?\\[)(${oldStatus})(\\].*)`, 'g');
            if (configLineRegex.test(content)) {
              updatedContent = content.replace(configLineRegex, `$1${newStatus}$3`);
              fileModified = true;
            }

            if (fileModified) {
              writeFileSync(filePath, updatedContent, 'utf8');
              updatedFiles++;

              // Refrescar datos en memoria
              this.refreshFileData(filePath);
            }
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }

      // Emitir evento de actualización
      this.emit('globalStatusChanged', {
        enabled,
        filesUpdated: updatedFiles,
        timestamp: new Date().toISOString(),
      });

      // Forzar actualización de datos
      await this.refreshAllFileData();
      await this.scanAndEmitPendingUpdates();

      return updatedFiles;
    } catch (error) {
      console.error('Error updating global copier status:', error);
      throw error;
    }
  }

  // Actualizar estado de una cuenta específica
  async updateAccountStatus(accountId, enabled) {
    try {
      // Buscar el archivo CSV correcto para esta cuenta
      let targetFile = null;
      let accountType = null;

      // Buscar en todos los archivos CSV monitoreados
      this.csvFiles.forEach((fileData, filePath) => {
        fileData.data.forEach(row => {
          if (row.account_id === accountId) {
            targetFile = filePath;
            accountType = row.account_type;
          }
        });
      });

      if (!targetFile) {
        console.error(`❌ No CSV file found for account ${accountId}`);
        return false;
      }

      // Leer el archivo completo
      const content = readFileSync(targetFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      let currentAccountId = null;
      const updatedLines = [];

      for (const line of lines) {
        // Detectar línea TYPE para identificar la cuenta actual
        if (line.includes('[TYPE]')) {
          const matches = line.match(/\[([^\]]+)\]/g);
          if (matches && matches.length >= 4) {
            currentAccountId = matches[3].replace(/[\[\]]/g, '').trim();
          }
          updatedLines.push(line);
        } else if (line.includes('[CONFIG]') && currentAccountId === accountId) {
          // Actualizar la línea CONFIG para la cuenta específica
          const matches = line.match(/\[([^\]]+)\]/g);
          if (matches && matches.length >= 2) {
            const configType = matches[1].replace(/[\[\]]/g, '').trim();
            if (configType === 'MASTER' || configType === 'SLAVE') {
              let newLine;

              // Diferentes patrones de reemplazo para MASTER y SLAVE debido a diferentes formatos
              if (configType === 'MASTER') {
                // Formato Master: [CONFIG] [MASTER] [ENABLED/DISABLED]
                newLine = line.replace(
                  /\[(ENABLED|DISABLED)\]/,
                  `[${enabled ? 'ENABLED' : 'DISABLED'}]`
                );
              } else if (configType === 'SLAVE') {
                // Formato Slave: [CONFIG][SLAVE][ENABLED/DISABLED][otros_campos...]
                // Usar un regex más flexible que capture cualquier cosa después de SLAVE
                newLine = line.replace(
                  /(\[SLAVE\])\s*\[(ENABLED|DISABLED)\]/,
                  `$1[${enabled ? 'ENABLED' : 'DISABLED'}]`
                );
              }

              updatedLines.push(newLine);
            } else {
              updatedLines.push(line);
            }
          } else {
            updatedLines.push(line);
          }
        } else {
          updatedLines.push(line);
        }
      }

      // Escribir archivo actualizado
      writeFileSync(targetFile, updatedLines.join('\n') + '\n', 'utf8');

      // Refrescar datos en memoria
      this.refreshFileData(targetFile);

      // Emitir evento de actualización
      this.emit('accountStatusChanged', {
        accountId,
        enabled,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error(`Error updating account ${accountId} status:`, error);
      return false;
    }
  }

  // Actualizar estado de master
  updateMasterStatus(masterId, enabled, name = null) {
    const config = {
      type: 'master',
      enabled,
      name: name || `Master ${masterId}`,
    };

    return this.writeConfig(masterId, config);
  }

  // Actualizar estado de slave
  updateSlaveStatus(slaveId, enabled, slaveConfig = null) {
    const config = {
      type: 'slave',
      enabled,
      slaveConfig: slaveConfig || {
        lotMultiplier: 1.0,
        forceLot: null,
        reverseTrading: false,
        maxLotSize: null,
        minLotSize: null,
      },
    };

    const result = this.writeConfig(slaveId, config);
    return result;
  }

  // Emergency shutdown
  emergencyShutdown() {
    const config = {
      emergencyShutdown: true,
      timestamp: new Date().toISOString(),
    };

    this.writeConfig('EMERGENCY', config);
  }

  // Reset all to ON
  resetAllToOn() {
    const config = {
      resetAllOn: true,
      timestamp: new Date().toISOString(),
    };

    this.writeConfig('RESET', config);
  }

  // Limpiar recursos (para testing o shutdown)
  cleanup() {
    // Limpiar timer de escaneo periódico
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    // Cerrar watchers
    this.watchers.forEach(watcher => {
      watcher.close();
    });
    this.watchers.clear();
  }
}

export default new CSVManager();
