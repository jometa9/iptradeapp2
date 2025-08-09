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
  }

  // Detectar el sistema operativo
  detectOperatingSystem() {
    const platform = os.platform();
    console.log(`🖥️ Detected operating system: ${platform}`);

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

  async linkPlatforms(req, res) {
    try {
      console.log('🔗 Starting Link Platforms process...');

      const result = await this.findAndSyncMQLFoldersOptimized();

      res.json({
        success: true,
        message: 'Link Platforms process completed',
        result,
      });
    } catch (error) {
      console.error('❌ Link Platforms error:', error);
      res.status(500).json({
        success: false,
        message: 'Link Platforms process failed',
        error: error.message,
      });
    }
  }

  async findAndSyncMQLFolders() {
    console.log('🔗 Starting Link Platforms process...');

    // Track linking state
    this.isLinking = true;
    console.log('📊 Link Platforms state set to TRUE:', this.isLinking);

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
          // Aggregate CSV creation results
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

      console.log(
        `✅ Link Platforms completed: ${result.mql4Folders.length} MQL4 folders, ${result.mql5Folders.length} MQL5 folders`
      );
      console.log(
        `📁 Created: ${result.created}, Synced: ${result.synced}, Errors: ${result.errors.length}`
      );
      console.log(`📄 CSV files created: ${result.filesCreated}`);

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
      console.log('📊 Link Platforms state set to FALSE:', this.isLinking);
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
        console.log(
          `💾 Loaded cached MQL paths: ${this.cachedPaths?.mql4Folders?.length || 0} MQL4 + ${this.cachedPaths?.mql5Folders?.length || 0} MQL5 folders`
        );
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
      console.log(
        `💾 Saved ${paths.mql4Folders.length + paths.mql5Folders.length} MQL paths to cache`
      );
    } catch (error) {
      console.error('❌ Error saving cache:', error);
    }
  }

  // Verificar si el cache es válido
  isCacheValid() {
    if (!this.cachedPaths || !this.lastScanTime) return false;

    const now = new Date();
    const cacheAge = (now - this.lastScanTime) / (1000 * 60 * 60); // horas
    return cacheAge < this.cacheValidityHours;
  }

  // Buscar y sincronizar MQL folders con cache optimizado
  async findAndSyncMQLFoldersOptimized() {
    console.log('🔗 Starting optimized Link Platforms process...');

    // Track linking state
    this.isLinking = true;
    console.log('📊 Link Platforms state set to TRUE:', this.isLinking);

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
      // 1. Intentar cargar cache
      this.loadCacheFromFile();

      if (this.isCacheValid()) {
        console.log('⚡ Using cached paths for immediate processing...');
        result.usedCache = true;

        // Procesar rutas cacheadas inmediatamente
        await this.processCachedPaths(this.cachedPaths, result);

        // Configurar CSV watching para rutas cacheadas
        if (result.csvFiles.length > 0) {
          await this.configureCSVWatching(result.csvFiles);
        }

        // Emitir evento de finalización rápida
        this.emitLinkPlatformsEvent('completed', {
          message: 'Link Platforms completed using cached paths',
          result,
        });

        // Iniciar búsqueda en background para nuevas rutas (NO bloquea la respuesta)
        console.log('🔄 Starting background scan for new MQL installations...');
        result.backgroundScan = true;

        // Ejecutar en background sin esperar (Promise no bloqueante)
        this.performBackgroundScan().catch(error => {
          console.error('❌ Background scan error (non-blocking):', error);
        });
      } else {
        console.log('🔍 No valid cache found, performing full scan...');
        await this.performFullScan(result);
      }
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
      console.log('📊 Link Platforms state set to FALSE:', this.isLinking);
    }

    return result;
  }

  // Procesar rutas cacheadas
  async processCachedPaths(cachedPaths, result) {
    console.log(
      `⚡ Processing ${cachedPaths.mql4Folders.length} cached MQL4 + ${cachedPaths.mql5Folders.length} cached MQL5 folders...`
    );

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

    console.log(
      `⚡ Cached processing completed: ${result.mql4Folders.length} MQL4 + ${result.mql5Folders.length} MQL5 folders`
    );
  }

  // Procesar una carpeta MQL individual
  async processMQLFolder(folder, type, result) {
    try {
      const expertPath = path.join(folder, 'Experts');
      const filesPath = path.join(folder, 'Files');
      const botFileName = `${type}.mq${type === 'MQL4' ? '4' : '5'}`;
      const botPath = path.join(this.botsPath, botFileName);

      // Ensure Experts folder exists
      if (!fs.existsSync(expertPath)) {
        fs.mkdirSync(expertPath, { recursive: true });
        result.created++;
        console.log(`📁 Created ${type}/Experts folder: ${expertPath}`);
      }

      // Copy bot only if it doesn't exist or is different
      const targetBotPath = path.join(expertPath, botFileName);
      if (fs.existsSync(botPath)) {
        if (!fs.existsSync(targetBotPath) || this.areFilesDifferent(botPath, targetBotPath)) {
          fs.copyFileSync(botPath, targetBotPath);
          result.synced++;
          console.log(`📋 Synced ${type} bot to: ${targetBotPath}`);
        }
      }

      // Ensure Files folder and CSV exist
      if (!fs.existsSync(filesPath)) {
        fs.mkdirSync(filesPath, { recursive: true });
        result.created++;
        console.log(`📁 Created ${type}/Files folder: ${filesPath}`);
      }

      const csvPath = path.join(filesPath, 'IPTRADECSV2.csv');
      if (!fs.existsSync(csvPath)) {
        const header = 'timestamp,account_id,account_type,status,action,data,master_id,platform\n';
        fs.writeFileSync(csvPath, header, { encoding: 'utf8' });
        result.filesCreated++;
        result.csvFiles.push(csvPath);
        console.log(`🆕 Created CSV file: ${csvPath}`);
      } else {
        result.csvFiles.push(csvPath);
      }
    } catch (error) {
      result.errors.push(`Error processing ${type} folder ${folder}: ${error.message}`);
      console.error(`❌ Error processing ${type} folder:`, error);
    }
  }

  // Realizar búsqueda completa (sin cache)
  async performFullScan(result) {
    // Buscar todas las unidades de disco en Windows
    const drives = await this.getAvailableDrives();

    for (const drive of drives) {
      try {
        console.log(`🔍 Scanning drive ${drive} for MQL folders...`);
        const driveResult = await this.scanDrive(drive);

        result.mql4Folders.push(...driveResult.mql4Folders);
        result.mql5Folders.push(...driveResult.mql5Folders);
        result.created += driveResult.created;
        result.synced += driveResult.synced;
        result.errors.push(...driveResult.errors);
        result.filesCreated += driveResult.filesCreated;
        result.csvFiles.push(...driveResult.csvFiles);
      } catch (error) {
        result.errors.push(`Error scanning drive ${drive}: ${error.message}`);
        console.error(`❌ Error scanning drive ${drive}:`, error);
      }
    }

    console.log(
      `✅ Full scan completed: ${result.mql4Folders.length} MQL4 folders, ${result.mql5Folders.length} MQL5 folders`
    );
    console.log(
      `📁 Created: ${result.created}, Synced: ${result.synced}, Errors: ${result.errors.length}`
    );
    console.log(`📄 CSV files created: ${result.filesCreated}`);

    // Guardar nuevo cache
    const pathsToCache = {
      mql4Folders: result.mql4Folders,
      mql5Folders: result.mql5Folders,
    };
    this.cachedPaths = pathsToCache;
    this.lastScanTime = new Date();
    this.saveCacheToFile(pathsToCache);

    // Configurar CSV watching
    if (result.csvFiles.length > 0) {
      await this.configureCSVWatching(result.csvFiles);
    }

    // Emitir evento de finalización exitosa
    this.emitLinkPlatformsEvent('completed', {
      message: 'Link Platforms process completed successfully',
      result,
    });
  }

  // Realizar búsqueda en background para nuevas instalaciones (SIN afectar frontend)
  async performBackgroundScan() {
    try {
      console.log('🔄 Background scan: Looking for new MQL installations...');
      console.log('ℹ️ Background scan running silently - no frontend spinner will be shown');

      const drives = await this.getAvailableDrives();
      const newPaths = { mql4Folders: [], mql5Folders: [] };

      for (const drive of drives) {
        try {
          const driveResult = await this.scanDrive(drive, true); // Solo buscar, no procesar
          newPaths.mql4Folders.push(...driveResult.mql4Folders);
          newPaths.mql5Folders.push(...driveResult.mql5Folders);
        } catch (error) {
          console.error(`❌ Background scan error on drive ${drive}:`, error);
        }
      }

      // Comparar con cache actual
      const currentMQL4 = this.cachedPaths?.mql4Folders || [];
      const currentMQL5 = this.cachedPaths?.mql5Folders || [];

      const newMQL4 = newPaths.mql4Folders.filter(path => !currentMQL4.includes(path));
      const newMQL5 = newPaths.mql5Folders.filter(path => !currentMQL5.includes(path));

      if (newMQL4.length > 0 || newMQL5.length > 0) {
        console.log(
          `🆕 Background scan found new installations: ${newMQL4.length} MQL4 + ${newMQL5.length} MQL5`
        );
        console.log('🔧 Processing new installations in background...');

        // Procesar nuevas rutas SIN cambiar estado de linking
        const backgroundResult = {
          mql4Folders: newMQL4,
          mql5Folders: newMQL5,
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

        // Actualizar cache
        const updatedPaths = {
          mql4Folders: [...currentMQL4, ...newMQL4],
          mql5Folders: [...currentMQL5, ...newMQL5],
        };
        this.cachedPaths = updatedPaths;
        this.lastScanTime = new Date();
        this.saveCacheToFile(updatedPaths);

        // Configurar watching para nuevos CSVs
        if (backgroundResult.csvFiles.length > 0) {
          await this.configureCSVWatching(backgroundResult.csvFiles);
        }

        console.log(
          `✅ Background sync completed: ${backgroundResult.synced} new bots synced silently`
        );

        // Emitir evento especial de background (opcional - para logs del frontend)
        this.emitBackgroundScanEvent('completed', {
          message: `Background scan found and synced ${newMQL4.length + newMQL5.length} new installations`,
          newInstallations: {
            mql4: newMQL4.length,
            mql5: newMQL5.length,
            synced: backgroundResult.synced,
          },
        });
      } else {
        console.log('ℹ️ Background scan: No new MQL installations found');
        this.emitBackgroundScanEvent('completed', {
          message: 'Background scan completed - no new installations found',
          newInstallations: { mql4: 0, mql5: 0, synced: 0 },
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

  // Nueva función para configurar el CSV watching específicamente en las rutas encontradas
  async configureCSVWatching(csvPaths) {
    console.log(`🔧 Configuring CSV watching for ${csvPaths.length} specific paths...`);

    // Actualizar CSV manager con las rutas específicas encontradas
    csvPaths.forEach(csvPath => {
      if (fs.existsSync(csvPath)) {
        csvManager.csvFiles.set(csvPath, {
          lastModified: csvManager.getFileLastModified(csvPath),
          data: csvManager.parseCSVFile(csvPath),
        });
        console.log(`📍 Added CSV to watch list: ${csvPath}`);
      }
    });

    // Configurar file watching específicamente para estas rutas
    csvManager.startFileWatching();

    console.log(`✅ CSV watching configured for ${csvManager.csvFiles.size} files`);
  }

  // Método para emitir eventos de Link Platforms via CSV Manager
  emitLinkPlatformsEvent(eventType, data) {
    try {
      const eventData = {
        type: eventType,
        timestamp: new Date().toISOString(),
        ...data,
      };
      console.log(`📡 Emitting Link Platforms event: ${eventType}`);
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
      console.log(`🔇 Emitting silent background scan event: ${eventType}`);
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
      console.log(`🔍 Getting available drives for ${this.operatingSystem}...`);

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

    console.log(`🔍 Found Windows drives: ${drives.join(', ')}`);
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
      console.log(`📀 Found mounted volumes: ${volumes.join(', ')}`);
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

    console.log(`🔍 Found macOS paths: ${existingPaths.join(', ')}`);

    // Log de rutas específicas de MetaTrader encontradas
    const metaTraderPaths = existingPaths.filter(
      pathStr =>
        pathStr.toLowerCase().includes('metaquotes') || pathStr.toLowerCase().includes('metatrader')
    );
    if (metaTraderPaths.length > 0) {
      console.log(`🎯 Found specific MetaTrader paths: ${metaTraderPaths.join(', ')}`);
    }

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
      console.log(`📀 Found mount points: ${mountPoints.join(', ')}`);
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

    console.log(`🔍 Found Linux paths: ${existingPaths.join(', ')}`);

    // Log de rutas específicas de Wine/MetaTrader encontradas
    const winePaths = existingPaths.filter(
      pathStr =>
        pathStr.includes('.wine') ||
        pathStr.toLowerCase().includes('metatrader') ||
        pathStr.toLowerCase().includes('metaquotes')
    );
    if (winePaths.length > 0) {
      console.log(`🍷 Found Wine/MetaTrader paths: ${winePaths.join(', ')}`);
    }

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
      created: 0,
      synced: 0,
      errors: [],
      filesCreated: 0,
      csvFiles: [],
    };

    try {
      // Buscar carpetas MQL4 y MQL5 recursivamente
      const mql4Folders = await this.findFoldersRecursively(drivePath, 'MQL4');
      const mql5Folders = await this.findFoldersRecursively(drivePath, 'MQL5');

      // Solo agregar carpetas al resultado
      result.mql4Folders = mql4Folders;

      // Procesar carpetas MQL4 solo si no es búsqueda únicamente
      if (!searchOnly) {
        for (const folder of mql4Folders) {
          try {
            const expertsPath = path.join(folder, 'Experts');
            const botPath = path.join(this.botsPath, 'MQL4.mq4');
            const filesPath = path.join(folder, 'Files');

            if (!fs.existsSync(expertsPath)) {
              fs.mkdirSync(expertsPath, { recursive: true });
              result.created++;
              console.log(`📁 Created MQL4/Experts folder: ${expertsPath}`);
            }

            const targetBotPath = path.join(expertsPath, 'MQL4.mq4');
            if (fs.existsSync(botPath)) {
              if (!fs.existsSync(targetBotPath) || this.areFilesDifferent(botPath, targetBotPath)) {
                fs.copyFileSync(botPath, targetBotPath);
                result.synced++;
                console.log(`📋 Synced MQL4 bot to: ${targetBotPath}`);
              }
            }

            // Ensure Files folder and CSV exist
            if (!fs.existsSync(filesPath)) {
              fs.mkdirSync(filesPath, { recursive: true });
              result.created++;
              console.log(`📁 Created MQL4/Files folder: ${filesPath}`);
            }

            const csvPath = path.join(filesPath, 'IPTRADECSV2.csv');
            if (!fs.existsSync(csvPath)) {
              const header =
                'timestamp,account_id,account_type,status,action,data,master_id,platform\n';
              fs.writeFileSync(csvPath, header, { encoding: 'utf8' });
              result.filesCreated++;
              result.csvFiles.push(csvPath);
              console.log(`🆕 Created CSV file: ${csvPath}`);
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
            const botPath = path.join(this.botsPath, 'MQL5.mq5');
            const filesPath = path.join(folder, 'Files');

            if (!fs.existsSync(expertsPath)) {
              fs.mkdirSync(expertsPath, { recursive: true });
              result.created++;
              console.log(`📁 Created MQL5/Experts folder: ${expertsPath}`);
            }

            const targetBotPath = path.join(expertsPath, 'MQL5.mq5');
            if (fs.existsSync(botPath)) {
              if (!fs.existsSync(targetBotPath) || this.areFilesDifferent(botPath, targetBotPath)) {
                fs.copyFileSync(botPath, targetBotPath);
                result.synced++;
                console.log(`📋 Synced MQL5 bot to: ${targetBotPath}`);
              }
            }

            // Ensure Files folder and CSV exist
            if (!fs.existsSync(filesPath)) {
              fs.mkdirSync(filesPath, { recursive: true });
              result.created++;
              console.log(`📁 Created MQL5/Files folder: ${filesPath}`);
            }

            const csvPath = path.join(filesPath, 'IPTRADECSV2.csv');
            if (!fs.existsSync(csvPath)) {
              const header =
                'timestamp,account_id,account_type,status,action,data,master_id,platform\n';
              fs.writeFileSync(csvPath, header, { encoding: 'utf8' });
              result.filesCreated++;
              result.csvFiles.push(csvPath);
              console.log(`🆕 Created CSV file: ${csvPath}`);
            }
          } catch (error) {
            result.errors.push(`Error processing MQL5 folder ${folder}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error scanning drive ${drivePath}: ${error.message}`);
    }

    return result;
  }

  async findFoldersRecursively(rootPath, folderName) {
    const folders = [];

    try {
      console.log(
        `🔍 Searching for ${folderName} folders in ${rootPath} (${this.operatingSystem})`
      );

      switch (this.operatingSystem) {
        case 'windows':
          await this.findFoldersWindows(rootPath, folderName, folders);
          break;
        case 'macos':
        case 'linux':
          await this.findFoldersUnix(rootPath, folderName, folders);
          break;
        default:
          console.warn('⚠️ Unknown OS, using fallback method');
          await this.findFoldersRecursivelySimple(rootPath, folderName, folders);
      }
    } catch (error) {
      // Si el comando específico del OS no encuentra resultados, intentar con búsqueda recursiva
      console.log(`🔄 Using fallback search method for ${folderName} in ${rootPath}`);
      try {
        await this.findFoldersRecursivelySimple(rootPath, folderName, folders);
      } catch (simpleError) {
        console.error(`❌ Error in simple folder search for ${folderName}:`, simpleError);
      }
    }

    console.log(`📁 Found ${folders.length} ${folderName} folders in ${rootPath}`);
    return folders;
  }

  async findFoldersWindows(rootPath, folderName, folders) {
    const findCommand = `dir /s /b /ad "${rootPath}" | findstr /i "\\\\${folderName}$"`;
    const { stdout } = await execAsync(findCommand, { timeout: 30000 }); // 30 second timeout

    const foundFolders = stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.length > 0);

    folders.push(...foundFolders);
  }

  async findFoldersUnix(rootPath, folderName, folders) {
    // Usar find para macOS y Linux
    // -type d = solo directorios
    // -name = nombre exacto (case sensitive)
    // -iname = nombre exacto (case insensitive)
    // -maxdepth = limitar profundidad para evitar búsquedas muy lentas
    const findCommand = `find "${rootPath}" -maxdepth 10 -type d -iname "${folderName}" 2>/dev/null`;

    try {
      const { stdout } = await execAsync(findCommand, { timeout: 30000 }); // 30 second timeout

      const foundFolders = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.length > 0);

      folders.push(...foundFolders);
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        console.warn(`⏰ Search timeout for ${folderName} in ${rootPath}`);
      } else {
        // Si el comando find no encuentra resultados, no es un error real
        console.log(`🔍 No ${folderName} folders found in ${rootPath} using find command`);
      }
    }
  }

  async findFoldersRecursivelySimple(rootPath, folderName, folders, maxDepth = 5) {
    const searchRecursively = async (currentPath, depth = 0) => {
      if (depth > maxDepth) return;

      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const fullPath = path.join(currentPath, item);

          try {
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
              if (item.toUpperCase() === folderName.toUpperCase()) {
                folders.push(fullPath);
              } else if (depth < maxDepth) {
                // Evitar carpetas del sistema y temporales específicas de cada OS
                const skipFolders = this.getSystemFoldersToSkip();
                if (!skipFolders.some(skip => item.toUpperCase().includes(skip.toUpperCase()))) {
                  await searchRecursively(fullPath, depth + 1);
                }
              }
            }
          } catch (error) {
            // Ignorar errores de acceso (permisos, enlaces rotos, etc.)
          }
        }
      } catch (error) {
        // Ignorar errores de acceso al directorio principal
      }
    };

    await searchRecursively(rootPath);
  }

  getSystemFoldersToSkip() {
    const commonSkipFolders = ['node_modules', '.git', '.svn', 'Temp', 'tmp', 'cache', '.cache'];

    switch (this.operatingSystem) {
      case 'windows':
        return [
          ...commonSkipFolders,
          '$RECYCLE.BIN',
          'System Volume Information',
          'Windows',
          'Program Files',
          'Program Files (x86)',
          'ProgramData',
          'Recovery',
          'System32',
          'SysWOW64',
        ];
      case 'macos':
        return [
          ...commonSkipFolders,
          'System',
          'Library/Caches',
          'Library/Logs',
          '.Trash',
          '.Spotlight-V100',
          '.fseventsd',
          'private/var',
          'usr/bin',
          'usr/sbin',
          'bin',
          'sbin',
        ];
      case 'linux':
        return [
          ...commonSkipFolders,
          'proc',
          'sys',
          'dev',
          'run',
          'var/log',
          'var/cache',
          'usr/bin',
          'usr/sbin',
          'bin',
          'sbin',
          'boot',
          'lost+found',
        ];
      default:
        return commonSkipFolders;
    }
  }
}

export default new LinkPlatformsController();
