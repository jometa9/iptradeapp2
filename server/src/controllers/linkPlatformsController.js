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
    console.log('🚀 ===== LINK PLATFORMS ENDPOINT CALLED =====');
    console.log('📡 Request method:', req.method);
    console.log('📡 Request URL:', req.url);
    console.log('📡 Request headers:', req.headers);
    console.log('📡 API Key present:', req.headers['x-api-key'] ? 'YES' : 'NO');
    console.log('📊 Current isLinking state:', this.isLinking);

    try {
      // Check if Link Platforms is already running
      if (this.isLinking) {
        console.log('⚠️ Link Platforms is already running - rejecting new request');
        return res.status(409).json({
          success: false,
          message:
            'Link Platforms is already running. Please wait for the current process to complete.',
          isLinking: true,
        });
      }

      console.log('🔗 Starting Link Platforms process...');
      console.log('👤 Manual user request - will perform full scan (ignore cache)');

      const result = await this.findAndSyncMQLFoldersManual();

      console.log('✅ Link Platforms process completed successfully');
      console.log('📊 Result summary:', {
        mql4Folders: result.mql4Folders?.length || 0,
        mql5Folders: result.mql5Folders?.length || 0,
        created: result.created,
        synced: result.synced,
        errors: result.errors?.length || 0,
      });

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

      console.log(
        `✅ Link Platforms completed: ${result.mql4Folders.length} MQL4 folders, ${result.mql5Folders.length} MQL5 folders`
      );
      console.log(
        `📁 Created: ${result.created}, Synced: ${result.synced}, Errors: ${result.errors.length}`
      );
      console.log(`📄 CSV files found: ${result.csvFiles.length}`);

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

    // Verificar que el cache tenga paths válidos (no esté vacío)
    const hasMQL4Paths = this.cachedPaths.mql4Folders && this.cachedPaths.mql4Folders.length > 0;
    const hasMQL5Paths = this.cachedPaths.mql5Folders && this.cachedPaths.mql5Folders.length > 0;

    if (!hasMQL4Paths && !hasMQL5Paths) {
      console.log('📋 Cache exists but is empty (no MQL paths found) - need to search');
      return false;
    }

    const now = new Date();
    const cacheAge = (now - this.lastScanTime) / (1000 * 60 * 60); // horas
    const isTimeValid = cacheAge < this.cacheValidityHours;

    console.log(
      `📋 Cache validation: ${hasMQL4Paths ? 'MQL4✅' : 'MQL4❌'} ${hasMQL5Paths ? 'MQL5✅' : 'MQL5❌'} Time:${isTimeValid ? '✅' : '❌'}(${cacheAge.toFixed(1)}h)`
    );

    return isTimeValid;
  }

  // Unified method - ALWAYS full system scan (replaces both manual and optimized)
  async findAndSyncMQLFolders() {
    console.log('🔗 Starting Link Platforms process...');
    console.log('🔍 Performing full system scan for comprehensive search...');

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
      // PASO 1: Configurar CSV watching para archivos existentes PRIMERO
      console.log('🔧 Step 1: Configuring CSV watching for existing files...');
      await this.configureCSVWatchingForExistingFilesInternal();

      // PASO 2: Realizar scan completo de MetaTrader folders
      console.log('🔧 Step 2: Performing full scan for MetaTrader folders...');
      await this.performFullScan(result);

      // Emitir evento de finalización completa
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
    console.log('❤️❤️❤️❤️❤️ Manual user request - redirecting to unified method');
    return await this.findAndSyncMQLFolders();
  }

  async findAndSyncMQLFoldersOptimized() {
    console.log('🔗 Auto-start request - redirecting to unified method');
    return await this.findAndSyncMQLFolders();
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

      // Ensure Files folder exists
      if (!fs.existsSync(filesPath)) {
        fs.mkdirSync(filesPath, { recursive: true });
        result.created++;
        console.log(`📁 Created ${type}/Files folder: ${filesPath}`);
      }

      // Create CSV file if it doesn't exist and add to watching
      const csvPath = path.join(filesPath, 'IPTRADECSV2.csv');
      if (fs.existsSync(csvPath)) {
        result.csvFiles.push(csvPath);
        console.log(`📄 Found existing CSV file: ${csvPath}`);
      } else {
        // Create empty CSV file with basic structure
        const emptyCSVContent = `[TYPE][PENDING][${type === 'MQL4' ? 'MT4' : 'MT5'}][0]
[STATUS][OFFLINE][0]
[CONFIG][PENDING]`;

        fs.writeFileSync(csvPath, emptyCSVContent, 'utf8');
        result.csvFiles.push(csvPath);
        result.filesCreated++;
        console.log(`📄 Created empty CSV file: ${csvPath}`);

        // Register the new CSV file in csvManager for watching
        try {
          csvManager.addCSVFile(csvPath);
          console.log(`🔧 Registered CSV file for watching: ${csvPath}`);
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
      console.log(`🔍 Scanning system for MQL folders...`);

      // Emitir evento de syncing antes de empezar el proceso completo
      this.emitLinkPlatformsEvent('syncing', {
        message: 'Syncing Expert Advisors to platforms...',
      });

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

    // Emitir evento de finalización exitosa (comentado - ahora se emite desde findAndSyncMQLFoldersManual)
    // this.emitLinkPlatformsEvent('completed', {
    //   message: 'Link Platforms process completed successfully',
    //   result,
    // });
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

  // Función interna para configurar CSV watching sin emitir eventos (usada dentro del proceso principal)
  async configureCSVWatchingForExistingFilesInternal() {
    console.log('🔧 Configuring CSV watching for existing files in the system...');

    // En macOS, hacer una búsqueda completa del sistema para archivos CSV válidos
    if (this.operatingSystem === 'macos') {
      console.log(`🍎 macOS detected - performing system-wide CSV search for existing files...`);

      try {
        // Buscar todos los archivos IPTRADECSV2.csv en el sistema
        const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2.csv" -type f 2>/dev/null`;
        console.log(`🔍 Executing: ${findCommand}`);

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
            console.log(
              `⚠️ Find command returned error code but found files, using results anyway`
            );
          }
        }
        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim());

        console.log(`📁 Found ${allCsvFiles.length} existing CSV files in system:`);
        allCsvFiles.forEach(file => console.log(`   - ${file}`));

        // Configurar watching para todos los archivos encontrados
        allCsvFiles.forEach(csvPath => {
          if (fs.existsSync(csvPath)) {
            csvManager.csvFiles.set(csvPath, {
              lastModified: csvManager.getFileLastModified(csvPath),
              data: csvManager.parseCSVFile(csvPath),
            });
            console.log(`📍 Added existing CSV to watch list: ${csvPath}`);
          }
        });

        // Configurar file watching
        csvManager.startFileWatching();

        // Guardar el cache después de encontrar los archivos CSV
        if (csvManager.csvFiles.size > 0) {
          csvManager.saveCSVPathsToCache();
          console.log(
            `💾 Cache actualizado con ${csvManager.csvFiles.size} archivos CSV encontrados`
          );
        }

        console.log(`✅ CSV watching configured for ${csvManager.csvFiles.size} existing files`);
      } catch (error) {
        console.error(`❌ Error during system-wide CSV search for existing files:`, error);
      }
    } else {
      // Para otros sistemas operativos, usar la lógica original
      console.log('🔧 Using original CSV watching logic for non-macOS systems');
    }
  }

  // Nueva función para configurar el CSV watching para archivos existentes en el sistema
  async configureCSVWatchingForExistingFiles() {
    console.log('🔧 Configuring CSV watching for existing files in the system...');

    // En macOS, hacer una búsqueda completa del sistema para archivos CSV válidos
    if (this.operatingSystem === 'macos') {
      console.log(`🍎 macOS detected - performing system-wide CSV search for existing files...`);

      try {
        // Buscar todos los archivos IPTRADECSV2.csv en el sistema
        const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2.csv" -type f 2>/dev/null`;
        console.log(`🔍 Executing: ${findCommand}`);

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
            console.log(
              `⚠️ Find command returned error code but found files, using results anyway`
            );
          }
        }
        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim());

        console.log(`📁 Found ${allCsvFiles.length} existing CSV files in system:`);
        allCsvFiles.forEach(file => console.log(`   - ${file}`));

        // Configurar watching para todos los archivos encontrados
        allCsvFiles.forEach(csvPath => {
          if (fs.existsSync(csvPath)) {
            csvManager.csvFiles.set(csvPath, {
              lastModified: csvManager.getFileLastModified(csvPath),
              data: csvManager.parseCSVFile(csvPath),
            });
            console.log(`📍 Added existing CSV to watch list: ${csvPath}`);
          }
        });

        // Configurar file watching
        csvManager.startFileWatching();

        // Guardar el cache después de encontrar los archivos CSV
        if (csvManager.csvFiles.size > 0) {
          csvManager.saveCSVPathsToCache();
          console.log(
            `💾 Cache actualizado con ${csvManager.csvFiles.size} archivos CSV encontrados`
          );
        }

        console.log(`✅ CSV watching configured for ${csvManager.csvFiles.size} existing files`);
      } catch (error) {
        console.error(`❌ Error during system-wide CSV search for existing files:`, error);
      }
    } else {
      // Para otros sistemas operativos, usar la lógica original
      console.log('🔧 Using original CSV watching logic for non-macOS systems');
    }

    // Emit idle event after CSV watching configuration is complete
    this.emitLinkPlatformsEvent('idle', {
      message: 'CSV watching configuration completed',
      isLinking: false,
    });
  }

  // Nueva función para configurar el CSV watching específicamente en las rutas encontradas
  async configureCSVWatching(csvPaths) {
    console.log(`🔧 Configuring CSV watching for ${csvPaths.length} specific paths...`);

    // En macOS, hacer una búsqueda completa del sistema para archivos CSV válidos
    if (this.operatingSystem === 'macos') {
      console.log(`🍎 macOS detected - performing system-wide CSV search...`);

      try {
        // Buscar todos los archivos IPTRADECSV2.csv en el sistema
        // Comando para buscar archivos CSV en todo el sistema
        const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2.csv" -type f 2>/dev/null`;
        console.log(`🔍 Executing: ${findCommand}`);

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
            console.log(
              `⚠️ Find command returned error code but found files, using results anyway`
            );
          }
        }
        const allCsvFiles = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim());

        console.log(`📁 Found ${allCsvFiles.length} CSV files in system:`);
        allCsvFiles.forEach(file => console.log(`   - ${file}`));

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
                console.log(`🔍 Checking file: ${csvPath}`);
                console.log(`   Raw first line bytes: ${Buffer.from(firstLine).toString('hex')}`);
                console.log(`   Raw first line: "${firstLine}"`);

                // Buscar patrones válidos en cualquier parte de la línea
                // Esto manejará archivos con BOM u otros caracteres al inicio
                const hasBracketFormat = /\[[0-9]+\].*\[[0-9]+\].*\[.*\].*\[.*\]/.test(firstLine);
                const hasCommaFormat = /^[^\d]*[0-9],[0-9]+,\w+,\w+/.test(firstLine);

                const hasValidFormat = hasBracketFormat || hasCommaFormat;

                console.log(`   Has bracket format: ${hasBracketFormat}`);
                console.log(`   Has comma format: ${hasCommaFormat}`);
                console.log(`   Valid format: ${hasValidFormat}`);

                if (hasValidFormat) {
                  validCsvFiles.push(csvPath);

                  // Log detallado del contenido del archivo CSV válido
                  console.log(`\n📄 === VALID CSV FILE FOUND ===`);
                  console.log(`📁 File: ${csvPath}`);
                  console.log(`📊 Total lines: ${lines.length}`);
                  console.log(`📋 Raw content:`);
                  console.log(content);
                  console.log(`📋 Processed lines:`);
                  lines.forEach((line, index) => {
                    console.log(`   Line ${index + 1}: "${line}"`);
                  });
                  console.log(`📄 === END CSV CONTENT ===\n`);
                } else {
                  console.log(`❌ Skipping invalid format: ${csvPath}`);
                }
              }
            } catch (error) {
              console.log(`❌ Error reading CSV file ${csvPath}: ${error.message}`);
            }
          }
        }

        console.log(
          `✅ Found ${validCsvFiles.length} valid CSV files out of ${allCsvFiles.length} total files`
        );

        // Configurar watching para archivos válidos
        validCsvFiles.forEach(csvPath => {
          csvManager.csvFiles.set(csvPath, {
            lastModified: csvManager.getFileLastModified(csvPath),
            data: csvManager.parseCSVFile(csvPath),
          });
          console.log(`📍 Added valid CSV to watch list: ${csvPath}`);
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
            console.log(`📍 Added fallback CSV to watch list: ${csvPath}`);
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
          console.log(`📍 Added CSV to watch list: ${csvPath}`);
        }
      });
    }

    // Configurar file watching
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

      // Store the last result and timestamp for new clients
      if (eventType === 'completed') {
        this.lastLinkPlatformsResult = eventData;
        this.lastLinkPlatformsTimestamp = eventData.timestamp;
        console.log('📋 Stored completed event for new clients:', {
          backgroundScan: eventData.result?.backgroundScan,
          synced: eventData.result?.synced,
          errors: eventData.result?.errors?.length || 0,
        });
      }

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
      // Buscar MQL4 y MQL5 en UNA SOLA PASADA para máxima eficiencia
      console.log('🚀 Starting unified search for MQL4 and MQL5 folders...');
      const { mql4Folders, mql5Folders } = await this.findBothMQLFolders();
      console.log(
        `✅ Unified search completed: ${mql4Folders.length} MQL4 + ${mql5Folders.length} MQL5 folders`
      );

      // Solo agregar carpetas al resultado
      result.mql4Folders = mql4Folders;
      result.mql5Folders = mql5Folders;

      // Emitir evento de inicio de sincronización
      if (!searchOnly && (mql4Folders.length > 0 || mql5Folders.length > 0)) {
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

            // Only detect existing CSV files, don't create them
            const csvPath = path.join(filesPath, 'IPTRADECSV2.csv');
            if (fs.existsSync(csvPath)) {
              result.csvFiles.push(csvPath);
              console.log(`📄 Found existing CSV file: ${csvPath}`);
            } else {
              console.log(`ℹ️  No CSV file found (this is normal): ${csvPath}`);
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

            // Only detect existing CSV files, don't create them
            const csvPath = path.join(filesPath, 'IPTRADECSV2.csv');
            if (fs.existsSync(csvPath)) {
              result.csvFiles.push(csvPath);
              console.log(`📄 Found existing CSV file: ${csvPath}`);
            } else {
              console.log(`ℹ️  No CSV file found (this is normal): ${csvPath}`);
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

  // Búsqueda simple y rápida de MQL4 y MQL5 con detección de OS
  async findBothMQLFolders() {
    console.log(`🔍 Starting MQL folder search for ${this.operatingSystem}...`);

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

  // Búsqueda específica para Windows - busca en TODOS los discos
  async findBothMQLFoldersWindows() {
    try {
      // Obtener todos los drives disponibles
      const drives = await this.getWindowsDrives();
      console.log(`🔍 Searching for MQL folders in Windows drives: ${drives.join(', ')}`);

      const allMQL4Folders = [];
      const allMQL5Folders = [];

      // Buscar en cada drive de forma paralela para mayor velocidad
      const searchPromises = drives.map(async drive => {
        try {
          console.log(`🔍 Searching in drive: ${drive}`);

          // Comando para buscar ambas carpetas MQL4 y MQL5 en un solo comando
          const command = `dir /s /b /ad "${drive}" 2>nul | findstr /i "\\\\MQL[45]$"`;

          const { stdout } = await execAsync(command, {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
            shell: 'cmd.exe',
          });

          if (stdout && stdout.trim()) {
            const folders = stdout
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);

            const mql4 = folders.filter(folder => folder.toUpperCase().endsWith('\\MQL4'));
            const mql5 = folders.filter(folder => folder.toUpperCase().endsWith('\\MQL5'));

            console.log(
              `📂 Drive ${drive}: Found ${mql4.length} MQL4 + ${mql5.length} MQL5 folders`
            );

            return { mql4, mql5 };
          }

          return { mql4: [], mql5: [] };
        } catch (error) {
          console.warn(`⚠️ Error searching drive ${drive}: ${error.message}`);
          return { mql4: [], mql5: [] };
        }
      });

      // Esperar que todas las búsquedas terminen
      const results = await Promise.all(searchPromises);

      // Combinar todos los resultados
      results.forEach(result => {
        allMQL4Folders.push(...result.mql4);
        allMQL5Folders.push(...result.mql5);
      });

      // Remover duplicados
      const uniqueMQL4 = [...new Set(allMQL4Folders)];
      const uniqueMQL5 = [...new Set(allMQL5Folders)];

      console.log(
        `✅ Windows search completed: ${uniqueMQL4.length} MQL4 + ${uniqueMQL5.length} MQL5 folders`
      );
      uniqueMQL4.forEach(folder => console.log(`  📂 MQL4: ${folder}`));
      uniqueMQL5.forEach(folder => console.log(`  📂 MQL5: ${folder}`));

      return {
        mql4Folders: uniqueMQL4,
        mql5Folders: uniqueMQL5,
      };
    } catch (error) {
      console.error(`❌ Error in Windows MQL search: ${error.message}`);
      return { mql4Folders: [], mql5Folders: [] };
    }
  }

  // Búsqueda específica para macOS
  async findBothMQLFoldersMacOS() {
    const homeDir = os.homedir();

    // Comando optimizado para macOS
    const command = `find "${homeDir}" \\( -name "MQL4" -o -name "MQL5" \\) -type d 2>/dev/null`;
    console.log(`🔍 Executing macOS search: ${command}`);
    console.log(`🏠 Home directory: ${homeDir}`);

    return new Promise(resolve => {
      exec(
        command,
        {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
          shell: '/bin/zsh',
          env: {
            ...process.env,
            PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
            HOME: homeDir,
          },
        },
        (error, stdout, stderr) => {
          if (stdout && stdout.trim()) {
            console.log(`📝 macOS search completed successfully`);

            const allFolders = stdout
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);

            console.log(`📋 Found ${allFolders.length} MQL folders:`);
            allFolders.forEach(folder => console.log(`  📂 ${folder}`));

            const result = {
              mql4Folders: allFolders.filter(folder => folder.endsWith('/MQL4')),
              mql5Folders: allFolders.filter(folder => folder.endsWith('/MQL5')),
            };

            console.log(
              `📁 Categorized: ${result.mql4Folders.length} MQL4 + ${result.mql5Folders.length} MQL5 folders`
            );
            resolve(result);
            return;
          }

          console.log(`🔄 No MQL folders found in macOS, returning empty result`);
          resolve({ mql4Folders: [], mql5Folders: [] });
        }
      );
    });
  }

  // Búsqueda específica para Linux
  async findBothMQLFoldersLinux() {
    const homeDir = os.homedir();

    // Comando optimizado para Linux
    const command = `find "${homeDir}" \\( -name "MQL4" -o -name "MQL5" \\) -type d 2>/dev/null`;
    console.log(`🔍 Executing Linux search: ${command}`);
    console.log(`🏠 Home directory: ${homeDir}`);

    return new Promise(resolve => {
      exec(
        command,
        {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
          shell: '/bin/bash',
          env: {
            ...process.env,
            PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
            HOME: homeDir,
          },
        },
        (error, stdout, stderr) => {
          if (stdout && stdout.trim()) {
            console.log(`📝 Linux search completed successfully`);

            const allFolders = stdout
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);

            console.log(`📋 Found ${allFolders.length} MQL folders:`);
            allFolders.forEach(folder => console.log(`  📂 ${folder}`));

            const result = {
              mql4Folders: allFolders.filter(folder => folder.endsWith('/MQL4')),
              mql5Folders: allFolders.filter(folder => folder.endsWith('/MQL5')),
            };

            console.log(
              `📁 Categorized: ${result.mql4Folders.length} MQL4 + ${result.mql5Folders.length} MQL5 folders`
            );
            resolve(result);
            return;
          }

          console.log(`🔄 No MQL folders found in Linux, returning empty result`);
          resolve({ mql4Folders: [], mql5Folders: [] });
        }
      );
    });
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

      console.log(`📁 Found ${folders.length} ${folderName} folders`);
      return folders;
    } catch (error) {
      console.error(`❌ Error finding ${folderName}: ${error.message}`);
      return [];
    }
  }
}

export default new LinkPlatformsController();
