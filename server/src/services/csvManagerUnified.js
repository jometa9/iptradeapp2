import { EventEmitter } from 'events';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

class CSVManagerUnified extends EventEmitter {
  constructor() {
    super();
    this.csvFile = null; // Archivo CSV principal
    this.pollingInterval = null;
    this.csvDirectory = join(process.cwd(), 'csv_data');
    this.csvFileName = 'IPTRADECSV_UNIFIED.csv';
    this.csvPath = join(this.csvDirectory, this.csvFileName);
    this.lastModified = 0;
    this.debounceTimer = null;
    this.debounceMs = 300;
    this.init();
  }

  init() {
    // Crear directorio si no existe
    if (!existsSync(this.csvDirectory)) {
      mkdirSync(this.csvDirectory, { recursive: true });
    }

    // Crear archivo CSV si no existe
    if (!existsSync(this.csvPath)) {
      writeFileSync(this.csvPath, '', 'utf8');
      console.log('📄 Created unified CSV file:', this.csvPath);
    }

    console.log('📋 CSV Manager Unified initialized');
    this.startFileWatching();
  }

  // Parsear una línea del CSV unificado
  parseLine(line) {
    if (!line || !line.trim()) return null;

    // Extraer campos entre corchetes
    const matches = line.match(/\[([^\]]*)\]/g);
    if (!matches || matches.length < 6) return null;

    // Limpiar corchetes y obtener valores
    const values = matches.map(m => m.replace(/[\[\]]/g, ''));

    const [type, accountId, platform, status, configStr, masterId, timestamp] = values;

    // Parsear configuración JSON
    let config = {};
    try {
      if (configStr && configStr !== '') {
        config = JSON.parse(configStr);
      }
    } catch (e) {
      console.error('Error parsing config JSON:', e);
    }

    return {
      type: type.toLowerCase(), // pending, master, slave
      accountId,
      platform,
      status: status.toLowerCase(), // online, offline
      config,
      masterId: masterId || null,
      timestamp: this.parseTimestamp(timestamp),
      rawTimestamp: timestamp,
    };
  }

  // Helper para parsear timestamp (Unix o ISO)
  parseTimestamp(timestamp) {
    if (!timestamp) return new Date();

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

  // Leer todo el archivo CSV
  readCSV() {
    try {
      if (!existsSync(this.csvPath)) {
        return [];
      }

      const content = readFileSync(this.csvPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      const accounts = [];
      for (const line of lines) {
        const parsed = this.parseLine(line);
        if (parsed) {
          // Calcular si está online basado en timestamp
          const now = Date.now();
          const accountTime = parsed.timestamp.getTime();
          const timeDiff = Math.abs(now - accountTime) / 1000; // segundos

          // Actualizar status basado en tiempo real
          if (timeDiff > 5) {
            parsed.status = 'offline';
          }

          parsed.timeDiff = timeDiff;
          accounts.push(parsed);
        }
      }

      return accounts;
    } catch (error) {
      console.error('Error reading CSV:', error);
      return [];
    }
  }

  // Escribir una nueva línea al CSV
  writeLine(type, accountId, platform, config = {}, masterId = '') {
    try {
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp en segundos
      const status = 'ONLINE'; // Siempre escribimos como ONLINE, el status real se calcula al leer
      const configStr = JSON.stringify(config);

      const line = `[${type.toUpperCase()}][${accountId}][${platform}][${status}][${configStr}][${masterId || ''}][${timestamp}]\n`;

      appendFileSync(this.csvPath, line, 'utf8');
      console.log('✅ Written to CSV:', line.trim());

      // Emitir evento de actualización
      this.emit('csvUpdated', { type: 'write', accountId });

      return true;
    } catch (error) {
      console.error('Error writing to CSV:', error);
      return false;
    }
  }

  // Actualizar una cuenta existente en el CSV
  updateAccount(accountId, updates) {
    try {
      const accounts = this.readCSV();
      const accountIndex = accounts.findIndex(acc => acc.accountId === accountId);

      if (accountIndex === -1) {
        console.error('Account not found:', accountId);
        return false;
      }

      const account = accounts[accountIndex];

      // Aplicar actualizaciones
      if (updates.type) account.type = updates.type;
      if (updates.platform) account.platform = updates.platform;
      if (updates.config) account.config = { ...account.config, ...updates.config };
      if (updates.masterId !== undefined) account.masterId = updates.masterId;

      // Reescribir todo el archivo (por simplicidad)
      const lines = accounts.map(acc => {
        const timestamp =
          acc.accountId === accountId ? Math.floor(Date.now() / 1000) : acc.rawTimestamp;
        const configStr = JSON.stringify(acc.config);
        return `[${acc.type.toUpperCase()}][${acc.accountId}][${acc.platform}][ONLINE][${configStr}][${acc.masterId || ''}][${timestamp}]`;
      });

      writeFileSync(this.csvPath, lines.join('\n') + '\n', 'utf8');
      console.log('✅ Updated account:', accountId);

      // Emitir evento de actualización
      this.emit('csvUpdated', { type: 'update', accountId });

      return true;
    } catch (error) {
      console.error('Error updating account:', error);
      return false;
    }
  }

  // Eliminar una cuenta del CSV
  deleteAccount(accountId) {
    try {
      const accounts = this.readCSV();
      const filteredAccounts = accounts.filter(acc => acc.accountId !== accountId);

      if (accounts.length === filteredAccounts.length) {
        console.warn('Account not found for deletion:', accountId);
        return false;
      }

      // Reescribir archivo sin la cuenta eliminada
      const lines = filteredAccounts.map(acc => {
        const configStr = JSON.stringify(acc.config);
        return `[${acc.type.toUpperCase()}][${acc.accountId}][${acc.platform}][ONLINE][${configStr}][${acc.masterId || ''}][${acc.rawTimestamp}]`;
      });

      writeFileSync(this.csvPath, lines.join('\n') + '\n', 'utf8');
      console.log('✅ Deleted account:', accountId);

      // Emitir evento de actualización
      this.emit('csvUpdated', { type: 'delete', accountId });

      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      return false;
    }
  }

  // Obtener todas las cuentas por tipo
  getAccountsByType(type = null) {
    const accounts = this.readCSV();

    if (!type) return accounts;

    return accounts.filter(acc => acc.type === type.toLowerCase());
  }

  // Obtener cuentas pending
  getPendingAccounts() {
    return this.getAccountsByType('pending').filter(acc => {
      // Solo incluir pending de la última hora
      return acc.timeDiff <= 3600;
    });
  }

  // Obtener cuentas master
  getMasterAccounts() {
    return this.getAccountsByType('master');
  }

  // Obtener cuentas slave
  getSlaveAccounts() {
    return this.getAccountsByType('slave');
  }

  // Obtener slaves de un master específico
  getSlavesByMaster(masterId) {
    return this.getSlaveAccounts().filter(slave => slave.masterId === masterId);
  }

  // Convertir pending a master
  convertPendingToMaster(accountId, masterName = '') {
    const pendingAccount = this.getPendingAccounts().find(acc => acc.accountId === accountId);

    if (!pendingAccount) {
      console.error('Pending account not found:', accountId);
      return false;
    }

    // Actualizar tipo y configuración
    return this.updateAccount(accountId, {
      type: 'master',
      config: {
        enabled: true,
        name: masterName || `Master ${accountId}`,
      },
    });
  }

  // Convertir pending a slave
  convertPendingToSlave(accountId, masterId, slaveConfig = {}) {
    const pendingAccount = this.getPendingAccounts().find(acc => acc.accountId === accountId);

    if (!pendingAccount) {
      console.error('Pending account not found:', accountId);
      return false;
    }

    // Configuración por defecto para slave
    const defaultConfig = {
      enabled: false,
      lotMultiplier: 1.0,
      forceLot: null,
      reverseTrading: false,
      maxLotSize: null,
      minLotSize: null,
      allowedSymbols: [],
      blockedSymbols: [],
      allowedOrderTypes: [],
      blockedOrderTypes: [],
    };

    // Actualizar tipo, master y configuración
    return this.updateAccount(accountId, {
      type: 'slave',
      masterId: masterId,
      config: { ...defaultConfig, ...slaveConfig },
    });
  }

  // Actualizar configuración de master
  updateMasterConfig(accountId, config) {
    const master = this.getMasterAccounts().find(acc => acc.accountId === accountId);

    if (!master) {
      console.error('Master account not found:', accountId);
      return false;
    }

    return this.updateAccount(accountId, { config });
  }

  // Actualizar configuración de slave
  updateSlaveConfig(accountId, config) {
    const slave = this.getSlaveAccounts().find(acc => acc.accountId === accountId);

    if (!slave) {
      console.error('Slave account not found:', accountId);
      return false;
    }

    return this.updateAccount(accountId, { config });
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

  // Obtener estadísticas
  getStatistics() {
    const accounts = this.readCSV();

    const stats = {
      total: accounts.length,
      pending: {
        total: 0,
        online: 0,
        offline: 0,
      },
      master: {
        total: 0,
        online: 0,
        offline: 0,
        enabled: 0,
        disabled: 0,
      },
      slave: {
        total: 0,
        online: 0,
        offline: 0,
        enabled: 0,
        disabled: 0,
      },
      platforms: {},
    };

    accounts.forEach(acc => {
      // Contar por tipo
      stats[acc.type].total++;

      // Contar por status
      if (acc.status === 'online') {
        stats[acc.type].online++;
      } else {
        stats[acc.type].offline++;
      }

      // Contar enabled/disabled para master y slave
      if (acc.type !== 'pending' && acc.config) {
        if (acc.config.enabled) {
          stats[acc.type].enabled++;
        } else {
          stats[acc.type].disabled++;
        }
      }

      // Contar por plataforma
      if (!stats.platforms[acc.platform]) {
        stats.platforms[acc.platform] = 0;
      }
      stats.platforms[acc.platform]++;
    });

    return stats;
  }

  // Iniciar watching del archivo CSV
  startFileWatching() {
    console.log('👀 Starting CSV file watching...');

    // Limpiar interval anterior si existe
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Obtener última modificación inicial
    this.lastModified = this.getFileLastModified();

    // Polling cada segundo
    this.pollingInterval = setInterval(() => {
      const currentModified = this.getFileLastModified();

      if (currentModified > this.lastModified) {
        // Usar debounce para evitar múltiples eventos
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          console.log('📝 CSV file changed, emitting update...');
          this.lastModified = currentModified;
          this.emit('fileChanged');

          // Emitir actualización con todos los datos
          const allAccounts = this.readCSV();
          this.emit('accountsUpdate', {
            accounts: allAccounts,
            timestamp: new Date().toISOString(),
          });
        }, this.debounceMs);
      }
    }, 1000);

    console.log('✅ CSV polling started');
  }

  // Obtener timestamp de última modificación
  getFileLastModified() {
    try {
      const stats = require('fs').statSync(this.csvPath);
      return stats.mtime.getTime();
    } catch (error) {
      return 0;
    }
  }

  // Limpiar recursos
  cleanup() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    console.log('🧹 CSV Manager Unified cleanup completed');
  }

  // Método para compatibilidad: obtener todas las cuentas en formato estructurado
  getAllActiveAccounts() {
    const accounts = this.readCSV();

    const result = {
      masterAccounts: {},
      slaveAccounts: {},
      unconnectedSlaves: [],
      pendingAccounts: [],
    };

    // Procesar masters
    accounts
      .filter(acc => acc.type === 'master')
      .forEach(master => {
        const slaves = this.getSlavesByMaster(master.accountId);

        result.masterAccounts[master.accountId] = {
          id: master.accountId,
          name: master.config.name || master.accountId,
          platform: master.platform,
          status: master.status,
          enabled: master.config.enabled || false,
          lastPing: master.timestamp.toISOString(),
          connectedSlaves: slaves.map(slave => ({
            id: slave.accountId,
            name: slave.accountId,
            platform: slave.platform,
            status: slave.status,
            enabled: slave.config.enabled || false,
            masterOnline: master.status === 'online',
          })),
          totalSlaves: slaves.length,
        };
      });

    // Procesar slaves sin master
    accounts
      .filter(acc => acc.type === 'slave' && !acc.masterId)
      .forEach(slave => {
        result.unconnectedSlaves.push({
          id: slave.accountId,
          name: slave.accountId,
          platform: slave.platform,
          status: slave.status,
          enabled: slave.config.enabled || false,
        });
      });

    // Procesar todos los slaves (conectados y desconectados)
    accounts
      .filter(acc => acc.type === 'slave')
      .forEach(slave => {
        result.slaveAccounts[slave.accountId] = {
          id: slave.accountId,
          name: slave.accountId,
          platform: slave.platform,
          status: slave.status,
          enabled: slave.config.enabled || false,
          masterId: slave.masterId || null,
          lastPing: slave.timestamp.toISOString(),
        };
      });

    // Procesar pending
    this.getPendingAccounts().forEach(pending => {
      result.pendingAccounts.push({
        account_id: pending.accountId,
        platform: pending.platform,
        status: pending.status,
        current_status: pending.status,
        timestamp: pending.rawTimestamp,
        timeDiff: pending.timeDiff,
      });
    });

    return result;
  }
}

export default new CSVManagerUnified();
