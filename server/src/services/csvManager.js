import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

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
    this.init();
  }

  init() {
    // Crear directorio si no existe
    if (!existsSync(this.csvDirectory)) {
      require('fs').mkdirSync(this.csvDirectory, { recursive: true });
    }

    // No hacer escaneo inicial automático; esperará a que Link Platforms configure las rutas específicas
    console.log(
      '📋 CSV Manager initialized - waiting for platform linking to configure specific paths'
    );
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
            const content = readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());

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
                    account_type: 'pending', // Siempre pending para este formato
                  };

                  if (account.account_id && account.timestamp) {
                    const accountTime = this.parseTimestamp(account.timestamp);
                    const timeDiff = (currentTime - accountTime) / 1000; // diferencia en segundos

                    // Solo incluir si no ha pasado más de 1 hora
                    if (timeDiff <= 3600) {
                      // Determinar status basado en el tiempo transcurrido
                      account.current_status = timeDiff <= 5 ? 'online' : 'offline';
                      account.timeDiff = timeDiff;
                      account.filePath = filePath;
                      validPendingAccounts.push(account);
                      console.log(
                        `📱 Found pending account ${account.account_id} (${account.platform}) - ${account.current_status} (${timeDiff.toFixed(1)}s ago) - Timestamp: ${account.timestamp}`
                      );
                    } else {
                      console.log(
                        `⏰ Ignoring account ${account.account_id} - too old (${(timeDiff / 60).toFixed(1)} minutes) - Timestamp: ${account.timestamp}`
                      );
                    }
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

    // Almacenar últimas modificaciones para detectar cambios
    const lastModifiedTimes = new Map();
    this.csvFiles.forEach((fileData, filePath) => {
      lastModifiedTimes.set(filePath, this.getFileLastModified(filePath));
    });

    console.log(`🔄 Using polling method for file watching (macOS + Wine compatibility)`);

    // Polling cada 2 segundos para detectar cambios
    this.pollingInterval = setInterval(() => {
      this.csvFiles.forEach((fileData, filePath) => {
        try {
          const currentModified = this.getFileLastModified(filePath);
          const lastModified = lastModifiedTimes.get(filePath);

          if (currentModified > lastModified) {
            console.log(`🔔 File change detected via polling: ${filePath}`);
            console.log(`   📅 Last: ${new Date(lastModified).toISOString()}`);
            console.log(`   📅 Current: ${new Date(currentModified).toISOString()}`);

            lastModifiedTimes.set(filePath, currentModified);

            // Procesar el cambio
            console.log(`📝 Processing CSV file update: ${filePath}`);
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
      console.log(`💓 CSV Polling heartbeat - ${this.csvFiles.size} files being monitored:`);
      this.csvFiles.forEach((fileData, filePath) => {
        console.log(`   👁️ Polling: ${filePath.split('/').pop()}`);
      });
    }, 30000); // Cada 30 segundos
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

      const pendingAccounts = await this.scanSimplifiedPendingCSVFiles();
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

      this.csvFiles.set(filePath, {
        lastModified,
        data: newData,
      });

      console.log(`📄 Refreshed data for ${filePath}`);

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
      console.log(`🔄 Pending accounts related file changed: ${filePath}`);
      await this.scanAndEmitPendingUpdates();
    } catch (error) {
      console.error('Error checking pending update:', error);
    }
  }

  // Obtener timestamp de última modificación
  getFileLastModified(filePath) {
    try {
      const stats = require('fs').statSync(filePath);
      return stats.mtime.getTime();
    } catch (error) {
      return 0;
    }
  }

  // Parsear archivo CSV
  parseCSVFile(filePath) {
    try {
      if (!existsSync(filePath)) {
        return [];
      }

      const content = readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');

      if (lines.length <= 1) return []; // Solo header o vacío

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
    } catch (error) {
      console.error(`Error parsing CSV file ${filePath}:`, error);
      return [];
    }
  }

  // Obtener todas las cuentas activas
  getAllActiveAccounts() {
    const accounts = {
      masterAccounts: {},
      slaveAccounts: {},
      unconnectedSlaves: [],
    };

    this.csvFiles.forEach((fileData, filePath) => {
      fileData.data.forEach(row => {
        if (row.account_id && row.status === 'online') {
          const accountId = row.account_id;
          const accountType = row.account_type;
          const platform = this.extractPlatformFromPath(filePath);

          if (accountType === 'master') {
            accounts.masterAccounts[accountId] = {
              id: accountId,
              name: accountId,
              platform: platform,
              status: 'online',
              lastPing: row.timestamp,
              connectedSlaves: this.getConnectedSlaves(accountId),
              totalSlaves: this.getConnectedSlaves(accountId).length,
            };
          } else if (accountType === 'slave') {
            const masterId = this.getSlaveMaster(accountId);

            if (masterId) {
              // Es un slave conectado
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
                status: 'online',
                masterOnline: true,
              });

              accounts.masterAccounts[masterId].totalSlaves++;
            } else {
              // Es un slave no conectado
              accounts.unconnectedSlaves.push({
                id: accountId,
                name: accountId,
                platform: platform,
                status: 'online',
              });
            }
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
        if (row.account_type === 'slave' && row.master_id === masterId) {
          slaves.push({
            id: row.account_id,
            name: row.account_id,
            platform: row.platform || 'Unknown',
            status: row.status || 'offline',
            masterOnline: true,
          });
        }
      });
    });

    return slaves;
  }

  // Obtener master de un slave
  getSlaveMaster(slaveId) {
    let masterId = null;

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_id === slaveId && row.master_id) {
          masterId = row.master_id;
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

  // Verificar si el copier global está habilitado
  isGlobalCopierEnabled() {
    // Buscar en CSV si el global está habilitado
    let enabled = false;

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_id === 'GLOBAL' && row.action === 'config' && row.data) {
          try {
            const config = JSON.parse(row.data);
            enabled = config.globalEnabled === true;
          } catch (e) {
            // Ignore parsing errors
          }
        }
      });
    });

    return enabled;
  }

  // Verificar si un master está habilitado
  isMasterEnabled(masterId) {
    // Buscar en CSV si el master está habilitado
    let enabled = false;

    this.csvFiles.forEach(fileData => {
      fileData.data.forEach(row => {
        if (row.account_id === masterId && row.action === 'config' && row.data) {
          try {
            const config = JSON.parse(row.data);
            enabled = config.enabled === true;
          } catch (e) {
            // Ignore parsing errors
          }
        }
      });
    });

    return enabled;
  }

  // Verificar si un master es efectivo (global + master enabled + online)
  isMasterEffective(masterId) {
    return (
      this.isGlobalCopierEnabled() &&
      this.isMasterEnabled(masterId) &&
      this.isAccountOnline(masterId)
    );
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

  // Escribir configuración en CSV
  writeConfig(accountId, config) {
    const timestamp = new Date().toISOString();
    const csvLine = `${timestamp},${accountId},config,online,config,${JSON.stringify(config)}\n`;

    // Escribir en el primer archivo CSV encontrado
    const firstFile = Array.from(this.csvFiles.keys())[0];
    if (firstFile) {
      try {
        writeFileSync(firstFile, csvLine, { flag: 'a' });
        console.log(`📝 Config written to CSV for account ${accountId}`);
      } catch (error) {
        console.error(`Error writing to CSV:`, error);
      }
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
  updateSlaveConfig(slaveId, enabled) {
    const config = {
      enabled,
      description: `Slave ${slaveId} configuration`,
      lastUpdated: new Date().toISOString(),
    };

    this.writeConfig(slaveId, config);
  }

  // Actualizar estado global del copier
  updateGlobalStatus(enabled) {
    const config = {
      globalEnabled: enabled,
      timestamp: new Date().toISOString(),
    };

    this.writeConfig('GLOBAL', config);
  }

  // Actualizar estado de master
  updateMasterStatus(masterId, enabled) {
    const config = {
      enabled,
      type: 'master',
      timestamp: new Date().toISOString(),
    };

    this.writeConfig(masterId, config);
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
      console.log('🔄 Periodic CSV scan stopped');
    }

    // Cerrar watchers
    this.watchers.forEach(watcher => {
      watcher.close();
    });
    this.watchers.clear();

    console.log('🧹 CSV Manager cleanup completed');
  }
}

export default new CSVManager();
