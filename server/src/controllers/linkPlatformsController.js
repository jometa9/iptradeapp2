import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import util from 'util';

import csvManager from '../services/csvManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = util.promisify(exec);

class LinkPlatformsController {
  constructor() {
    this.botsPath = path.join(__dirname, '../../../bots');
    this.isLinking = false; // Track if linking is in progress
    this.cachedPaths = null; // Cache for found MQL paths
    this.lastScanTime = null; // Track when last scan happened
    this.cacheValidityHours = 24; // Cache válido por 24 horas
    this.cacheFilePath = path.join(__dirname, '../../../config/mql_paths_cache.json');
    this.operatingSystem = this.detectOperatingSystem();
    this.lastLinkPlatformsResult = null; // Store last result for new clients
    this.lastLinkPlatformsTimestamp = null; // Store timestamp of last operation
    // Flag para controlar si cTrader está habilitado (por defecto deshabilitado)
    this.cTraderEnabled = false;
  }

  // Detectar el sistema operativo
  detectOperatingSystem() {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        console.warn(`⚠️ Unknown platform: ${platform}, defaulting to linux`);
        return 'linux';
    }
  }

  // Método para habilitar/deshabilitar cTrader
  setCTraderEnabled(enabled) {
    this.cTraderEnabled = enabled;
  }

  // Método para obtener el estado de cTrader
  isCTraderEnabled() {
    return this.cTraderEnabled;
  }

  async linkPlatforms(req, res) {
    try {
      // Check if Link Platforms is already running
      if (this.isLinking) {
        return res.status(409).json({
          success: false,
          message:
            'Link Platforms is already running. Please wait for the current process to complete.',
          isLinking: true,
        });
      }

      const result = await this.findAndSyncMQLFoldersManual();

      res.json({
        success: true,
        message: 'Link Platforms process completed',
        result,
      });
    } catch (error) {
      console.error('❌ Link Platforms error:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Link Platforms process failed',
        error: error.message,
      });
    }
  }

  async findAndSyncMQLFolders() {
    // Track linking state
    this.isLinking = true;

    const result = {
      mql4Folders: [],
      mql5Folders: [],
      created: 0,
      synced: 0,
      errors: [],
      filesCreated: 0,
      csvFiles: [],
    };

    // Emitir evento de inicio para el frontend
    this.emitLinkPlatformsEvent('started', { message: 'Link Platforms process started' });

    try {
      // Buscar todas las unidades de disco en Windows
      const drives = await this.getAvailableDrives();

      for (const drive of drives) {
        try {
          const driveResult = await this.scanDrive(drive);
          result.mql4Folders.push(...driveResult.mql4Folders);
          result.mql5Folders.push(...driveResult.mql5Folders);
          result.created += driveResult.created;
          result.synced += driveResult.synced;
          result.errors.push(...driveResult.errors);
          // Aggregate CSV detection results
          if (typeof driveResult.filesCreated === 'number') {
            result.filesCreated += driveResult.filesCreated;
          }
          if (Array.isArray(driveResult.csvFiles)) {
            result.csvFiles.push(...driveResult.csvFiles);
          }
        } catch (error) {
          result.errors.push(`Error scanning drive ${drive}: ${error.message}`);
        }
      }

      // Configurar CSV manager con las rutas específicas encontradas
      try {
        await this.configureCSVWatching(result.csvFiles);
      } catch (scanErr) {
        result.errors.push(`Error configuring CSV watching: ${scanErr.message}`);
      }

      // Emitir evento de finalización exitosa
      this.emitLinkPlatformsEvent('completed', {
        message: 'Link Platforms process completed successfully',
        result,
      });
    } catch (error) {
      result.errors.push(`General error: ${error.message}`);

      // Emitir evento de error
      this.emitLinkPlatformsEvent('error', {
        message: 'Link Platforms process failed',
        error: error.message,
        result,
      });
    } finally {
      // Always reset linking state
      this.isLinking = false;

      // Emit SSE event to notify frontend that linking has finished
      this.emitLinkPlatformsEvent('idle', {
        message: 'Link Platforms process finished',
        isLinking: false,
      });
    }

    return result;
  }

  // Cargar cache desde archivo
  loadCacheFromFile() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
        this.cachedPaths = cacheData.paths;
        this.lastScanTime = new Date(cacheData.timestamp);

        return true;
      }
    } catch (error) {
      console.error('❌ Error loading cache:', error);
    }
    return false;
  }

  // Guardar cache en archivo
  saveCacheToFile(paths) {
    try {
      const configDir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const cacheData = {
        paths: paths,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('❌ Error saving cache:', error);
    }
  }

  // Verificar si el cache es válido
  isCacheValid() {
    if (!this.cachedPaths || !this.lastScanTime) return false;

    // Verificar que el cache tenga paths válidos (no esté vacío)
    const hasMQL4Paths = this.cachedPaths.mql4Folders && this.cachedPaths.mql4Folders.length > 0;
    const hasMQL5Paths = this.cachedPaths.mql5Folders && this.cachedPaths.mql5Folders.length > 0;
    const hasNinjaTraderPaths = this.cachedPaths.ninjaTraderFolders && this.cachedPaths.ninjaTraderFolders.length > 0;

    if (!hasMQL4Paths && !hasMQL5Paths && !hasNinjaTraderPaths) {
      return false;
    }

    const now = new Date();
    const cacheAge = (now - this.lastScanTime) / (1000 * 60 * 60); // horas
    const isTimeValid = cacheAge < this.cacheValidityHours;

    return isTimeValid;
  }

  // Unified method - ALWAYS full system scan (replaces both manual and optimized)
  async findAndSyncMQLFolders() {
    // Track linking state
    this.isLinking = true;

    // Safety timeout to reset state if process gets stuck
    const safetyTimeout = setTimeout(() => {
      if (this.isLinking) {
        this.isLinking = false;
        this.emitLinkPlatformsEvent('error', {
          message: 'Link Platforms process timed out',
          error: 'Process took too long to complete',
        });
        this.emitLinkPlatformsEvent('idle', {
          message: 'Link Platforms process finished (timeout)',
          isLinking: false,
        });
      }
    }, 300000); // 300 seconds timeout (reduced from 60)

    const result = {
      mql4Folders: [],
      mql5Folders: [],
      created: 0,
      synced: 0,
      errors: [],
      filesCreated: 0,
      csvFiles: [],
      usedCache: false,
      backgroundScan: false,
    };

    // Emitir evento de inicio para el frontend
    this.emitLinkPlatformsEvent('started', { message: 'Link Platforms process started' });

    try {
      // PASO 1: Configurar CSV watching para archivos existentes PRIMERO

      await this.configureCSVWatchingForExistingFilesInternal();

      // PASO 2: Realizar scan completo de MetaTrader folders

      await this.performFullScan(result);

      // Emitir evento de finalización completa
      this.emitLinkPlatformsEvent('completed', {
        message: 'Link Platforms process completed successfully',
        result,
      });
    } catch (error) {
      console.error('❌ Error in Link Platforms process:', error);
      result.errors.push(`General error: ${error.message}`);

      // Emitir evento de error
      this.emitLinkPlatformsEvent('error', {
        message: 'Link Platforms process failed',
        error: error.message,
        result,
      });
    } finally {
      // Clear safety timeout
      clearTimeout(safetyTimeout);

      // Always reset linking state
      this.isLinking = false;

      // Emit SSE event to notify frontend that linking has finished
      this.emitLinkPlatformsEvent('idle', {
        message: 'Link Platforms process finished',
        isLinking: false,
      });
    }

    return result;
  }

  // Legacy methods for backward compatibility
  async findAndSyncMQLFoldersManual() {
    return await this.findAndSyncMQLFolders();
  }

  async findAndSyncMQLFoldersOptimized() {
    return await this.findAndSyncMQLFolders();
  }

  // Procesar rutas cacheadas
  async processCachedPaths(cachedPaths, result) {
    // Procesar MQL4 folders
    for (const folder of cachedPaths.mql4Folders) {
      if (fs.existsSync(folder)) {
        await this.processMQLFolder(folder, 'MQL4', result);
      }
    }

    // Procesar MQL5 folders
    for (const folder of cachedPaths.mql5Folders) {
      if (fs.existsSync(folder)) {
        await this.processMQLFolder(folder, 'MQL5', result);
      }
    }

    result.mql4Folders = cachedPaths.mql4Folders.filter(folder => fs.existsSync(folder));
    result.mql5Folders = cachedPaths.mql5Folders.filter(folder => fs.existsSync(folder));
  }

  // Helper function to get all bot files by extension
  getBotFilesByExtension(extension) {
    try {
      if (!fs.existsSync(this.botsPath)) {
        return [];
      }
      
      return fs.readdirSync(this.botsPath)
        .filter(file => file.endsWith(extension))
        .map(file => ({
          name: file,
          path: path.join(this.botsPath, file)
        }));
    } catch (error) {
      console.error(`❌ Error reading bots directory for extension ${extension}:`, error);
      return [];
    }
  }

  // Procesar una carpeta MQL individual
  async processMQLFolder(folder, type, result) {
    try {
      const expertPath = path.join(folder, 'Experts');
      const filesPath = path.join(folder, 'Files');
      const extension = type === 'MQL4' ? '.mq4' : '.mq5';

      // Ensure Experts folder exists
      if (!fs.existsSync(expertPath)) {
        fs.mkdirSync(expertPath, { recursive: true });
        result.created++;
      }

      // Get all bot files with the correct extension
      const botFiles = this.getBotFilesByExtension(extension);
      
      // Copy all bot files to ensure latest versions
      for (const botFile of botFiles) {
        if (fs.existsSync(botFile.path)) {
          const targetBotPath = path.join(expertPath, botFile.name);
          fs.copyFileSync(botFile.path, targetBotPath);
          result.synced++;
        }
      }

      // Ensure Files folder exists
      if (!fs.existsSync(filesPath)) {
        fs.mkdirSync(filesPath, { recursive: true });
        result.created++;
      }

      // Look for existing CSV files with IPTRADECSV2 pattern
      const csvFiles = fs
        .readdirSync(filesPath)
        .filter(file => file.includes('IPTRADECSV2') && file.endsWith('.csv'));

      if (csvFiles.length > 0) {
        // Found existing CSV files
        csvFiles.forEach(csvFile => {
          const csvPath = path.join(filesPath, csvFile);
          result.csvFiles.push(csvPath);

          // Register the CSV file in csvManager for watching
          try {
            csvManager.addCSVFile(csvPath);
          } catch (error) {
            console.error(`❌ Error registering CSV file for watching: ${error.message}`);
          }
        });
      } else {
        // Create new CSV file with platform-specific name
        const platformSuffix = type === 'MQL4' ? 'MT4' : 'MT5';
        const csvFileName = `IPTRADECSV2${platformSuffix}.csv`;
        const csvPath = path.join(filesPath, csvFileName);

        // Create empty CSV file with basic structure
        const emptyCSVContent = `[TYPE][${platformSuffix}][0]
[STATUS][OFFLINE][0]
[CONFIG][PENDING]`;

        fs.writeFileSync(csvPath, emptyCSVContent, 'utf8');
        result.csvFiles.push(csvPath);
        result.filesCreated++;

        // Register the new CSV file in csvManager for watching
        try {
          csvManager.addCSVFile(csvPath);
        } catch (error) {
          console.error(`❌ Error registering CSV file for watching: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Error processing ${type} folder ${folder}: ${error.message}`);
      console.error(`❌ Error processing ${type} folder:`, error);
    }
  }

  // Realizar búsqueda completa (sin cache)
  async performFullScan(result) {
    // Emitir evento de scanning
    this.emitLinkPlatformsEvent('scanning', {
      message: 'Scanning for MetaTrader installations...',
    });

    // Búsqueda simple en todo el sistema
    try {
      // Emitir evento de syncing antes de empezar el proceso completo
      this.emitLinkPlatformsEvent('syncing', {
        message: 'Syncing Expert Advisors to platforms...',
      });

      const driveResult = await this.scanDrive('', false);

      result.mql4Folders.push(...driveResult.mql4Folders);
      result.mql5Folders.push(...driveResult.mql5Folders);
      result.ninjaTraderFolders = driveResult.ninjaTraderFolders || [];

      result.created += driveResult.created;
      result.synced += driveResult.synced;
      result.errors.push(...driveResult.errors);
      result.filesCreated += driveResult.filesCreated;
      result.csvFiles.push(...driveResult.csvFiles);
    } catch (error) {
      result.errors.push(`Error scanning system: ${error.message}`);
      console.error(`❌ Error scanning system:`, error);
    }

    // Guardar nuevo cache
    const pathsToCache = {
      mql4Folders: result.mql4Folders,
      mql5Folders: result.mql5Folders,
      ninjaTraderFolders: result.ninjaTraderFolders || [],
    };
    this.cachedPaths = pathsToCache;
    this.lastScanTime = new Date();
    this.saveCacheToFile(pathsToCache);

    // Configurar CSV watching
    if (result.csvFiles.length > 0) {
      await this.configureCSVWatching(result.csvFiles);
    }

    // Log summary of registered CSV files
    try {
      csvManager.getCSVFilesSummary();
    } catch (error) {
      console.error(`❌ Error getting CSV summary: ${error.message}`);
    }

    // Emitir evento de finalización exitosa (comentado - ahora se emite desde findAndSyncMQLFoldersManual)
    // this.emitLinkPlatformsEvent('completed', {
    //   message: 'Link Platforms process completed successfully',
    //   result,
    // });
  }

  // Realizar búsqueda en background para nuevas instalaciones (SIN afectar frontend)
  async performBackgroundScan() {
    try {
      const newPaths = { mql4Folders: [], mql5Folders: [], ninjaTraderFolders: [] };

      try {
        const driveResult = await this.scanDrive('', true); // Solo buscar, no procesar
        newPaths.mql4Folders.push(...driveResult.mql4Folders);
        newPaths.mql5Folders.push(...driveResult.mql5Folders);
        newPaths.ninjaTraderFolders = driveResult.ninjaTraderFolders || [];
      } catch (error) {
        console.error(`❌ Background scan error:`, error);
      }

      // Comparar con cache actual
      const currentMQL4 = this.cachedPaths?.mql4Folders || [];
      const currentMQL5 = this.cachedPaths?.mql5Folders || [];
      const currentNinjaTrader = this.cachedPaths?.ninjaTraderFolders || [];

      const newMQL4 = newPaths.mql4Folders.filter(path => !currentMQL4.includes(path));
      const newMQL5 = newPaths.mql5Folders.filter(path => !currentMQL5.includes(path));
      const newNinjaTrader = newPaths.ninjaTraderFolders.filter(path => !currentNinjaTrader.includes(path));

      if (newMQL4.length > 0 || newMQL5.length > 0 || newNinjaTrader.length > 0) {
        // Procesar nuevas rutas SIN cambiar estado de linking
        const backgroundResult = {
          mql4Folders: newMQL4,
          mql5Folders: newMQL5,
          ninjaTraderFolders: newNinjaTrader,
          created: 0,
          synced: 0,
          errors: [],
          filesCreated: 0,
          csvFiles: [],
        };

        for (const folder of newMQL4) {
          await this.processMQLFolder(folder, 'MQL4', backgroundResult);
        }
        for (const folder of newMQL5) {
          await this.processMQLFolder(folder, 'MQL5', backgroundResult);
        }
        for (const folder of newNinjaTrader) {
          await this.processNinjaTraderFolder(folder, backgroundResult);
        }

        // Actualizar cache
        const updatedPaths = {
          mql4Folders: [...currentMQL4, ...newMQL4],
          mql5Folders: [...currentMQL5, ...newMQL5],
          ninjaTraderFolders: [...currentNinjaTrader, ...newNinjaTrader],
        };
        this.cachedPaths = updatedPaths;
        this.lastScanTime = new Date();
        this.saveCacheToFile(updatedPaths);

        // Configurar watching para nuevos CSVs
        if (backgroundResult.csvFiles.length > 0) {
          await this.configureCSVWatching(backgroundResult.csvFiles);
        }

        // Emitir evento especial de background (opcional - para logs del frontend)
        this.emitBackgroundScanEvent('completed', {
          message: `Background scan found and synced ${newMQL4.length + newMQL5.length + newNinjaTrader.length} new installations`,
          newInstallations: {
            mql4: newMQL4.length,
            mql5: newMQL5.length,
            ninjaTrader: newNinjaTrader.length,
            synced: backgroundResult.synced,
          },
        });
      } else {
        this.emitBackgroundScanEvent('completed', {
          message: 'Background scan completed - no new installations found',
          newInstallations: { mql4: 0, mql5: 0, ninjaTrader: 0, synced: 0 },
        });
      }
    } catch (error) {
      console.error('❌ Background scan failed:', error);
      this.emitBackgroundScanEvent('error', {
        message: 'Background scan failed',
        error: error.message,
      });
    }
  }

  // Función interna para configurar CSV watching sin emitir eventos (usada dentro del proceso principal)
  async configureCSVWatchingForExistingFilesInternal() {
    // Guardar los archivos existentes antes de buscar nuevos
    const existingFiles = new Map(csvManager.csvFiles);

    // En Windows, usar el comando PowerShell específico para buscar archivos CSV
    if (this.operatingSystem === 'windows') {
      try {
        // Comando PowerShell para buscar archivos IPTRADECSV2*.csv en todo el sistema
        const findCommand = `Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -File -Force -ErrorAction SilentlyContinue 2>$null |
    Where-Object { $_.Name -like 'IPTRADECSV2*.csv' } |
    Select-Object -ExpandProperty FullName
}`;

        // Usar exec asíncrono para manejar timeouts y errores
        let stdout = '';
        try {
          const result = await execAsync(findCommand, {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
            shell: 'powershell.exe',
          });
          stdout = result.stdout;
        } catch (error) {
          // PowerShell puede retornar error por timeout pero aún encontrar archivos
          // Usamos el stdout aunque haya error
          if (error.stdout) {
            stdout = error.stdout;
          }
        }

        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        for (const csvPath of allCsvFiles) {
          if (fs.existsSync(csvPath)) {
            // Si el archivo ya existe en el caché, mantener sus datos
            if (existingFiles.has(csvPath)) {
              csvManager.csvFiles.set(csvPath, existingFiles.get(csvPath));
            } else {
              // Si es un archivo nuevo, agregarlo al caché
              csvManager.csvFiles.set(csvPath, {
                lastModified: csvManager.getFileLastModified(csvPath),
                data: csvManager.parseCSVFile(csvPath),
              });
            }
          }
        }

        // Configurar file watching
        csvManager.startFileWatching();

        // Guardar el cache después de encontrar los archivos CSV
        if (csvManager.csvFiles.size > 0) {
          csvManager.saveCSVPathsToCache();
        }
      } catch (error) {
        console.error(`❌ Error during Windows system-wide CSV search for existing files:`, error);
        // En caso de error, restaurar los archivos existentes
        existingFiles.forEach((value, key) => {
          csvManager.csvFiles.set(key, value);
        });
      }
    } else if (this.operatingSystem === 'macos') {
      try {
        // Buscar todos los archivos IPTRADECSV2*.csv en el sistema
        const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2*.csv" -type f 2>/dev/null`;

        // Usar exec asíncrono para evitar crash por exit code 1
        let stdout = '';
        try {
          const result = await execAsync(findCommand, { encoding: 'utf8' });
          stdout = result.stdout;
        } catch (error) {
          // find retorna exit code 1 cuando encuentra archivos pero también errores de permisos
          // Usamos el stdout aunque haya error
          if (error.stdout) {
            stdout = error.stdout;
          }
        }
        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim());

        // Configurar watching para todos los archivos encontrados
        for (const csvPath of allCsvFiles) {
          if (fs.existsSync(csvPath)) {
            // Si el archivo ya existe en el caché, mantener sus datos
            if (existingFiles.has(csvPath)) {
              csvManager.csvFiles.set(csvPath, existingFiles.get(csvPath));
            } else {
              // Si es un archivo nuevo, agregarlo al caché
              csvManager.csvFiles.set(csvPath, {
                lastModified: csvManager.getFileLastModified(csvPath),
                data: csvManager.parseCSVFile(csvPath),
              });
            }
          }
        }

        // Configurar file watching
        csvManager.startFileWatching();

        // Guardar el cache después de encontrar los archivos CSV
        if (csvManager.csvFiles.size > 0) {
          csvManager.saveCSVPathsToCache();
        }
      } catch (error) {
        console.error(`❌ Error during system-wide CSV search for existing files:`, error);
        // En caso de error, restaurar los archivos existentes
        existingFiles.forEach((value, key) => {
          csvManager.csvFiles.set(key, value);
        });
      }
    } else {
      // Para otros sistemas operativos, usar la lógica original
    }
  }

  // Nueva función para configurar el CSV watching para archivos existentes en el sistema
  async configureCSVWatchingForExistingFiles() {
    // En macOS, hacer una búsqueda completa del sistema para archivos CSV válidos
    if (this.operatingSystem === 'macos') {
      try {
        // Buscar todos los archivos IPTRADECSV2*.csv en el sistema
        const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2*.csv" -type f 2>/dev/null`;

        // Usar exec asíncrono para evitar crash por exit code 1
        let stdout = '';
        try {
          const result = await execAsync(findCommand, { encoding: 'utf8' });
          stdout = result.stdout;
        } catch (error) {
          // find retorna exit code 1 cuando encuentra archivos pero también errores de permisos
          // Usamos el stdout aunque haya error
          if (error.stdout) {
            stdout = error.stdout;
          }
        }
        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim());

        // Configurar watching para todos los archivos encontrados
        allCsvFiles.forEach(csvPath => {
          if (fs.existsSync(csvPath)) {
            csvManager.csvFiles.set(csvPath, {
              lastModified: csvManager.getFileLastModified(csvPath),
              data: csvManager.parseCSVFile(csvPath),
            });
          }
        });

        // Configurar file watching
        csvManager.startFileWatching();

        // Guardar el cache después de encontrar los archivos CSV
        if (csvManager.csvFiles.size > 0) {
          csvManager.saveCSVPathsToCache();
        }
      } catch (error) {
        console.error(`❌ Error during system-wide CSV search for existing files:`, error);
      }
    } else {
    }

    // Emit idle event after CSV watching configuration is complete
    this.emitLinkPlatformsEvent('idle', {
      message: 'CSV watching configuration completed',
      isLinking: false,
    });
  }

  // Nueva función para configurar el CSV watching específicamente en las rutas encontradas
  async configureCSVWatching(csvPaths) {
    // En Windows, usar el comando PowerShell específico para buscar archivos CSV
    if (this.operatingSystem === 'windows') {
      try {
        // Comando PowerShell para buscar archivos IPTRADECSV2*.csv en todo el sistema
        const findCommand = `Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -File -Force -ErrorAction SilentlyContinue 2>$null |
    Where-Object { $_.Name -like 'IPTRADECSV2*.csv' } |
    Select-Object -ExpandProperty FullName
}`;

        // Usar exec asíncrono para manejar timeouts y errores
        let stdout = '';
        try {
          const result = await execAsync(findCommand, {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
            shell: 'powershell.exe',
          });
          stdout = result.stdout;
        } catch (error) {
          // PowerShell puede retornar error por timeout pero aún encontrar archivos
          // Usamos el stdout aunque haya error
          if (error.stdout) {
            stdout = error.stdout;
          }
        }

        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        // Filtrar solo archivos CSV con formato válido
        const validCsvFiles = [];

        for (const csvPath of allCsvFiles) {
          if (fs.existsSync(csvPath)) {
            try {
              // Leer el archivo como buffer primero para detectar encoding
              const buffer = fs.readFileSync(csvPath);
              let content;

              // Detectar UTF-16 LE BOM (FF FE)
              if (buffer[0] === 0xff && buffer[1] === 0xfe) {
                content = buffer.toString('utf16le');
              } else {
                content = buffer.toString('utf8');
              }

              const lines = content.split('\n').filter(line => line.trim());

              if (lines.length > 0) {
                const firstLine = lines[0];

                // Buscar patrones válidos en cualquier parte de la línea
                // Esto manejará archivos con BOM u otros caracteres al inicio
                const hasBracketFormat = /\[TYPE\]|\[STATUS\]|\[CONFIG\]/.test(firstLine);
                const hasCommaFormat = /^[^\d]*[0-9],[0-9]+,\w+,\w+/.test(firstLine);

                const hasValidFormat = hasBracketFormat || hasCommaFormat;

                if (hasValidFormat) {
                  validCsvFiles.push(csvPath);

                  // Log detallado del contenido del archivo CSV válido
                } else {
                }
              }
            } catch (error) {}
          }
        }

        // Configurar watching para archivos válidos
        validCsvFiles.forEach(csvPath => {
          csvManager.csvFiles.set(csvPath, {
            lastModified: csvManager.getFileLastModified(csvPath),
            data: csvManager.parseCSVFile(csvPath),
          });
        });
      } catch (error) {
        console.error(`❌ Error during Windows system-wide CSV search:`, error);

        // Fallback: usar las rutas originales
        csvPaths.forEach(csvPath => {
          if (fs.existsSync(csvPath)) {
            csvManager.csvFiles.set(csvPath, {
              lastModified: csvManager.getFileLastModified(csvPath),
              data: csvManager.parseCSVFile(csvPath),
            });
          }
        });
      }
    } else if (this.operatingSystem === 'macos') {
      try {
        // Buscar todos los archivos IPTRADECSV2*.csv en el sistema
        // Comando para buscar archivos CSV en todo el sistema
        const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2*.csv" -type f 2>/dev/null`;

        // Usar exec asíncrono para evitar crash por exit code 1
        let stdout = '';
        try {
          const result = await execAsync(findCommand, { encoding: 'utf8' });
          stdout = result.stdout;
        } catch (error) {
          // find retorna exit code 1 cuando encuentra archivos pero también errores de permisos
          // Usamos el stdout aunque haya error
          if (error.stdout) {
            stdout = error.stdout;
          }
        }
        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim());

        // Filtrar solo archivos CSV con formato válido
        const validCsvFiles = [];

        for (const csvPath of allCsvFiles) {
          if (fs.existsSync(csvPath)) {
            try {
              // Leer el archivo como buffer primero para detectar encoding
              const buffer = fs.readFileSync(csvPath);
              let content;

              // Detectar UTF-16 LE BOM (FF FE)
              if (buffer[0] === 0xff && buffer[1] === 0xfe) {
                content = buffer.toString('utf16le');
              } else {
                content = buffer.toString('utf8');
              }

              const lines = content.split('\n').filter(line => line.trim());

              if (lines.length > 0) {
                const firstLine = lines[0];

                // Log para debugging
                // Esto manejará archivos con BOM u otros caracteres al inicio
                const hasBracketFormat = /\[TYPE\]|\[STATUS\]|\[CONFIG\]/.test(firstLine);
                const hasCommaFormat = /^[^\d]*[0-9],[0-9]+,\w+,\w+/.test(firstLine);

                const hasValidFormat = hasBracketFormat || hasCommaFormat;

                if (hasValidFormat) {
                  validCsvFiles.push(csvPath);

                  // Log detallado del contenido del archivo CSV válido
                }
              }
            } catch (error) {
              `❌ Error reading CSV file ${csvPath}: ${error.message}`;
            }
          }
        }

        validCsvFiles.forEach(csvPath => {
          csvManager.csvFiles.set(csvPath, {
            lastModified: csvManager.getFileLastModified(csvPath),
            data: csvManager.parseCSVFile(csvPath),
          });
        });
      } catch (error) {
        console.error(`❌ Error during system-wide CSV search:`, error);

        // Fallback: usar las rutas originales
        csvPaths.forEach(csvPath => {
          if (fs.existsSync(csvPath)) {
            csvManager.csvFiles.set(csvPath, {
              lastModified: csvManager.getFileLastModified(csvPath),
              data: csvManager.parseCSVFile(csvPath),
            });
          }
        });
      }
    } else {
      // Para otros sistemas operativos, usar la lógica original
      csvPaths.forEach(csvPath => {
        if (fs.existsSync(csvPath)) {
          csvManager.csvFiles.set(csvPath, {
            lastModified: csvManager.getFileLastModified(csvPath),
            data: csvManager.parseCSVFile(csvPath),
          });
        }
      });
    }

    // Configurar file watching
    csvManager.startFileWatching();

    `✅ CSV watching configured for ${csvManager.csvFiles.size} files`;
  }



  // Método para emitir eventos de Link Platforms via CSV Manager
  emitLinkPlatformsEvent(eventType, data) {
    try {
      const eventData = {
        type: eventType,
        timestamp: new Date().toISOString(),
        ...data,
      };

      // Store the last result and timestamp for new clients
      if (eventType === 'completed') {
        this.lastLinkPlatformsResult = eventData;
        this.lastLinkPlatformsTimestamp = eventData.timestamp;
      }

      csvManager.emit('linkPlatformsEvent', eventData);
    } catch (error) {
      console.error('Error emitting Link Platforms event:', error);
    }
  }

  // Método para emitir eventos de background scan (NO afecta spinner del frontend)
  emitBackgroundScanEvent(eventType, data) {
    try {
      const eventData = {
        type: eventType,
        timestamp: new Date().toISOString(),
        ...data,
      };
      csvManager.emit('backgroundScanEvent', eventData);
    } catch (error) {
      console.error('Error emitting background scan event:', error);
    }
  }

  // Método para obtener el estado actual
  getLinkingStatus() {
    return {
      isLinking: this.isLinking,
      timestamp: new Date().toISOString(),
      lastResult: this.lastLinkPlatformsResult,
      lastTimestamp: this.lastLinkPlatformsTimestamp,
    };
  }

  // Comparar si dos archivos son diferentes (por tamaño y fecha de modificación)
  areFilesDifferent(sourcePath, targetPath) {
    try {
      if (!fs.existsSync(targetPath)) return true;

      const sourceStats = fs.statSync(sourcePath);
      const targetStats = fs.statSync(targetPath);

      // Comparar por tamaño y fecha de modificación
      return (
        sourceStats.size !== targetStats.size ||
        sourceStats.mtime.getTime() !== targetStats.mtime.getTime()
      );
    } catch (error) {
      // Si hay error al leer stats, asumir que son diferentes
      return true;
    }
  }

  async getAvailableDrives() {
    try {
      switch (this.operatingSystem) {
        case 'windows':
          return await this.getWindowsDrives();
        case 'macos':
          return await this.getMacOSDrives();
        case 'linux':
          return await this.getLinuxDrives();
        default:
          console.warn('⚠️ Unknown OS, using default paths');
          return ['/'];
      }
    } catch (error) {
      console.error('❌ Error getting drives:', error);
      return this.getFallbackDrives();
    }
  }

  async getWindowsDrives() {
    const { stdout } = await execAsync('wmic logicaldisk get caption');
    const drives = stdout
      .split('\n')
      .slice(1) // Remove header
      .map(line => line.trim())
      .filter(line => line && line.length > 0)
      .map(drive => drive + '\\');

    `🔍 Found Windows drives: ${drives.join(', ')}`;
    return drives;
  }

  async getMacOSDrives() {
    // En macOS, MetaTrader se instala típicamente en:
    // - ~/Library/Application Support/MetaQuotes/
    // - /Applications/MetaTrader/
    // - /Volumes/... (discos externos)

    const homeDir = os.homedir();
    const basePaths = [homeDir, '/Applications', '/Volumes'];

    // Rutas específicas comunes de MetaTrader en macOS
    const specificPaths = [
      path.join(homeDir, 'Library', 'Application Support', 'MetaQuotes'),
      path.join(homeDir, 'Library', 'Application Support'),
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Desktop'),
      '/Applications/MetaTrader 4',
      '/Applications/MetaTrader 5',
      '/Applications/MetaTrader',
      '/usr/local/share',
    ];

    // Combinar todas las rutas
    basePaths.push(...specificPaths);

    // También obtener volúmenes montados
    try {
      const { stdout } = await execAsync('ls /Volumes');
      const volumes = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.length > 0 && line !== 'Macintosh HD')
        .map(volume => `/Volumes/${volume}`);

      basePaths.push(...volumes);
    } catch (error) {
      console.warn('⚠️ Could not list mounted volumes:', error.message);
    }

    // Filtrar rutas que existen y eliminar duplicados
    const uniquePaths = [...new Set(basePaths)];
    const existingPaths = uniquePaths.filter(pathStr => {
      try {
        return fs.existsSync(pathStr);
      } catch (error) {
        return false;
      }
    });

    // Log de rutas específicas de MetaTrader encontradas
    const metaTraderPaths = existingPaths.filter(
      pathStr =>
        pathStr.toLowerCase().includes('metaquotes') || pathStr.toLowerCase().includes('metatrader')
    );

    return existingPaths;
  }

  async getLinuxDrives() {
    // En Linux, buscar en directorios comunes
    const homeDir = os.homedir();
    const basePaths = [homeDir, '/opt', '/usr/local', '/home'];

    // Rutas específicas de Wine y MetaTrader en Linux
    const specificPaths = [
      path.join(homeDir, '.wine', 'drive_c'),
      path.join(homeDir, '.wine', 'drive_c', 'Program Files'),
      path.join(homeDir, '.wine', 'drive_c', 'Program Files (x86)'),
      path.join(homeDir, '.wine', 'drive_c', 'users', process.env.USER || 'user', 'AppData'),
      path.join(homeDir, '.local', 'share', 'applications'),
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Desktop'),
      '/snap',
      '/var/lib/flatpak',
      '/usr/share/applications',
    ];

    // Combinar todas las rutas
    basePaths.push(...specificPaths);

    // También obtener puntos de montaje
    try {
      const { stdout } = await execAsync('mount | grep -E "^/dev" | awk \'{print $3}\'');
      const mountPoints = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.length > 0 && !line.startsWith('/snap/'));

      basePaths.push(...mountPoints);
      `📀 Found mount points: ${mountPoints.join(', ')}`;
    } catch (error) {
      console.warn('⚠️ Could not list mount points:', error.message);
    }

    // Filtrar rutas que existen y eliminar duplicados
    const uniquePaths = [...new Set(basePaths)];
    const existingPaths = uniquePaths.filter(pathStr => {
      try {
        return fs.existsSync(pathStr);
      } catch (error) {
        return false;
      }
    });

    const winePaths = existingPaths.filter(
      pathStr =>
        pathStr.includes('.wine') ||
        pathStr.toLowerCase().includes('metatrader') ||
        pathStr.toLowerCase().includes('metaquotes')
    );

    return existingPaths;
  }

  getFallbackDrives() {
    const homeDir = os.homedir();

    switch (this.operatingSystem) {
      case 'windows':
        return ['C:\\', 'D:\\', path.join(homeDir, 'AppData')];
      case 'macos':
        return [
          homeDir,
          '/Applications',
          path.join(homeDir, 'Library', 'Application Support'),
          path.join(homeDir, 'Documents'),
        ];
      case 'linux':
        return [
          homeDir,
          '/opt',
          path.join(homeDir, '.wine', 'drive_c'),
          path.join(homeDir, 'Documents'),
        ];
      default:
        return ['/'];
    }
  }

  async scanDrive(drivePath, searchOnly = false) {
    const result = {
      mql4Folders: [],
      mql5Folders: [],
      ctraderFolders: [],
      ninjaTraderFolders: [],
      created: 0,
      synced: 0,
      errors: [],
      filesCreated: 0,
      csvFiles: [],
    };

    try {
      // Buscar MQL4, MQL5, cTrader y NinjaTrader (solo Windows) en UNA SOLA PASADA para máxima eficiencia
      const { mql4Folders, mql5Folders, ctraderFolders } = await this.findBothMQLFolders();
      const ninjaTraderFolders = await this.findNinjaTraderFolders();

      // Solo agregar carpetas al resultado
      result.mql4Folders = mql4Folders;
      result.mql5Folders = mql5Folders;
      result.ctraderFolders = ctraderFolders;
      result.ninjaTraderFolders = ninjaTraderFolders;

      // Emitir evento de inicio de sincronización
      if (
        !searchOnly &&
        (mql4Folders.length > 0 || mql5Folders.length > 0 || ctraderFolders.length > 0 || ninjaTraderFolders.length > 0)
      ) {
        csvManager.emit('linkPlatformsEvent', {
          type: 'syncing',
          message: 'Syncing Expert Advisors to platforms...',
          timestamp: new Date().toISOString(),
        });
      }

      // Procesar carpetas MQL4 solo si no es búsqueda únicamente
      if (!searchOnly) {
        for (const folder of mql4Folders) {
          try {
            const expertsPath = path.join(folder, 'Experts');
            const filesPath = path.join(folder, 'Files');

            if (!fs.existsSync(expertsPath)) {
              fs.mkdirSync(expertsPath, { recursive: true });
              result.created++;
            }

            // Get all MQL4 bot files (.mq4 extension)
            const mql4BotFiles = this.getBotFilesByExtension('.mq4');
            
            // Copy all MQL4 bot files to ensure latest versions
            for (const botFile of mql4BotFiles) {
              if (fs.existsSync(botFile.path)) {
                const targetBotPath = path.join(expertsPath, botFile.name);
                fs.copyFileSync(botFile.path, targetBotPath);
                result.synced++;
              }
            }

            // Ensure Files folder and CSV exist
            if (!fs.existsSync(filesPath)) {
              fs.mkdirSync(filesPath, { recursive: true });
              result.created++;
            }

            // Only detect existing CSV files, don't create them
            const csvFiles = fs
              .readdirSync(filesPath)
              .filter(file => file.includes('IPTRADECSV2') && file.endsWith('.csv'));

            if (csvFiles.length > 0) {
              csvFiles.forEach(csvFile => {
                const csvPath = path.join(filesPath, csvFile);
                result.csvFiles.push(csvPath);
              });
            } else {
            }
          } catch (error) {
            result.errors.push(`Error processing MQL4 folder ${folder}: ${error.message}`);
          }
        }
      }

      // Solo agregar carpetas al resultado
      result.mql5Folders = mql5Folders;

      // Procesar carpetas MQL5 solo si no es búsqueda únicamente
      if (!searchOnly) {
        for (const folder of mql5Folders) {
          try {
            const expertsPath = path.join(folder, 'Experts');
            const filesPath = path.join(folder, 'Files');

            if (!fs.existsSync(expertsPath)) {
              fs.mkdirSync(expertsPath, { recursive: true });
              result.created++;
            }

            // Get all MQL5 bot files (.mq5 extension)
            const mql5BotFiles = this.getBotFilesByExtension('.mq5');
            
            // Copy all MQL5 bot files to ensure latest versions
            for (const botFile of mql5BotFiles) {
              if (fs.existsSync(botFile.path)) {
                const targetBotPath = path.join(expertsPath, botFile.name);
                fs.copyFileSync(botFile.path, targetBotPath);
                result.synced++;
              }
            }

            // Ensure Files folder and CSV exist
            if (!fs.existsSync(filesPath)) {
              fs.mkdirSync(filesPath, { recursive: true });
              result.created++;
            }

            // Only detect existing CSV files, don't create them
            const csvFiles = fs
              .readdirSync(filesPath)
              .filter(file => file.includes('IPTRADECSV2') && file.endsWith('.csv'));

            if (csvFiles.length > 0) {
              csvFiles.forEach(csvFile => {
                const csvPath = path.join(filesPath, csvFile);
                result.csvFiles.push(csvPath);
              });
            } else {
            }
          } catch (error) {
            result.errors.push(`Error processing MQL5 folder ${folder}: ${error.message}`);
          }
        }
      }

      // Procesar carpetas cTrader solo si no es búsqueda únicamente y cTrader está habilitado
      if (!searchOnly && this.cTraderEnabled) {
        for (const folder of ctraderFolders) {
          try {
            // Determine the correct structure based on the folder name
            const folderName = path.basename(folder).toUpperCase();
            let expertsPath, filesPath;

            if (folderName === 'CALGO') {
              // cAlgo structure: cAlgo/cAlgo/Robots and cAlgo/cAlgo/Files
              expertsPath = path.join(folder, 'cAlgo', 'Robots');
              filesPath = path.join(folder, 'cAlgo', 'Files');
            } else if (folderName === 'SPOTWARE') {
              // Spotware structure: Spotware/cTrader/Robots and Spotware/cTrader/Files
              expertsPath = path.join(folder, 'cTrader', 'Robots');
              filesPath = path.join(folder, 'cTrader', 'Files');
            } else {
              // Default cTrader structure: cTrader/Experts and cTrader/Files
              expertsPath = path.join(folder, 'Experts');
              filesPath = path.join(folder, 'Files');
            }

            if (!fs.existsSync(expertsPath)) {
              fs.mkdirSync(expertsPath, { recursive: true });
              result.created++;
            }

            // Get all cTrader bot files (.cs extension)
            const ctraderBotFiles = this.getBotFilesByExtension('.cs');
            
            // Copy all cTrader bot files to ensure latest versions
            for (const botFile of ctraderBotFiles) {
              if (fs.existsSync(botFile.path)) {
                const targetBotPath = path.join(expertsPath, botFile.name);
                fs.copyFileSync(botFile.path, targetBotPath);
                result.synced++;
              }
            }

            // Ensure Files folder and CSV exist
            if (!fs.existsSync(filesPath)) {
              fs.mkdirSync(filesPath, { recursive: true });
              result.created++;
            }

            // Only detect existing CSV files, don't create them
            const csvFiles = fs
              .readdirSync(filesPath)
              .filter(file => file.includes('IPTRADECSV2') && file.endsWith('.csv'));

            if (csvFiles.length > 0) {
              csvFiles.forEach(csvFile => {
                const csvPath = path.join(filesPath, csvFile);
                result.csvFiles.push(csvPath);
              });
            } else {
            }
          } catch (error) {
            result.errors.push(`Error processing cTrader folder ${folder}: ${error.message}`);
          }
        }
      }

      // Procesar carpetas NinjaTrader solo si no es búsqueda únicamente (solo Windows)
      if (!searchOnly) {
        for (const folder of ninjaTraderFolders) {
          try {
            await this.processNinjaTraderFolder(folder, result);
          } catch (error) {
            result.errors.push(`Error processing NinjaTrader folder ${folder}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error scanning drive ${drivePath}: ${error.message}`);
    }

    return result;
  }

  // Búsqueda simple y rápida de MQL4 y MQL5 con detección de OS
  async findBothMQLFolders() {
    switch (this.operatingSystem) {
      case 'windows':
        return await this.findBothMQLFoldersWindows();
      case 'macos':
        return await this.findBothMQLFoldersMacOS();
      case 'linux':
        return await this.findBothMQLFoldersLinux();
      default:
        console.warn('⚠️ Unknown OS, using Linux fallback');
        return await this.findBothMQLFoldersLinux();
    }
  }

  // Búsqueda específica para NinjaTrader 8 (solo Windows)
  async findNinjaTraderFolders() {
    // NinjaTrader solo está soportado en Windows
    if (this.operatingSystem === 'windows') {
      return await this.findNinjaTraderFoldersWindows();
    } else {
      console.log('ℹ️ NinjaTrader detection skipped - only supported on Windows');
      return [];
    }
  }

  // Búsqueda específica para Windows - usa el comando PowerShell específico
  async findBothMQLFoldersWindows() {
    try {
      const platformsText = this.cTraderEnabled ? 'MQL4, MQL5, cTrader' : 'MQL4, MQL5';

      // Comando PowerShell específico para buscar carpetas MQL4, MQL5 y opcionalmente cTrader
      const searchTargets = this.cTraderEnabled
        ? "@('MQL4','MQL5','cTrader','cAlgo','Spotware')"
        : "@('MQL4','MQL5')";

      const command = `Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -Directory -ErrorAction SilentlyContinue -Force 2>$null |
    Where-Object { $_.Name -in ${searchTargets} } |
    Select-Object -ExpandProperty FullName
}`;

      // Usar exec asíncrono para manejar timeouts y errores
      let stdout = '';
      try {
        const result = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
          shell: 'powershell.exe',
        });
        stdout = result.stdout;
      } catch (error) {
        // PowerShell puede retornar error por timeout pero aún encontrar carpetas
        // Usamos el stdout aunque haya error
        if (error.stdout) {
          stdout = error.stdout;
        }
      }

      const allFolders = stdout
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Separar MQL4, MQL5 y opcionalmente cTrader usando el mismo comando unificado
      const mql4Folders = allFolders.filter(
        folder => folder.endsWith('\\MQL4') || folder.endsWith('/MQL4')
      );
      const mql5Folders = allFolders.filter(
        folder => folder.endsWith('\\MQL5') || folder.endsWith('/MQL5')
      );
      const ctraderFolders = this.cTraderEnabled
        ? allFolders.filter(
            folder =>
              folder.endsWith('\\cTrader') ||
              folder.endsWith('/cTrader') ||
              folder.endsWith('\\cAlgo') ||
              folder.endsWith('/cAlgo') ||
              folder.endsWith('\\Spotware') ||
              folder.endsWith('/Spotware')
          )
        : [];

      // Remover duplicados
      const uniqueMQL4 = [...new Set(mql4Folders)];
      const uniqueMQL5 = [...new Set(mql5Folders)];
      const uniqueCtrader = [...new Set(ctraderFolders)];

      return {
        mql4Folders: uniqueMQL4,
        mql5Folders: uniqueMQL5,
        ctraderFolders: uniqueCtrader,
      };
    } catch (error) {
      console.error(`❌ Error in Windows MQL search: ${error.message}`);
      return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
    }
  }

  // Búsqueda específica para macOS
  async findBothMQLFoldersMacOS() {
    const homeDir = os.homedir();

    // Comando optimizado para macOS - incluye opcionalmente cTrader, cAlgo y Spotware
    const searchTargets = this.cTraderEnabled
      ? '-name "MQL4" -o -name "MQL5" -o -name "cTrader" -o -name "cAlgo" -o -name "Spotware"'
      : '-name "MQL4" -o -name "MQL5"';

    const command = `find "${homeDir}" \\( ${searchTargets} \\) -type d 2>/dev/null`;

    try {
      const result = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
        shell: '/bin/zsh',
        env: {
          ...process.env,
          PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
          HOME: homeDir,
        },
      });

      if (result.stdout && result.stdout.trim()) {
        const allFolders = result.stdout
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        const categorizedResult = {
          mql4Folders: allFolders.filter(folder => folder.endsWith('/MQL4')),
          mql5Folders: allFolders.filter(folder => folder.endsWith('/MQL5')),
          ctraderFolders: this.cTraderEnabled
            ? allFolders.filter(
                folder =>
                  folder.endsWith('/cTrader') ||
                  folder.endsWith('/cAlgo') ||
                  folder.endsWith('/Spotware')
              )
            : [],
        };

        return categorizedResult;
      }

      return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
    } catch (error) {
      console.error(`❌ Error during macOS platform search:`, error.message);

      // Si el error es por timeout o permisos, retornar resultado vacío en lugar de fallar
      if (error.code === 'ETIMEDOUT' || error.message.includes('Permission denied')) {
        return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
      }

      // Para otros errores, también retornar resultado vacío para evitar que el proceso falle
      return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
    }
  }

  // Búsqueda específica para Linux
  async findBothMQLFoldersLinux() {
    const homeDir = os.homedir();

    // Comando optimizado para Linux - incluye opcionalmente cTrader, cAlgo y Spotware
    const searchTargets = this.cTraderEnabled
      ? '-name "MQL4" -o -name "MQL5" -o -name "cTrader" -o -name "cAlgo" -o -name "Spotware"'
      : '-name "MQL4" -o -name "MQL5"';

    const command = `find "${homeDir}" \\( ${searchTargets} \\) -type d 2>/dev/null`;

    try {
      const result = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
        shell: '/bin/bash',
        env: {
          ...process.env,
          PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
          HOME: homeDir,
        },
      });

      if (result.stdout && result.stdout.trim()) {
        const allFolders = result.stdout
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        const categorizedResult = {
          mql4Folders: allFolders.filter(folder => folder.endsWith('/MQL4')),
          mql5Folders: allFolders.filter(folder => folder.endsWith('/MQL5')),
          ctraderFolders: this.cTraderEnabled
            ? allFolders.filter(
                folder =>
                  folder.endsWith('/cTrader') ||
                  folder.endsWith('/cAlgo') ||
                  folder.endsWith('/Spotware')
              )
            : [],
        };

        return categorizedResult;
      }

      return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
    } catch (error) {
      console.error(`❌ Error during Linux MQL search:`, error.message);

      // Si el error es por timeout o permisos, retornar resultado vacío en lugar de fallar
      if (error.code === 'ETIMEDOUT' || error.message.includes('Permission denied')) {
        return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
      }

      // Para otros errores, también retornar resultado vacío para evitar que el proceso falle
      return { mql4Folders: [], mql5Folders: [], ctraderFolders: [] };
    }
  }

  // Búsqueda específica para NinjaTrader en Windows
  async findNinjaTraderFoldersWindows() {
    try {
      const homeDir = os.homedir();
      const documentsPath = path.join(homeDir, 'Documents');
      
      // Rutas típicas de NinjaTrader 8 en Windows
      const ninjaTraderPaths = [
        path.join(documentsPath, 'NinjaTrader 8'),
        path.join(documentsPath, 'NinjaTrader'),
        path.join(homeDir, 'AppData', 'Local', 'NinjaTrader 8'),
        path.join(homeDir, 'AppData', 'Roaming', 'NinjaTrader 8'),
      ];

      const foundFolders = [];

      // Verificar rutas específicas
      for (const ninjaPath of ninjaTraderPaths) {
        if (fs.existsSync(ninjaPath)) {
          foundFolders.push(ninjaPath);
        }
      }

      // También buscar usando PowerShell para encontrar instalaciones en otras ubicaciones
      const command = `Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -Directory -ErrorAction SilentlyContinue -Force 2>$null |
    Where-Object { $_.Name -like "*NinjaTrader*" -and $_.Name -notlike "*cache*" -and $_.Name -notlike "*temp*" } |
    Select-Object -ExpandProperty FullName
}`;

      let stdout = '';
      try {
        const result = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
          shell: 'powershell.exe',
        });
        stdout = result.stdout;
      } catch (error) {
        if (error.stdout) {
          stdout = error.stdout;
        }
      }

      const allFolders = stdout
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.includes('cache') && !line.includes('temp'));

      // Agregar carpetas encontradas por PowerShell
      foundFolders.push(...allFolders);

      // Remover duplicados y filtrar solo carpetas válidas
      const uniqueFolders = [...new Set(foundFolders)].filter(folder => {
        try {
          return fs.existsSync(folder) && fs.statSync(folder).isDirectory();
        } catch (error) {
          return false;
        }
      });

      console.log(`🔍 Found ${uniqueFolders.length} NinjaTrader folders: ${uniqueFolders.join(', ')}`);
      return uniqueFolders;
    } catch (error) {
      console.error(`❌ Error in Windows NinjaTrader search: ${error.message}`);
      return [];
    }
  }


  // Procesar una carpeta NinjaTrader individual (solo Windows)
  async processNinjaTraderFolder(folder, result) {
    try {
      // Verificar que estamos en Windows
      if (this.operatingSystem !== 'windows') {
        console.log('ℹ️ NinjaTrader processing skipped - only supported on Windows');
        return;
      }

      // Determinar la estructura correcta basada en el nombre de la carpeta
      const folderName = path.basename(folder).toUpperCase();
      let customPath, filesPath;

      if (folderName.includes('NINJATRADER 8') || folderName.includes('NINJATRADER8')) {
        // NinjaTrader 8 structure: Documents/NinjaTrader 8/bin/Custom and Documents/NinjaTrader 8/Files
        customPath = path.join(folder, 'bin', 'Custom');
        filesPath = path.join(folder, 'Files');
      } else {
        // Default NinjaTrader structure: NinjaTrader/bin/Custom and NinjaTrader/Files
        customPath = path.join(folder, 'bin', 'Custom');
        filesPath = path.join(folder, 'Files');
      }

      // Ensure Custom folder exists for bot installation
      if (!fs.existsSync(customPath)) {
        fs.mkdirSync(customPath, { recursive: true });
        result.created++;
      }

      // Get all NinjaTrader bot files (.zip extension)
      const ninjaTraderBotFiles = this.getBotFilesByExtension('.zip');
      
      // Copy all NinjaTrader bot files to ensure latest versions
      for (const botFile of ninjaTraderBotFiles) {
        if (fs.existsSync(botFile.path)) {
          const targetBotPath = path.join(customPath, botFile.name);
          fs.copyFileSync(botFile.path, targetBotPath);
          result.synced++;
        }
      }

      // Ensure Files folder exists for CSV files
      if (!fs.existsSync(filesPath)) {
        fs.mkdirSync(filesPath, { recursive: true });
        result.created++;
      }

      // Look for existing CSV files with IPTRADECSV2 pattern
      const csvFiles = fs
        .readdirSync(filesPath)
        .filter(file => file.includes('IPTRADECSV2') && file.endsWith('.csv'));

      if (csvFiles.length > 0) {
        // Found existing CSV files
        csvFiles.forEach(csvFile => {
          const csvPath = path.join(filesPath, csvFile);
          result.csvFiles.push(csvPath);

          // Register the CSV file in csvManager for watching
          try {
            csvManager.addCSVFile(csvPath);
          } catch (error) {
            console.error(`❌ Error registering CSV file for watching: ${error.message}`);
          }
        });
      } else {
        // Create new CSV file with NinjaTrader-specific name
        const csvFileName = `IPTRADECSV2NINJA.csv`;
        const csvPath = path.join(filesPath, csvFileName);

        // Create empty CSV file with basic structure
        const emptyCSVContent = `[TYPE][NINJATRADER][0]
[STATUS][OFFLINE][0]
[CONFIG][PENDING]`;

        fs.writeFileSync(csvPath, emptyCSVContent, 'utf8');
        result.csvFiles.push(csvPath);
        result.filesCreated++;

        // Register the new CSV file in csvManager for watching
        try {
          csvManager.addCSVFile(csvPath);
        } catch (error) {
          console.error(`❌ Error registering CSV file for watching: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Error processing NinjaTrader folder ${folder}: ${error.message}`);
      console.error(`❌ Error processing NinjaTrader folder:`, error);
    }
  }

  // Método simple de búsqueda individual (usado solo como fallback)
  async findFoldersRecursively(rootPath, folderName) {
    const homeDir = os.homedir();

    try {
      const command = `find "${homeDir}" -name "${folderName}" -type d 2>/dev/null`;
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15000,
        shell: '/bin/bash',
      });

      const folders = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      return folders;
    } catch (error) {
      console.error(`❌ Error finding ${folderName}: ${error.message}`);
      return [];
    }
  }
}

export default new LinkPlatformsController();
