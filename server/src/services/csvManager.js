import { EventEmitter } from 'events';
import { existsSync, readFileSync, watch, writeFileSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

class CSVManager extends EventEmitter {
  constructor() {
    super();
    this.csvFiles = new Map(); // Cache de archivos CSV encontrados
    this.watchers = new Map(); // File watchers
    this.scanTimer = null; // Timer para escaneo periódico
    this.csvDirectory = join(process.cwd(), 'csv_data');
    this.init();
  }

  init() {
    // Crear directorio si no existe
    if (!existsSync(this.csvDirectory)) {
      require('fs').mkdirSync(this.csvDirectory, { recursive: true });
    }

    this.scanCSVFiles();
    this.startFileWatching();
    this.startPeriodicScan();
  }

  // Nuevo método para escanear archivos pending simplificados
  async scanPendingCSVFiles() {
    try {
      console.log('🔍 Scanning for simplified pending CSV files...');

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
            const lines = content.split('\n').filter(line => line.trim());

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
                const accountTime = new Date(account.timestamp);
                const timeDiff = (currentTime - accountTime) / 1000; // diferencia en segundos

                // Solo incluir si no ha pasado más de 1 hora
                if (timeDiff <= 3600) {
                  // 3600 segundos = 1 hora
                  account.status = timeDiff <= 5 ? 'online' : 'offline';
                  account.timeDiff = timeDiff;
                  account.filePath = filePath;
                  validPendingAccounts.push(account);
                  console.log(
                    `📱 Found pending account ${account.account_id} (${account.platform}) - ${account.status} (${timeDiff.toFixed(1)}s ago)`
                  );
                } else {
                  console.log(
                    `⏰ Ignoring account ${account.account_id} - too old (${(timeDiff / 60).toFixed(1)} minutes)`
                  );
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
      console.error('Error scanning pending CSV files:', error);
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
    this.csvFiles.forEach((fileData, filePath) => {
      if (this.watchers.has(filePath)) {
        this.watchers.get(filePath).close();
      }

      const watcher = watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`📝 CSV file updated: ${filePath}`);
          this.refreshFileData(filePath);

          // Emitir evento para el frontend
          this.emit('fileUpdated', filePath, this.csvFiles.get(filePath)?.data);
        }
      });

      this.watchers.set(filePath, watcher);
    });
  }

  // Iniciar escaneo periódico para detectar nuevos archivos CSV
  startPeriodicScan() {
    // Cargar configuración para obtener el intervalo
    const configPath = join(process.cwd(), 'server', 'config', 'csv_locations.json');
    let scanInterval = 30000; // 30 segundos por defecto

    try {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (config.autoScan && config.scanInterval) {
          scanInterval = config.scanInterval;
        } else if (!config.autoScan) {
          console.log('🔍 Auto-scan is disabled in configuration');
          return;
        }
      }
    } catch (error) {
      console.error('Error loading CSV scan configuration:', error);
    }

    console.log(`🔄 Starting periodic CSV scan every ${scanInterval / 1000} seconds`);

    this.scanTimer = setInterval(async () => {
      console.log('🔍 Scanning for new CSV files...');
      const previousCount = this.csvFiles.size;

      await this.scanCSVFiles();

      const newCount = this.csvFiles.size;
      if (newCount > previousCount) {
        const foundFiles = newCount - previousCount;
        console.log(`📁 Found ${foundFiles} new CSV file(s)`);

        // Iniciar watchers para los nuevos archivos
        this.startFileWatching();

        // Emitir evento de archivos actualizados
        this.emit('newFilesDetected', Array.from(this.csvFiles.keys()));
      }

      // También escanear pending accounts periódicamente
      await this.scanAndEmitPendingUpdates();
    }, scanInterval);
  }

  // Nuevo método para escanear pending y emitir updates via SSE
  async scanAndEmitPendingUpdates() {
    try {
      const pendingAccounts = await this.scanPendingCSVFiles();
      this.emit('pendingAccountsUpdate', {
        accounts: pendingAccounts,
        timestamp: new Date().toISOString()
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
      // Verificar si el archivo contiene pending accounts
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length >= 2) {
          const headers = lines[0].split(',').map(h => h.trim());
          const expectedHeaders = ['timestamp', 'account_id', 'account_type', 'platform'];
          const isSimplifiedFormat = expectedHeaders.every(h => headers.includes(h));
          
          if (isSimplifiedFormat) {
            console.log(`🔄 Pending accounts file changed: ${filePath}`);
            await this.scanAndEmitPendingUpdates();
          }
        }
      }
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
