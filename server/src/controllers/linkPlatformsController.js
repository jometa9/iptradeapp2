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
      console.log('👤 Manual user request - will perform full scan (ignore cache)');

      const result = await this.findAndSyncMQLFoldersManual();

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

  // Manual user request - ALWAYS full scan (ignore cache)
  async findAndSyncMQLFoldersManual() {
    console.log('🔗 Starting manual Link Platforms process...');
    console.log('🔍 Manual request - performing full scan (ignoring cache)');

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
    this.emitLinkPlatformsEvent('started', { message: 'Manual Link Platforms process started' });

    try {
      // SIEMPRE hacer búsqueda completa para requests manuales
      await this.performFullScan(result);
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

  // Buscar y sincronizar MQL folders con cache optimizado (SOLO para auto-start)
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
        console.log('🚀 Auto-start with valid cache - NO background scan');
        result.usedCache = true;
        result.backgroundScan = false; // NO background scan en auto-start

        // Procesar rutas cacheadas inmediatamente
        await this.processCachedPaths(this.cachedPaths, result);

        // Configurar CSV watching para rutas cacheadas
        if (result.csvFiles.length > 0) {
          await this.configureCSVWatching(result.csvFiles);
        }

        // Emitir evento de finalización completa (sin background scan)
        this.emitLinkPlatformsEvent('completed', {
          message: 'Link Platforms completed using cached paths (auto-start)',
          result,
        });

        console.log('✅ Auto-start completed - no background scan needed');
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
    // Búsqueda simple en todo el sistema
    try {
      console.log(`🔍 Scanning system for MQL folders...`);
      const driveResult = await this.scanDrive('', false);

      result.mql4Folders.push(...driveResult.mql4Folders);
      result.mql5Folders.push(...driveResult.mql5Folders);
      result.created += driveResult.created;
      result.synced += driveResult.synced;
      result.errors.push(...driveResult.errors);
      result.filesCreated += driveResult.filesCreated;
      result.csvFiles.push(...driveResult.csvFiles);
    } catch (error) {
      result.errors.push(`Error scanning system: ${error.message}`);
      console.error(`❌ Error scanning system:`, error);
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

      const newPaths = { mql4Folders: [], mql5Folders: [] };

      try {
        console.log('🔍 Background scan: Starting drive scan...');
        const driveResult = await this.scanDrive('', true); // Solo buscar, no procesar
        console.log('🔍 Background scan: Drive scan completed, processing results...');
        newPaths.mql4Folders.push(...driveResult.mql4Folders);
        newPaths.mql5Folders.push(...driveResult.mql5Folders);
        console.log(
          `🔍 Background scan: Found ${newPaths.mql4Folders.length} MQL4 + ${newPaths.mql5Folders.length} MQL5 folders`
        );
      } catch (error) {
        console.error(`❌ Background scan error:`, error);
      }

      // Comparar con cache actual
      console.log('🔍 Background scan: Comparing with cached paths...');
      const currentMQL4 = this.cachedPaths?.mql4Folders || [];
      const currentMQL5 = this.cachedPaths?.mql5Folders || [];

      console.log(
        `🔍 Background scan: Current cache has ${currentMQL4.length} MQL4 + ${currentMQL5.length} MQL5 folders`
      );

      const newMQL4 = newPaths.mql4Folders.filter(path => !currentMQL4.includes(path));
      const newMQL5 = newPaths.mql5Folders.filter(path => !currentMQL5.includes(path));

      console.log(
        `🔍 Background scan: Found ${newMQL4.length} new MQL4 + ${newMQL5.length} new MQL5 folders`
      );

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
        console.log('📡 Background scan: Emitting completion event...');
        this.emitBackgroundScanEvent('completed', {
          message: 'Background scan completed - no new installations found',
          newInstallations: { mql4: 0, mql5: 0, synced: 0 },
        });
        console.log('✅ Background scan: Event emitted successfully');
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
      // Buscar carpetas MQL4 y MQL5 con comando simple
      const mql4Folders = await this.findFoldersRecursively('', 'MQL4');
      const mql5Folders = await this.findFoldersRecursively('', 'MQL5');

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
      switch (this.operatingSystem) {
        case 'windows': {
          const startRoot = rootPath && rootPath.trim().length > 0 ? rootPath : 'C:\\';
          const winCommand = `dir /s /b /ad "${startRoot}" | findstr /i "\\\\${folderName}$"`;
          const { stdout: winStdout } = await execAsync(winCommand, {
            maxBuffer: 10 * 1024 * 1024,
          });
          folders.push(
            ...winStdout
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
          );
          break;
        }
        case 'macos':
        case 'linux': {
          // Buscar SOLO desde el HOME del usuario (evitar usar ~ que no siempre se expande en /bin/sh)
          const homeDir = os.homedir();

          const unixCommand = `find "${homeDir}" -name "${folderName}" -type d 2>/dev/null`;
          console.log(`🔍 Executing command: ${unixCommand}`);

          try {
            const { stdout: unixStdout, stderr: unixStderr } = await execAsync(unixCommand, {
              maxBuffer: 10 * 1024 * 1024,
              shell: '/bin/bash', // Explicitly use bash instead of default shell
              env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }, // Ensure PATH is set
            });

            console.log(`✅ Command executed successfully`);
            console.log(`📝 stdout length: ${unixStdout.length}`);
            console.log(`📝 stderr: ${unixStderr || 'none'}`);

            if (unixStdout.trim()) {
              console.log(`📁 Found folders for ${folderName}:`);
              unixStdout.split('\n').forEach(line => {
                if (line.trim()) {
                  console.log(`  - ${line.trim()}`);
                }
              });
            } else {
              console.log(`ℹ️ No folders found for ${folderName}`);
            }

            folders.push(
              ...unixStdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
            );
          } catch (execError) {
            // Even if find command "fails" (exit code 1), it might still have found results
            // This happens when find encounters permission denied on some directories
            const hasStdout = execError.stdout && execError.stdout.trim().length > 0;

            if (hasStdout) {
              console.log(
                `⚠️ Command returned error code ${execError.code} but found results for ${folderName}`
              );
              console.log(`📁 Found folders despite error:`);
              execError.stdout.split('\n').forEach(line => {
                if (line.trim()) {
                  console.log(`  - ${line.trim()}`);
                }
              });

              folders.push(
                ...execError.stdout
                  .split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0)
              );
            } else {
              console.error(`❌ Command execution failed for ${folderName}:`, execError.message);
              console.error(`❌ Error code: ${execError.code}`);
              console.error(`❌ Error signal: ${execError.signal}`);
              console.error(`❌ stderr: ${execError.stderr}`);
              console.error(`❌ stdout: ${execError.stdout}`);

              // Try alternative approach using fs.readdir recursively
              console.log(`🔄 Trying alternative file system search for ${folderName}...`);
              try {
                const altFolders = await this.findFoldersRecursivelyFS(homeDir, folderName);
                console.log(`✅ Alternative search found ${altFolders.length} folders`);
                folders.push(...altFolders);
              } catch (altError) {
                console.error(`❌ Alternative search also failed:`, altError.message);
              }
            }
          }
          break;
        }
      }
    } catch (error) {
      // Do not fail the whole flow if the command errors; return what we have
      console.warn(`⚠️ Folder search issue for ${folderName}: ${error?.message || error}`);
    }

    return folders;
  }

  // Alternative method to find folders using Node.js fs instead of shell commands
  async findFoldersRecursivelyFS(startPath, targetFolderName, maxDepth = 10, currentDepth = 0) {
    const folders = [];

    // Prevent infinite recursion
    if (currentDepth > maxDepth) {
      return folders;
    }

    try {
      const items = await fs.promises.readdir(startPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          const fullPath = path.join(startPath, item.name);

          // If this directory matches our target, add it
          if (item.name === targetFolderName) {
            folders.push(fullPath);
            console.log(`📁 Found ${targetFolderName} at: ${fullPath}`);
          }

          // Skip certain directories to avoid permission issues and improve performance
          const skipDirs = [
            'node_modules',
            '.git',
            '.npm',
            '.cache',
            '.Trash',
            'System',
            'Library/Caches',
            'Library/Logs',
          ];

          const shouldSkip = skipDirs.some(
            skipDir => fullPath.includes(skipDir) || item.name.startsWith('.')
          );

          if (!shouldSkip) {
            try {
              // Recursively search subdirectories
              const subFolders = await this.findFoldersRecursivelyFS(
                fullPath,
                targetFolderName,
                maxDepth,
                currentDepth + 1
              );
              folders.push(...subFolders);
            } catch (subError) {
              // Skip directories we can't access (permission denied, etc.)
              // This is normal and expected
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return folders;
  }
}

export default new LinkPlatformsController();
