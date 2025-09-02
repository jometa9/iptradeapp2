import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFile, readFileSync, statSync, writeFileSync, writeFile, rename, copyFile, unlink } from 'fs';
import { glob } from 'glob';
import { join, resolve } from 'path';

import { validateBeforeWrite } from './csvValidator2.js';
import { detectOrderChanges } from './orderChangeDetector.js';

class CSVManager extends EventEmitter {
  constructor() {
    super();
    this.csvFiles = new Map(); // Cache de archivos CSV encontrados
    this.watchers = new Map(); // File watchers
    this.scanTimer = null; // Timer para escaneo periódico (deshabilitado por defecto)
    this.debounceTimers = new Map(); // Debounce por archivo para eventos de watch
    this.debounceTimeoutMs = 1000; // Ventana de debounce para agrupar cambios de archivo (1 segundo)
    this.csvDirectory = join(process.cwd(), 'csv_data');
    this.heartbeatInterval = null; // Para el heartbeat de los watchers
          this.pollingInterval = null; // Para el polling de archivos
      this.pendingEvaluationInterval = null; // Para re-evaluar cuentas pendientes
      
      // Sistema de cola para escrituras
      this.writeQueue = new Map(); // Cola de escrituras por archivo
      this.writeInProgress = new Set(); // Set de archivos siendo escritos
      this.maxRetries = 3; // Número máximo de reintentos por operación
      this.retryDelay = 1000; // Delay base entre reintentos (ms)
      this.maxConcurrentWrites = 1; // Máximo de escrituras simultáneas
      
      this.init();
    }

    // Procesar cola de escrituras
    async processWriteQueue(filePath) {
      if (this.writeInProgress.has(filePath)) {
        return; // Ya hay una escritura en progreso para este archivo
      }

      const queue = this.writeQueue.get(filePath);
      if (!queue || queue.length === 0) {
        return; // No hay operaciones pendientes
      }

      this.writeInProgress.add(filePath);

      try {
        while (queue.length > 0) {
          const operation = queue[0]; // Peek la primera operación
          
          try {
            const success = await this.writeFileWithRetry(
              filePath,
              operation.content,
              this.maxRetries,
              this.retryDelay
            );

            if (success) {
              queue.shift(); // Remover la operación completada
              operation.resolve(true);
            } else {
              // Si falló después de todos los reintentos
              operation.reject(new Error(`Failed to write to ${filePath} after ${this.maxRetries} attempts`));
              queue.shift(); // Remover la operación fallida
            }
          } catch (error) {
            if (error.code === 'EPERM' || error.code === 'EBUSY') {
              // Si el archivo está bloqueado, esperar y reintentar
              await new Promise(resolve => setTimeout(resolve, this.retryDelay));
              continue;
            }
            
            // Para otros errores, rechazar la operación y continuar con la siguiente
            operation.reject(error);
            queue.shift();
          }
        }
      } finally {
        this.writeInProgress.delete(filePath);
        this.writeQueue.delete(filePath);
      }
    }

    // Agregar operación a la cola de escrituras
    async queueFileWrite(filePath, content) {
      return new Promise((resolve, reject) => {
        // Inicializar cola si no existe
        if (!this.writeQueue.has(filePath)) {
          this.writeQueue.set(filePath, []);
        }

        // Agregar operación a la cola
        const queue = this.writeQueue.get(filePath);
        queue.push({ content, resolve, reject });

        // Iniciar procesamiento si no hay una escritura en progreso
        if (!this.writeInProgress.has(filePath)) {
          this.processWriteQueue(filePath);
        }
      });
    }

    // Función helper para escribir archivo con reintentos
    async writeFileWithRetry(filePath, content, maxRetries = 3, retryDelay = 1000) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Intentar escribir en un archivo temporal primero
          const tmpPath = `${filePath}.tmp`;
          await new Promise((resolve, reject) => {
            writeFile(tmpPath, content, 'utf8', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Si la escritura temporal fue exitosa, intentar renombrar
          await new Promise((resolve, reject) => {
            rename(tmpPath, filePath, (err) => {
              if (err) {
                // Si falla el rename, intentar copiar y eliminar
                copyFile(tmpPath, filePath, (copyErr) => {
                  if (copyErr) {
                    reject(copyErr);
                  } else {
                    unlink(tmpPath, () => resolve());
                  }
                });
              } else {
                resolve();
              }
            });
          });

          return true;
        } catch (error) {
          if (error.code === 'EPERM' || error.code === 'EBUSY') {
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
              continue;
            }
          }
          throw error;
        }
      }
      return false;
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
      this.startFileWatching();
    }
  }

  // Función para limpiar el cache y archivos cargados (usada cuando se activa Link Accounts)
  clearCacheAndFiles() {
    // Limpiar archivos cargados
    this.csvFiles.clear();

    // Detener todos los watchers
    this.stopFileWatching();
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
            account_type: typeData.type.toLowerCase(), // Use TYPE as source of truth
            status: timeDiff <= 5 ? 'online' : 'offline',
            current_status: timeDiff <= 5 ? 'online' : 'offline',
            timestamp: statusData.timestamp,
            timeDiff: timeDiff,
            filePath: filePath,
            format: 'csv2',
          };

          // Add config details based on account type (TYPE line is source of truth)
          if (typeData.type === 'SLAVE' && configData.details.length >= 6) {
            account.config = {
              enabled: configData.details[0] === 'ENABLED',
              lotMultiplier: parseFloat(configData.details[1]) || 1,
              forceLot: configData.details[2] === 'NULL' ? null : parseFloat(configData.details[2]),
              reverseTrading: configData.details[3] === 'TRUE',
              masterId: configData.details[4] === 'NULL' ? null : configData.details[4],
              masterCsvPath: configData.details[5] || null,
            };
          } else if (typeData.type === 'MASTER') {
            account.config = {
              enabled: configData.details[0] === 'ENABLED',
              name: configData.details[1] || `Account ${typeData.accountId}`,
            };
          }

          return account;
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
      // Buscar todos los archivos CSV que contengan IPTRADECSV2 en el nombre
      const patterns = [
        '**/*IPTRADECSV2*.csv',
        '**/csv_data/**/*IPTRADECSV2*.csv',
        '**/accounts/**/*IPTRADECSV2*.csv',
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
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
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
      // Preferir archivos ya observados (válidos). Si no hay, usar búsqueda amplia como fallback
      let allFiles = [];
      if (this.csvFiles.size > 0) {
        allFiles = Array.from(this.csvFiles.keys());
      } else {
        const patterns = [
          '**/*IPTRADECSV2*.csv',
          '**/csv_data/**/*IPTRADECSV2*.csv',
          '**/accounts/**/*IPTRADECSV2*.csv',
          process.env.HOME + '/**/*IPTRADECSV2*.csv',
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

            // Verificar si el primer valor es "0" (indicador de pending)
            if (
              (isBracketFormat && /^\d+$/.test(values[0] || '') && values.length >= 4) ||
              (!isBracketFormat && values[0] === '0' && values.length >= 4)
            ) {
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
                    }
                  }
                }
              }
            } else {
              // Si no es el formato simplificado, intentar con el formato anterior
              const headers = lines[0].split(',').map(h => h.trim());
              const expectedHeaders = ['timestamp', 'account_id', 'account_type', 'platform'];
              const isSimplifiedFormat = expectedHeaders.every(h => headers.includes(h));

              if (isSimplifiedFormat) {
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
      const cacheDir = join(process.cwd(), 'server', 'server', 'config');

      if (!existsSync(cacheDir)) {
        require('fs').mkdirSync(cacheDir, { recursive: true });
      }

      const cacheData = {
        csvFiles: csvFiles,
        timestamp: new Date().toISOString(),
        version: '1.0',
        totalFiles: csvFiles.length,
        lastScan: new Date().toISOString(),
      };

      writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');

      if (existsSync(cachePath)) {
        const stats = statSync(cachePath);
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
        return [];
      }
    } catch (error) {
      console.error('❌ Error cargando cache:', error.message);
    }
    return [];
  }

  // Escanear todos los archivos CSV que contengan IPTRADECSV2 en el nombre (método original)
  async scanCSVFiles() {
    try {
      // Cargar configuración de ubicaciones
      const configPath = join(process.cwd(), 'server', 'config', 'csv_locations.json');
      let config = {
        csvLocations: [],
        searchPatterns: [
          '**/*IPTRADECSV2*.csv',
          '**/csv_data/**/*IPTRADECSV2*.csv',
          '**/accounts/**/*IPTRADECSV2*.csv',
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
          const locationPattern = join(location, '**/*IPTRADECSV2*.csv');
          const files = await glob(locationPattern, {
            ignore: ['node_modules/**', '.git/**'],
            absolute: true,
          });

          files.forEach(file => {
            const normalizedPath = this.normalizePath(file);
            if (!this.isDuplicatePath(normalizedPath)) {
              this.csvFiles.set(normalizedPath, {
                lastModified: this.getFileLastModified(normalizedPath),
                data: this.parseCSVFile(normalizedPath),
              });
            }
          });
        }
      }

      // Validate and remove duplicates after scanning
      this.validateAndRemoveDuplicates();
      this.saveCSVPathsToCache();

      return Array.from(this.csvFiles.keys());
    } catch (error) {
      console.error('Error scanning CSV files:', error);
      return [];
    }
  }



  // Add a single CSV file to the manager for watching (async version)
  async addCSVFileAsync(filePath) {
    try {
      if (!existsSync(filePath)) {
        console.error(`❌ CSV file does not exist: ${filePath}`);
        return false;
      }

      // Normalize the path to avoid duplicates with different formats
      const normalizedPath = this.normalizePath(filePath);

      // Check for duplicates using normalized path
      if (this.csvFiles.has(normalizedPath)) {
        return true;
      }

      // Check for duplicates by comparing with existing paths
      const isDuplicate = this.isDuplicatePath(normalizedPath);
      if (isDuplicate) {
        return false;
      }

      // Add the file to the map with its data (using async parsing)
      const csvData = await this.parseCSVFileAsync(normalizedPath);
      this.csvFiles.set(normalizedPath, {
        lastModified: this.getFileLastModified(normalizedPath),
        data: csvData,
      });

      // Save updated paths to cache
      this.saveCSVPathsToCache();

      // Start file watching if not already active
      if (!this.pollingInterval) {
        this.startFileWatching();
      }

      return true;
    } catch (error) {
      console.error(`❌ Error adding CSV file ${filePath}:`, error);
      return false;
    }
  }

  // Add a single CSV file to the manager for watching
  addCSVFile(filePath) {
    try {
      if (!existsSync(filePath)) {
        console.error(`❌ CSV file does not exist: ${filePath}`);
        return false;
      }

      // Normalize the path to avoid duplicates with different formats
      const normalizedPath = this.normalizePath(filePath);

      // Check for duplicates using normalized path
      if (this.csvFiles.has(normalizedPath)) {
        return true;
      }

      // Check for duplicates by comparing with existing paths
      const isDuplicate = this.isDuplicatePath(normalizedPath);
      if (isDuplicate) {
        return false;
      }

      // Add the file to the map with its data
      this.csvFiles.set(normalizedPath, {
        lastModified: this.getFileLastModified(normalizedPath),
        data: this.parseCSVFile(normalizedPath),
      });

      // Save updated paths to cache
      this.saveCSVPathsToCache();

      // Start file watching if not already active
      if (!this.pollingInterval) {
        this.startFileWatching();
      }

      return true;
    } catch (error) {
      console.error(`❌ Error adding CSV file ${filePath}:`, error);
      return false;
    }
  }

  // Normalize path to avoid duplicates with different formats
  normalizePath(filePath) {
    return resolve(filePath);
  }

  // Check if a path is a duplicate of an existing one
  isDuplicatePath(filePath) {
    for (const existingPath of this.csvFiles.keys()) {
      if (this.pathsAreEquivalent(filePath, existingPath)) {
        return true;
      }
    }
    return false;
  }

  // Check if two paths point to the same file
  pathsAreEquivalent(path1, path2) {
    try {
      const resolved1 = resolve(path1);
      const resolved2 = resolve(path2);
      return resolved1 === resolved2;
    } catch (error) {
      // If path resolution fails, compare as strings
      return path1 === path2;
    }
  }

  // Validate and remove duplicate CSV files
  validateAndRemoveDuplicates() {
    const paths = Array.from(this.csvFiles.keys());
    const duplicates = [];
    const toRemove = new Set();

    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const path1 = paths[i];
        const path2 = paths[j];

        if (this.pathsAreEquivalent(path1, path2)) {
          duplicates.push({ path1, path2 });
          // Keep the first one, remove the second
          toRemove.add(path2);
        }
      }
    }

    // Remove duplicates
    toRemove.forEach(path => {
      this.csvFiles.delete(path);
    });

    if (duplicates.length > 0) {
    } else {
    }

    return duplicates;
  }

  // Get summary of registered CSV files
  getCSVFilesSummary() {
    const paths = Array.from(this.csvFiles.keys());
    const summary = {
      totalFiles: paths.length,
      mql4Files: paths.filter(path => path.includes('MQL4')),
      mql5Files: paths.filter(path => path.includes('MQL5')),
      otherFiles: paths.filter(path => !path.includes('MQL4') && !path.includes('MQL5')),
      paths: paths,
    };

    return summary;
  }

  // Detener watching de archivos CSV
  stopFileWatching() {
    // Limpiar watchers
    this.watchers.forEach(watcher => {
      if (watcher.close) watcher.close();
    });
    this.watchers.clear();

    // Limpiar intervals
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.pendingEvaluationInterval) {
      clearInterval(this.pendingEvaluationInterval);
      this.pendingEvaluationInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // File watching deshabilitado - pending accounts solo se consultan desde frontend
  startFileWatching() {
    // Limpiar watchers y polling anteriores si existen
    this.stopFileWatching();
  }

  // Iniciar escaneo periódico para detectar nuevos archivos CSV (deshabilitado)
  startPeriodicScan() {
    // Intentionally disabled; scanning will be triggered explicitly by app events
  }

  // Método eliminado - pending accounts solo se consultan desde frontend

  // Refrescar datos de un archivo específico
  async refreshFileData(filePath) {
    try {
      // Usar la versión asíncrona que maneja archivos bloqueados
      const newData = await this.parseCSVFileAsync(filePath);
      const lastModified = this.getFileLastModified(filePath);

      // Obtener el accountId del archivo
      let accountId = null;
      if (newData && newData.length > 0) {
        accountId = newData[0].account_id;
      }

      // Si es una cuenta master, detectar cambios en órdenes
      if (accountId && newData.length > 0 && newData[0].account_type === 'master') {
        try {
          const content = await new Promise((resolve, reject) => {
            readFile(filePath, 'utf8', (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
          const changes = detectOrderChanges(accountId, content);

          if (changes.hasChanges) {
            // Emitir evento específico para cambios en órdenes
            this.emit('orderChanged', {
              accountId,
              filePath,
              changes,
              timestamp: Date.now(),
            });
          }
        } catch (error) {}
      }

      this.csvFiles.set(filePath, {
        lastModified,
        data: newData,
      });

      // Emitir evento general
      this.emit('csvFileChanged', { filePath, data: newData });

      // Pending updates eliminados - solo consultas desde frontend
    } catch (error) {
      console.error(`Error refreshing file ${filePath}:`, error);
    }
  }

  // Método eliminado - pending accounts solo se consultan desde frontend

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
  async refreshAllFileData() {
    const promises = [];

    this.csvFiles.forEach((fileData, filePath) => {
      if (existsSync(filePath)) {
        promises.push(
          this.parseCSVFileAsync(filePath)
            .then(newData => {
              this.csvFiles.set(filePath, {
                lastModified: this.getFileLastModified(filePath),
                data: newData,
              });
            })
            .catch(error => {
              console.error(`Error refreshing file ${filePath}:`, error);
              // Mantener datos anteriores si hay error
            })
        );
      } else {
        // Remover archivo si ya no existe
        this.csvFiles.delete(filePath);
      }
    });

    await Promise.allSettled(promises);
  }

  // Parsear archivo CSV con el nuevo formato de corchetes (versión síncrona para compatibilidad)
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

              // Para cuentas pending, respetar el estado original del CSV
              // No sobrescribir el estado basado en timestamp para cuentas convertidas
              if (currentAccountData.account_type === 'pending') {
                // Solo aplicar lógica de timestamp si el estado original es 'online'
                // y queremos verificar si realmente sigue online
                if (values[1].toLowerCase() === 'online') {
                  const now = Date.now() / 1000;
                  const pingTime = parseInt(values[2]) || 0;
                  const timeDiff = now - pingTime;

                  const PENDING_ONLINE_THRESHOLD = 5; // 5 segundos

                  // Solo cambiar a offline si el timestamp indica que no está activo
                  if (timeDiff > PENDING_ONLINE_THRESHOLD || timeDiff < -5) {
                    currentAccountData.status = 'offline';
                  }
                }
                // Si el estado original es 'offline', mantenerlo como offline
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
                currentAccountData.account_type = 'master';
              } else if (configType === 'slave' && currentAccountData.account_type === 'pending') {
                currentAccountData.account_type = 'slave';
              }

              if (currentAccountData.account_type === 'master') {
                const enabled = values[2] === 'ENABLED';
                const name = values[3] || 'Master Account';
                const prefix = values[4] || '';
                const suffix = values[5] || '';

                currentAccountData.config = {
                  enabled: enabled,
                  name: name,
                  prefix: prefix,
                  suffix: suffix,
                };
              } else if (currentAccountData.account_type === 'slave') {
                // Parse slave configuration: [CONFIG][SLAVE][ENABLED/DISABLED][LOT_MULT][FORCE_LOT][REVERSE][MASTER_ID][MASTER_CSV_PATH][PREFIX][SUFFIX]
                currentAccountData.config = {
                  enabled: values[2] === 'ENABLED',
                  lotMultiplier: parseFloat(values[3]) || 1.0,
                  forceLot: values[4] !== 'NULL' ? parseFloat(values[4]) : null,
                  reverseTrading: values[5] === 'TRUE',
                  masterId: values[6] !== 'NULL' ? values[6] : null,
                  masterCsvPath: values[7] !== 'NULL' ? values[7] : null, // Include master CSV path
                  prefix: values[8] || '',
                  suffix: values[9] || '',
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

  // Parsear archivo CSV de forma asíncrona con manejo de archivos bloqueados
  async parseCSVFileAsync(filePath, maxRetries = 3, retryDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!existsSync(filePath)) {
          return [];
        }

        // Usar readFile asíncrono para evitar bloqueos
        const buffer = await new Promise((resolve, reject) => {
          readFile(filePath, (err, data) => {
            if (err) {
              if (err.code === 'EBUSY' || err.code === 'EACCES') {
                // Archivo bloqueado, intentar de nuevo
                reject(err);
              } else {
                reject(err);
              }
            } else {
              resolve(data);
            }
          });
        });

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
                  const timeDiff = now - pingTime;

                  const PENDING_ONLINE_THRESHOLD = 5; // 5 segundos

                  if (timeDiff > PENDING_ONLINE_THRESHOLD || timeDiff < -5) {
                    currentAccountData.status = 'offline';
                  }
                }
              }
              break;

            case 'CONFIG':
              // Parsear configuración según tipo de cuenta
              if (currentAccountData) {
                const configType = values[1].toLowerCase();
                if (configType === 'master' && currentAccountData.account_type === 'pending') {
                  currentAccountData.account_type = 'master';
                } else if (
                  configType === 'slave' &&
                  currentAccountData.account_type === 'pending'
                ) {
                  currentAccountData.account_type = 'slave';
                }

                              if (currentAccountData.account_type === 'master') {
                currentAccountData.config = {
                  masterId: currentAccountId,
                  enabled: values[2] === 'ENABLED',
                  name: values[3] || `Account ${currentAccountId}`,
                  prefix: values[4] || '',
                  suffix: values[5] || '',
                };
                } else if (currentAccountData.account_type === 'slave') {
                  currentAccountData.config = {
                    enabled: values[2] === 'ENABLED',
                    lotMultiplier: parseFloat(values[3]) || 1.0,
                    forceLot: values[4] !== 'NULL' ? parseFloat(values[4]) : null,
                    reverseTrading: values[5] === 'TRUE',
                    masterId: values[6] !== 'NULL' ? values[6] : null,
                    masterCsvPath: values[7] !== 'NULL' ? values[7] : null,
                    prefix: values[8] || '',
                    suffix: values[9] || '',
                  };
                }
              }
              break;
          }
        }

        return Array.from(accounts.values());
      } catch (error) {
        if (error.code === 'EBUSY' || error.code === 'EACCES') {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.warn(`⚠️ Failed to read ${filePath} after ${maxRetries} attempts, skipping...`);
            return [];
          }
        } else {
          this.handleFileError(filePath, error, 'parsing');
          return [];
        }
      }
    }
  }

  // Obtener todas las cuentas activas - FORZAR REFRESH DE TODOS LOS ARCHIVOS
  async getAllActiveAccounts() {
    const accounts = {
      masterAccounts: {},
      slaveAccounts: {},
      unconnectedSlaves: [],
      pendingAccounts: [],
    };

    // Track processed account IDs to prevent duplicates across account types
    const processedAccountIds = new Set();

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

    // Re-parsear archivos de forma asíncrona para evitar errores EBUSY
    const refreshPromises = [];
    this.csvFiles.forEach((fileData, filePath) => {
      refreshPromises.push(
        this.parseCSVFileAsync(filePath)
          .then(freshData => {
            fileData.data = freshData;
          })
          .catch(error => {
            // Manejar errores de permisos eliminando el archivo del cache
            if (this.isPermissionError(error)) {
              this.handleFileError(filePath, error, 'refreshing');
            }
          })
      );
    });

    // Esperar a que todos los archivos se procesen
    await Promise.allSettled(refreshPromises);

    this.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach((row, index) => {
        if (row.account_id) {
          const accountId = row.account_id;
          const accountType = row.account_type;
          const platform = row.platform || this.extractPlatformFromPath(filePath);
          const { status, timeSinceLastPing } = calculateStatus(row.timestamp);

          // Skip if this account ID has already been processed
          if (processedAccountIds.has(accountId)) {
            return;
          }

          // Incluir cuentas pending
          if (accountType === 'pending') {
            // Incluir todas las cuentas pending que estén en el archivo CSV
            // El filtrado por tiempo se hace en el frontend si es necesario
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
            processedAccountIds.add(accountId);
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
            processedAccountIds.add(accountId);
          } else if (accountType === 'slave') {
            const masterId = row.config?.masterId || row.master_id;

            // Validar que el masterId sea un ID válido (no un valor de configuración)
            const isValidMasterId =
              masterId &&
              masterId !== 'NULL' &&
              masterId !== 'ENABLED' &&
              masterId !== 'DISABLED' &&
              masterId !== 'ON' &&
              masterId !== 'OFF' &&
              !isNaN(parseInt(masterId)); // Debe ser un número

            if (isValidMasterId) {
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
            }
            processedAccountIds.add(accountId);
          }
        }
      });
    });

    return accounts;
  }

  // Obtener slaves conectados a un master
  getConnectedSlaves(masterId) {
    const slaves = [];

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_type === 'slave') {
          const rowMasterId = row.config?.masterId || row.master_id;

          // Validar que el masterId sea un ID válido (no un valor de configuración)
          const isValidMasterId =
            rowMasterId &&
            rowMasterId !== 'NULL' &&
            rowMasterId !== 'ENABLED' &&
            rowMasterId !== 'DISABLED' &&
            rowMasterId !== 'ON' &&
            rowMasterId !== 'OFF' &&
            !isNaN(parseInt(rowMasterId)); // Debe ser un número

          if (isValidMasterId && rowMasterId === masterId) {
            slaves.push({
              id: row.account_id,
              name: row.account_id,
              platform: row.platform || 'Unknown',
              status: row.status || 'offline',
              masterOnline: true,
              config: row.config || {},
            });
          }
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

  // Función para escanear y emitir actualizaciones de pending accounts
  async scanAndEmitPendingUpdates() {
    try {
      // Refrescar todos los archivos CSV
      await this.refreshAllFileData();

      // Obtener todas las cuentas activas
      const allAccounts = await this.getAllActiveAccounts();

      // Emitir evento con las cuentas pending actualizadas
      this.emit('pendingAccountsUpdated', {
        pendingAccounts: allAccounts.pendingAccounts || [],
        timestamp: new Date().toISOString(),
        totalAccounts: allAccounts.pendingAccounts?.length || 0,
      });
    } catch (error) {
      console.error('❌ [csvManager] Error scanning pending updates:', error);
    }
  }

  // Obtener estado del copier (optimized version that accepts pre-loaded accounts)
  getCopierStatusFromAccounts(accounts) {
    const masterAccounts = {};

    Object.keys(accounts.masterAccounts || {}).forEach(masterId => {
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
      totalMasterAccounts: Object.keys(accounts.masterAccounts || {}).length,
    };
  }

  // Obtener estado del copier (legacy method for backward compatibility)
  async getCopierStatus() {
    const accounts = await this.getAllActiveAccounts();
    return this.getCopierStatusFromAccounts(accounts);
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
      console.error('Error initializing global copier status:', error);
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
      console.error('Error reading global copier status:', error);
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
        console.error(`No CSV file found for account ${accountId}`);
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
      try {
        writeFileSync(targetFile, updatedLines.join('\n') + '\n', 'utf8');
      } catch (writeError) {
        this.handleFileError(targetFile, writeError, 'writing');
        return false;
      }

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
        const searchPaths = [process.env.HOME + '/**/*IPTRADECSV2*.csv', '**/*IPTRADECSV2*.csv'];

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
            const prefix = config.prefix || '';
            const suffix = config.suffix || '';
            updatedLines.push(
              `[CONFIG] [MASTER] [${config.enabled ? 'ENABLED' : 'DISABLED'}] [${config.name || 'Master Account'}] [${prefix}] [${suffix}]`
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
          const prefix = config.prefix ? config.prefix : 'NULL';
          const suffix = config.suffix ? config.suffix : 'NULL';
          updatedLines.push(
            `[CONFIG] [MASTER] [${config.enabled ? 'ENABLED' : 'DISABLED'}] [${config.name || 'Master Account'}] [${prefix}] [${suffix}]`
          );
        } else if (config.type === 'slave') {
          const slaveConfig = config.slaveConfig || {};
          const prefix = slaveConfig.prefix ? slaveConfig.prefix : 'NULL';
          const suffix = slaveConfig.suffix ? slaveConfig.suffix : 'NULL';
          updatedLines.push(
            `[CONFIG] [SLAVE] [${config.enabled ? 'ENABLED' : 'DISABLED'}] [${slaveConfig.lotMultiplier || '1.0'}] [${slaveConfig.forceLot || 'NULL'}] [${slaveConfig.reverseTrading ? 'TRUE' : 'FALSE'}] [${slaveConfig.masterId || 'NULL'}] [NULL] [${prefix}] [${suffix}]`
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
        this.handleFileError(targetFile, error, 'writing config');
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
        mkdirSync(configDir, { recursive: true });
      }

      // Guardar la configuración global
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // 2. Actualizar todos los archivos CSV2 que tenemos cacheados
      let updatedFiles = 0;

      // Procesar cada archivo cacheado
      for (const [filePath, fileData] of this.csvFiles.entries()) {
        try {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const newLines = [];
            let fileModified = false;

            for (const line of lines) {
              let updatedLine = line;

              if (line.includes('[CONFIG]')) {
                const matches = line.match(/\[([^\]]+)\]/g);
                if (matches && matches.length >= 2) {
                  const configType = matches[1].replace(/[\[\]]/g, '').trim();
                  
                  if (configType === 'MASTER') {
                    // Para master: [CONFIG] [MASTER] [ENABLED/DISABLED] [NAME] [PREFIX] [SUFFIX]
                    const name = matches[3]?.replace(/[\[\]]/g, '').trim() || 'Master Account';
                    const prefix = matches[4]?.replace(/[\[\]]/g, '').trim() || '';
                    const suffix = matches[5]?.replace(/[\[\]]/g, '').trim() || '';
                    updatedLine = `[CONFIG] [MASTER] [${enabled ? 'ENABLED' : 'DISABLED'}] [${name}] [${prefix}] [${suffix}]`;
                    fileModified = true;
                  } else if (configType === 'SLAVE') {
                    // Para slave: [CONFIG] [SLAVE] [ENABLED/DISABLED] [LOT_MULT] [FORCE_LOT] [REVERSE] [MASTER_ID] [MASTER_CSV_PATH] [PREFIX] [SUFFIX]
                    const lotMult = matches[3]?.replace(/[\[\]]/g, '').trim() || '1.0';
                    const forceLot = matches[4]?.replace(/[\[\]]/g, '').trim() || 'NULL';
                    const reverse = matches[5]?.replace(/[\[\]]/g, '').trim() || 'FALSE';
                    const masterId = matches[6]?.replace(/[\[\]]/g, '').trim() || 'NULL';
                    const masterCsvPath = matches[7]?.replace(/[\[\]]/g, '').trim() || 'NULL';
                    const prefix = matches[8]?.replace(/[\[\]]/g, '').trim() || '';
                    const suffix = matches[9]?.replace(/[\[\]]/g, '').trim() || '';
                    updatedLine = `[CONFIG] [SLAVE] [${enabled ? 'ENABLED' : 'DISABLED'}] [${lotMult}] [${forceLot}] [${reverse}] [${masterId}] [${masterCsvPath}] [${prefix}] [${suffix}]`;
                    fileModified = true;
                  }
                }
              }

              newLines.push(updatedLine);
            }

            if (fileModified) {
              try {
                writeFileSync(filePath, newLines.join('\n') + '\n', 'utf8');
                updatedFiles++;
                this.refreshFileData(filePath);
              } catch (writeError) {
                this.handleFileError(filePath, writeError, 'writing');
              }
            }
          }
        } catch (error) {
          this.handleFileError(filePath, error, 'processing');
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

      return updatedFiles;
    } catch (error) {
      console.error('❌ [csvManager] Error updating global copier status:', error);
      throw error;
    }
  }

    // Actualizar estado de una cuenta específica
  async updateAccountStatus(accountId, enabled) {
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
            if (configType === 'MASTER') {
              // Para master: [CONFIG] [MASTER] [ENABLED/DISABLED] [NAME] [PREFIX] [SUFFIX]
              const name = matches[3]?.replace(/[\[\]]/g, '').trim() || currentAccountId || 'Master Account';
              const prefix = matches[4]?.replace(/[\[\]]/g, '').trim() || '';
              const suffix = matches[5]?.replace(/[\[\]]/g, '').trim() || '';
              const updatedLine = `[CONFIG] [MASTER] [${enabled ? 'ENABLED' : 'DISABLED'}] [${name}] [${prefix}] [${suffix}]`;
              updatedLines.push(updatedLine);
            } else if (configType === 'SLAVE') {
              // Para slave: [CONFIG] [SLAVE] [ENABLED/DISABLED] [LOT_MULT] [FORCE_LOT] [REVERSE] [MASTER_ID] [MASTER_CSV_PATH] [PREFIX] [SUFFIX]
              const lotMult = matches[3]?.replace(/[\[\]]/g, '').trim() || '1.0';
              const forceLot = matches[4]?.replace(/[\[\]]/g, '').trim() || 'NULL';
              const reverse = matches[5]?.replace(/[\[\]]/g, '').trim() || 'FALSE';
              const masterId = matches[6]?.replace(/[\[\]]/g, '').trim() || 'NULL';
              const masterCsvPath = matches[7]?.replace(/[\[\]]/g, '').trim() || 'NULL';
              const prefix = matches[8]?.replace(/[\[\]]/g, '').trim() || 'NULL';
              const suffix = matches[9]?.replace(/[\[\]]/g, '').trim() || 'NULL';
              const updatedLine = `[CONFIG] [SLAVE] [${enabled ? 'ENABLED' : 'DISABLED'}] [${lotMult}] [${forceLot}] [${reverse}] [${masterId}] [${masterCsvPath}] [${prefix}] [${suffix}]`;
              updatedLines.push(updatedLine);
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
      try {
        writeFileSync(targetFile, updatedLines.join('\n') + '\n', 'utf8');
        this.refreshFileData(targetFile);
      } catch (writeError) {
        this.handleFileError(targetFile, writeError, 'writing');
        return false;
      }

      // Emitir evento de actualización
      this.emit('accountStatusChanged', {
        accountId,
        enabled,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      this.handleFileError(targetFile, error, `updating account ${accountId} status`);
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

  // Eliminar archivo problemático del cache y watching
  removeProblematicFile(filePath) {
    try {
      console.log(`🗑️ [csvManager] Removing problematic file from cache: ${filePath}`);
      
      // Eliminar del Map de archivos CSV
      if (this.csvFiles.has(filePath)) {
        this.csvFiles.delete(filePath);
        console.log(`✅ [csvManager] Removed from csvFiles cache: ${filePath}`);
      }

      // Eliminar del file watcher si existe
      if (this.fileWatchers && this.fileWatchers.has(filePath)) {
        const watcher = this.fileWatchers.get(filePath);
        if (watcher) {
          watcher.close();
          this.fileWatchers.delete(filePath);
          console.log(`✅ [csvManager] Removed file watcher: ${filePath}`);
        }
      }

      // Actualizar el cache JSON
      this.saveCSVPathsToCache();
      
      console.log(`✅ [csvManager] Successfully removed problematic file: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ [csvManager] Error removing problematic file ${filePath}:`, error);
      return false;
    }
  }

  // Verificar si un error es de permisos
  isPermissionError(error) {
    return error.code === 'EPERM' || 
           error.code === 'EACCES' || 
           error.message.includes('operation not permitted') ||
           error.message.includes('permission denied');
  }

  // Manejar error de archivo y eliminar si es de permisos
  handleFileError(filePath, error, operation = 'processing') {
    console.error(`❌ [csvManager] Error ${operation} file ${filePath}:`, error);
    
    if (this.isPermissionError(error)) {
      console.log(`🚫 [csvManager] Permission error detected, removing file from cache: ${filePath}`);
      this.removeProblematicFile(filePath);
      return true; // Indicar que el archivo fue eliminado
    }
    
    return false; // Indicar que el archivo no fue eliminado
  }
}

export default new CSVManager();
