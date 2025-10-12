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
    this.isFindingBots = false; // Track if findBots is in progress (separate from linking)
    this.cachedPaths = null; // Cache for found MQL paths
    this.lastScanTime = null; // Track when last scan happened
    this.cacheValidityHours = 24; // Cache válido por 24 horas
    this.cacheFilePath = path.join(__dirname, '../../../config/mql_paths_cache.json');
    this.operatingSystem = this.detectOperatingSystem();
    this.lastLinkPlatformsResult = null; // Store last result for new clients
    this.lastLinkPlatformsTimestamp = null; // Store timestamp of last operation
    // Flag para controlar si cTrader está habilitado (HABILITADO)
    this.cTraderEnabled = true;
    
    // PROPIEDADES ELIMINADAS: validPlatformKeywords y csvSearchPatterns
    // Estas propiedades pertenecen a Find Bots, no a Link Platforms
    // Link Platforms solo debe instalar bots, no buscar CSV
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

  // MÉTODO ELIMINADO: validateCSVPlatformContent() 
  // Este método pertenece a Find Bots, no a Link Platforms
  // Link Platforms solo debe instalar bots, no validar CSV

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

      // Start the process in background and respond immediately
      this.findAndSyncMQLFoldersManual().catch(error => {
        console.error('❌ Background Link Platforms error:', error);
        // Error handling is done within findAndSyncMQLFoldersManual() method via SSE events
      });

      // Respond immediately that the process has started
      res.json({
        success: true,
        message: 'Link Platforms process started successfully',
        isLinking: true,
        backgroundProcess: true
      });
    } catch (error) {
      console.error('❌ Link Platforms endpoint error:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Failed to start Link Platforms process',
        error: error.message,
      });
    }
  }

  async findBotsEndpoint(req, res) {
    const startTime = Date.now();
    console.log('🔍 Find Bots ENDPOINT: Request received at', new Date().toISOString());
    console.log('🔍 Find Bots ENDPOINT: Request headers:', req.headers);
    console.log('🔍 Find Bots ENDPOINT: Request body:', req.body);
    
    try {
      // Check if Find Bots is already running (use separate state variable)
      if (this.isFindingBots) {
        console.log('⚠️ Find Bots ENDPOINT: Process already running, returning 409');
        return res.status(409).json({
          success: false,
          message:
            'Find Bots is already running. Please wait for the current process to complete.',
          isLinking: true,
        });
      }

      console.log('🔍 Find Bots ENDPOINT: Starting synchronous process...');
      console.log('🔍 Find Bots ENDPOINT: Current working directory:', process.cwd());
      console.log('🔍 Find Bots ENDPOINT: Bots path:', this.botsPath);
      
      // Execute the process synchronously and wait for completion
      const result = await this.findBots();
      
      const duration = Date.now() - startTime;
      console.log(`🔍 Find Bots ENDPOINT: Process completed in ${duration}ms, returning result`);
      console.log('🔍 Find Bots ENDPOINT: Result summary:', {
        csvFilesCount: result.csvFiles.length,
        csvFilesFound: result.csvFilesFound,
        errorsCount: result.errors.length,
        hasErrors: result.errors.length > 0
      });
      
      if (result.errors.length > 0) {
        console.log('⚠️ Find Bots ENDPOINT: Errors found:', result.errors);
      }
      
      // Respond only when the process is completely finished
      res.json({
        success: true,
        message: `Find Bots completed. Found ${result.csvFiles.length} CSV files`,
        result: {
          csvFiles: result.csvFiles,
          csvFilesFound: result.csvFilesFound,
          errors: result.errors
        },
        isLinking: false // Process is now complete
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Find Bots ENDPOINT: Error after ${duration}ms:`, error);
      console.error('❌ Find Bots ENDPOINT: Error stack:', error.stack);
      console.error('❌ Find Bots ENDPOINT: Error type:', error.constructor.name);
      res.status(500).json({
        success: false,
        message: 'Failed to complete Find Bots process',
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

  // Link Platforms - SOLO instalar bots en plataformas encontradas (SIN buscar CSV)
  async findAndSyncMQLFolders() {
    // Track linking state
    this.isLinking = true;

    const result = {
      mql4Folders: [],
      mql5Folders: [],
      ninjaTraderFolders: [],
      cTraderFolders: [],
      synced: 0,
      errors: [],
    };

    console.log('🔗 Link Platforms: Starting bot installation process...');

    try {
      // PASO 1: Buscar plataformas instaladas
      console.log('🔍 Link Platforms: Searching for installed platforms...');
      const { mql4Folders, mql5Folders } = await this.findBothMQLFolders();
      const ninjaTraderFolders = await this.findNinjaTraderFolders();
      
      result.mql4Folders = mql4Folders;
      result.mql5Folders = mql5Folders;
      result.ninjaTraderFolders = ninjaTraderFolders;
      
      console.log(`📁 Link Platforms: Found ${mql4Folders.length} MT4, ${mql5Folders.length} MT5, ${ninjaTraderFolders.length} NT8 platforms`);
      
      // PASO 2: Instalar bots en cada plataforma
      await this.installBotsInPlatforms(result);
      
      const totalPlatforms = result.mql4Folders.length + result.mql5Folders.length + result.ninjaTraderFolders.length + (result.cTraderFolders?.length || 0);
      console.log(`✅ Link Platforms: Process completed. Synced ${result.synced} bot files to ${totalPlatforms} platforms`);
    } catch (error) {
      console.error('❌ Error in Link Platforms process:', error);
      result.errors.push(`General error: ${error.message}`);
    } finally {
      // Always reset linking state
      this.isLinking = false;
    }

    return result;
  }

  // Instalar bots en todas las plataformas encontradas
  async installBotsInPlatforms(result) {
    console.log('🚀 Link Platforms: Starting bot installation...');
    
    // Instalar en plataformas MT4
    for (let i = 0; i < result.mql4Folders.length; i++) {
      const folder = result.mql4Folders[i];
      console.log(`🔧 Installing bots in MT4 platform ${i + 1}/${result.mql4Folders.length}: ${path.basename(folder)}`);
      
      try {
        const expertsPath = path.join(folder, 'Experts');
        
        // Verificar que la carpeta Experts existe (no crearla)
        if (!fs.existsSync(expertsPath)) {
          const errorMsg = `Experts folder not found in ${folder}. Platform may not be properly installed.`;
          console.warn(`  ⚠️ ${errorMsg}`);
          result.errors.push(errorMsg);
          continue;
        }
        
        // Copiar archivos .mq4 para MT4
        const mql4BotFiles = this.getBotFilesByExtension('.mq4');
        for (const botFile of mql4BotFiles) {
          if (fs.existsSync(botFile.path)) {
            const targetPath = path.join(expertsPath, botFile.name);
            fs.copyFileSync(botFile.path, targetPath);
            result.synced++;
            console.log(`  ✅ Copied ${botFile.name}`);
          }
        }
      } catch (error) {
        const errorMsg = `Error installing bots in MT4 folder ${folder}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    // Instalar en plataformas MT5
    for (let i = 0; i < result.mql5Folders.length; i++) {
      const folder = result.mql5Folders[i];
      console.log(`🔧 Installing bots in MT5 platform ${i + 1}/${result.mql5Folders.length}: ${path.basename(folder)}`);
      
      try {
        const expertsPath = path.join(folder, 'Experts');
        
        // Verificar que la carpeta Experts existe (no crearla)
        if (!fs.existsSync(expertsPath)) {
          const errorMsg = `Experts folder not found in ${folder}. Platform may not be properly installed.`;
          console.warn(`  ⚠️ ${errorMsg}`);
          result.errors.push(errorMsg);
          continue;
        }
        
        // Copiar archivos .mq5 para MT5
        const mql5BotFiles = this.getBotFilesByExtension('.mq5');
        for (const botFile of mql5BotFiles) {
          if (fs.existsSync(botFile.path)) {
            const targetPath = path.join(expertsPath, botFile.name);
            fs.copyFileSync(botFile.path, targetPath);
            result.synced++;
            console.log(`  ✅ Copied ${botFile.name}`);
          }
        }
      } catch (error) {
        const errorMsg = `Error installing bots in MT5 folder ${folder}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    // Instalar en plataformas NinjaTrader
    for (let i = 0; i < result.ninjaTraderFolders.length; i++) {
      const folder = result.ninjaTraderFolders[i];
      console.log(`🔧 Installing bots in NT8 platform ${i + 1}/${result.ninjaTraderFolders.length}: ${path.basename(folder)}`);
      
      try {
        await this.installNinjaTraderBots(folder, result);
      } catch (error) {
        const errorMsg = `Error installing bots in NT8 folder ${folder}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    // Instalar en plataformas cTrader (si las encontramos)
    const cTraderFolders = await this.findCTraderFolders();
    if (cTraderFolders.length > 0) {
      result.cTraderFolders = cTraderFolders;
      
      for (let i = 0; i < cTraderFolders.length; i++) {
        const folder = cTraderFolders[i];
        console.log(`🔧 Installing bots in cTrader platform ${i + 1}/${cTraderFolders.length}: ${path.basename(folder)}`);
        
        try {
          await this.installCTraderBots(folder, result);
        } catch (error) {
          const errorMsg = `Error installing bots in cTrader folder ${folder}: ${error.message}`;
          console.error(`  ❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
    }
    
    console.log(`🎉 Link Platforms: Bot installation completed!`);
  }
  
  // Buscar instalaciones de cTrader
  async findCTraderFolders() {
    const cTraderFolders = [];
    const username = os.userInfo().username;
    
    // Ubicaciones comunes de cTrader
    const possiblePaths = [
      `C:\\Users\\${username}\\Documents\\cAlgo`,
      'C:\\Program Files\\cTrader\\cAlgo',
      'C:\\Program Files (x86)\\cTrader\\cAlgo',
    ];
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        cTraderFolders.push(testPath);
        console.log(`📁 Found cTrader installation: ${testPath}`);
      }
    }
    
    return cTraderFolders;
  }
  
  // Instalar bots de cTrader
  async installCTraderBots(folder, result) {
    // Para cTrader, los bots van en la carpeta Sources/Robots
    const robotsPath = path.join(folder, 'Sources', 'Robots');
    
    // Verificar que la carpeta existe
    if (!fs.existsSync(robotsPath)) {
      const errorMsg = `Robots folder not found in ${folder}. cTrader may not be properly installed.`;
      console.warn(`  ⚠️ ${errorMsg}`);
      result.errors.push(errorMsg);
      return;
    }
    
    console.log(`  📁 Using cTrader Robots path: ${robotsPath}`);
    
    // Copiar archivos .cs de cTrader
    const cBotFiles = this.getBotFilesByExtension('.cs');
    for (const botFile of cBotFiles) {
      if (fs.existsSync(botFile.path)) {
        const targetPath = path.join(robotsPath, botFile.name);
        fs.copyFileSync(botFile.path, targetPath);
        result.synced++;
        console.log(`  ✅ Copied ${botFile.name}`);
      }
    }
  }
  
  // Instalar bots de NinjaTrader
  async installNinjaTraderBots(folder, result) {
    // Para NT8, intentar diferentes ubicaciones posibles
    const possiblePaths = [
      path.join(folder, 'bin', 'Custom', 'Strategies'),  // Instalación estándar
      path.join('C:', 'Program Files', 'NinjaTrader 8', 'bin', 'Custom', 'Strategies'), // Instalación global
    ];
    
    let strategiesPath = null;
    
    // Buscar la primera ruta que exista
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        strategiesPath = testPath;
        break;
      }
    }
    
    // Verificar que encontramos una carpeta válida
    if (!strategiesPath) {
      const errorMsg = `Strategies folder not found for NinjaTrader. Tried: ${possiblePaths.join(', ')}`;
      console.warn(`  ⚠️ ${errorMsg}`);
      result.errors.push(errorMsg);
      return;
    }
    
    console.log(`  📁 Using NinjaTrader Strategies path: ${strategiesPath}`);
    
    // Copiar archivos .cs de NinjaTrader
    const ntBotFiles = this.getBotFilesByExtension('.cs');
    for (const botFile of ntBotFiles) {
      if (fs.existsSync(botFile.path)) {
        const targetPath = path.join(strategiesPath, botFile.name);
        fs.copyFileSync(botFile.path, targetPath);
        result.synced++;
        console.log(`  ✅ Copied ${botFile.name}`);
      }
    }
  }

  // Find Bots - Solo buscar archivos CSV existentes (síncrono)
  async findBots() {
    const startTime = Date.now();
    console.log('🔍 Find Bots CORE: Starting at', new Date().toISOString());
    console.log('🔍 Find Bots CORE: Initial isFindingBots state:', this.isFindingBots);
    
    // Track findBots state (separate from linking)
    this.isFindingBots = true;
    console.log('🔍 Find Bots CORE: Set isFindingBots to true');

    const result = {
      csvFiles: [],
      csvFilesFound: 0,
      errors: [],
    };

    try {
      console.log('🔍 Find Bots CORE: Starting CSV search...');
      console.log('🔍 Find Bots CORE: csvManager instance:', !!csvManager);
      
      // PASO 1: Buscar archivos CSV existentes usando csvManager
      console.log('🔍 Find Bots CORE: Using csvManager to scan for CSV files...');
      const scanStartTime = Date.now();
      const foundFiles = await csvManager.scanCSVFiles();
      const scanDuration = Date.now() - scanStartTime;
      
      console.log(`🔍 Find Bots CORE: csvManager scan completed in ${scanDuration}ms`);
      console.log(`🔍 Find Bots CORE: csvManager found ${foundFiles.length} files:`, foundFiles);
      
      if (foundFiles.length === 0) {
        console.log('⚠️ Find Bots CORE: No files found by csvManager - this might be the issue!');
      }
      
      // PASO 2: Validar cada archivo encontrado
      for (const csvPath of foundFiles) {
        if (fs.existsSync(csvPath)) {
          try {
            // Validar formato del archivo CSV
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
              
              // Validar formato básico del CSV
              const hasBracketFormat = /\[TYPE\]|\[STATUS\]|\[CONFIG\]/.test(firstLine);
              const hasCommaFormat = /^[^\d]*[0-9],[0-9]+,\w+,\w+/.test(firstLine);
              const hasValidFormat = hasBracketFormat || hasCommaFormat;
              
              // Validar que contenga nombres de plataformas válidas
              const contentUpper = content.toUpperCase();
              const fileName = path.basename(csvPath).toUpperCase();
              const hasIPTRADEInName = fileName.includes('IPTRADE');
              const validPlatformKeywords = ['MT4', 'MT5', 'CTRADER', 'NT8', 'NINJATRADER'];
              const hasValidPlatformInContent = validPlatformKeywords.some(platformName => {
                return contentUpper.includes(platformName) || contentUpper.includes(`[${platformName}]`);
              });
              
              if (hasValidFormat && hasIPTRADEInName && hasValidPlatformInContent) {
                result.csvFiles.push(csvPath);
                result.csvFilesFound++;
                console.log(`✅ Find Bots: Valid CSV file found: ${path.basename(csvPath)}`);
              } else {
                console.log(`⚠️ Find Bots: Invalid CSV file: ${path.basename(csvPath)}`);
              }
            }
          } catch (error) {
            console.error(`❌ Find Bots: Error reading CSV file ${csvPath}:`, error.message);
            result.errors.push(`Error reading CSV file ${csvPath}: ${error.message}`);
          }
        } else {
          console.log(`⚠️ Find Bots: File does not exist: ${csvPath}`);
        }
      }

      console.log(`✅ Find Bots: Process completed. Found ${result.csvFiles.length} valid CSV files`);
      
    } catch (error) {
      console.error('❌ Error in Find Bots process:', error);
      result.errors.push(`General error: ${error.message}`);
    } finally {
      // Always reset findBots state
      this.isFindingBots = false;
      console.log('🔍 Find Bots CORE: Reset isFindingBots to false');
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

  // MÉTODO OBSOLETO - Reemplazado por installBotsInPlatforms()
  // Escanear plataformas e instalar bots (sin buscar CSV)
  async performPlatformScanAndInstall(result) {
    // Emitir evento de scanning
    this.emitLinkPlatformsEvent('progress', {
      message: 'Getting available drives...',
      progress: { current: 15, total: 100, percentage: 15 }
    });

    // Obtener drives disponibles
    const drives = await this.getAvailableDrives();
    const totalDrives = drives.length;
    
    this.emitLinkPlatformsEvent('progress', {
      message: `Found ${totalDrives} drives to scan for platforms...`,
      progress: { current: 20, total: 100, percentage: 20 }
    });

    // Escanear cada drive con progreso individual
    for (let i = 0; i < drives.length; i++) {
      const drive = drives[i];
      const driveProgress = 20 + Math.round((i / totalDrives) * 70); // 20% a 90%
      
      this.emitLinkPlatformsEvent('progress', {
        message: `Scanning drive ${drive} for platforms (${i + 1}/${totalDrives})...`,
        progress: { current: driveProgress, total: 100, percentage: driveProgress }
      });

      try {
        // Callback para progreso granular dentro del drive
        const progressCallback = (message) => {
          const baseProgress = 20 + Math.round((i / totalDrives) * 70);
          this.emitLinkPlatformsEvent('progress', {
            message: `${drive}: ${message}`,
            progress: { current: baseProgress, total: 100, percentage: baseProgress }
          });
        };

        // Buscar y procesar plataformas (sin CSV)
        const driveResult = await this.scanDriveForPlatformsOnly(drive, progressCallback);
        
        result.mql4Folders.push(...driveResult.mql4Folders);
        result.mql5Folders.push(...driveResult.mql5Folders);
        result.ninjaTraderFolders = [...(result.ninjaTraderFolders || []), ...(driveResult.ninjaTraderFolders || [])];

        result.created += driveResult.created;
        result.synced += driveResult.synced;
        result.errors.push(...driveResult.errors);
        result.filesCreated += driveResult.filesCreated;

        // Emitir progreso con detalles encontrados hasta ahora
        const currentProgress = 20 + Math.round(((i + 1) / totalDrives) * 70);
        const platformsFound = driveResult.mql4Folders.length + driveResult.mql5Folders.length + (driveResult.ninjaTraderFolders?.length || 0);
        
        this.emitLinkPlatformsEvent('progress', {
          message: platformsFound > 0 
            ? `Drive ${drive} completed. Found ${platformsFound} platforms, synced ${driveResult.synced} files`
            : `Drive ${drive} completed. No platforms found`,
          progress: { current: currentProgress, total: 100, percentage: currentProgress },
          details: {
            mql4Platforms: result.mql4Folders.length,
            mql5Platforms: result.mql5Folders.length,
            ninjaTraderPlatforms: result.ninjaTraderFolders?.length || 0,
            filesSynced: result.synced
          }
        });
      } catch (error) {
        result.errors.push(`Error scanning drive ${drive}: ${error.message}`);
        console.error(`❌ Error scanning drive ${drive}:`, error);
      }
    }
  }

  // Realizar búsqueda completa con progreso real (método original mantenido para compatibilidad)
  async performFullScanWithProgress(result) {
    // Emitir evento de scanning
    this.emitLinkPlatformsEvent('progress', {
      message: 'Getting available drives...',
      progress: { current: 20, total: 100, percentage: 20 }
    });

    // Obtener drives disponibles
    const drives = await this.getAvailableDrives();
    const totalDrives = drives.length;
    
    this.emitLinkPlatformsEvent('progress', {
      message: `Found ${totalDrives} drives to scan...`,
      progress: { current: 25, total: 100, percentage: 25 }
    });

    // Escanear cada drive con progreso individual
    for (let i = 0; i < drives.length; i++) {
      const drive = drives[i];
      const driveProgress = 25 + Math.round((i / totalDrives) * 60); // 25% a 85%
      
      this.emitLinkPlatformsEvent('progress', {
        message: `Scanning drive ${drive} (${i + 1}/${totalDrives})...`,
        progress: { current: driveProgress, total: 100, percentage: driveProgress }
      });

      try {
        // Callback para progreso granular dentro del drive
        const progressCallback = (message) => {
          const baseProgress = 25 + Math.round((i / totalDrives) * 60);
          this.emitLinkPlatformsEvent('progress', {
            message: `${drive}: ${message}`,
            progress: { current: baseProgress, total: 100, percentage: baseProgress }
          });
        };

        const driveResult = await this.scanDrive(drive, false, progressCallback);
        
        result.mql4Folders.push(...driveResult.mql4Folders);
        result.mql5Folders.push(...driveResult.mql5Folders);
        result.ninjaTraderFolders = [...(result.ninjaTraderFolders || []), ...(driveResult.ninjaTraderFolders || [])];

        result.created += driveResult.created;
        result.synced += driveResult.synced;
        result.errors.push(...driveResult.errors);
        result.filesCreated += driveResult.filesCreated;
        result.csvFiles.push(...driveResult.csvFiles);

        // Emitir progreso con detalles encontrados hasta ahora
        const currentProgress = 25 + Math.round(((i + 1) / totalDrives) * 60);
        const platformsFound = driveResult.mql4Folders.length + driveResult.mql5Folders.length + (driveResult.ninjaTraderFolders?.length || 0);
        
        this.emitLinkPlatformsEvent('progress', {
          message: platformsFound > 0 
            ? `Drive ${drive} completed. Found ${platformsFound} platform installations`
            : `Drive ${drive} completed. No platforms found`,
          progress: { current: currentProgress, total: 100, percentage: currentProgress },
          details: {
            mql4Platforms: result.mql4Folders.length,
            mql5Platforms: result.mql5Folders.length,
            ninjaTraderPlatforms: result.ninjaTraderFolders?.length || 0,
            filesSynced: result.synced,
            csvFilesFound: result.csvFiles.length
          }
        });
      } catch (error) {
        result.errors.push(`Error scanning drive ${drive}: ${error.message}`);
        console.error(`❌ Error scanning drive ${drive}:`, error);
      }
    }

    // Guardar cache
    this.emitLinkPlatformsEvent('progress', {
      message: 'Saving scan results to cache...',
      progress: { current: 90, total: 100, percentage: 90 }
    });

    const pathsToCache = {
      mql4Folders: result.mql4Folders,
      mql5Folders: result.mql5Folders,
      ninjaTraderFolders: result.ninjaTraderFolders || [],
    };
    this.cachedPaths = pathsToCache;
    this.lastScanTime = new Date();
    this.saveCacheToFile(pathsToCache);

    // Log summary of registered CSV files
    try {
      csvManager.getCSVFilesSummary();
    } catch (error) {
      console.error(`❌ Error getting CSV summary: ${error.message}`);
    }
  }

  // Realizar búsqueda completa (sin cache) - método original mantenido para compatibilidad
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

      // Emit progress update with detailed information
      const totalPlatforms = result.mql4Folders.length + result.mql5Folders.length + result.ninjaTraderFolders.length;
      this.emitLinkPlatformsEvent('progress', {
        message: `Found ${totalPlatforms} platform installations. Synced ${result.synced} files.`,
        details: {
          mql4Platforms: result.mql4Folders.length,
          mql5Platforms: result.mql5Folders.length,
          ninjaTraderPlatforms: result.ninjaTraderFolders.length,
          filesSynced: result.synced,
          csvFilesFound: result.csvFiles.length
        }
      });
    } catch (error) {
      result.errors.push(`Error scanning system: ${error.message}`);
      console.error(`❌ Error scanning system:`, error);
    }

    // Guardar nuevo cache (eliminando duplicados)
    const pathsToCache = {
      mql4Folders: [...new Set(result.mql4Folders)], // Eliminar duplicados
      mql5Folders: [...new Set(result.mql5Folders)], // Eliminar duplicados
      ninjaTraderFolders: [...new Set(result.ninjaTraderFolders || [])], // Eliminar duplicados
    };
    this.cachedPaths = pathsToCache;
    this.lastScanTime = new Date();
    this.saveCacheToFile(pathsToCache);

    // Configurar CSV watching
    if (result.csvFiles.length > 0) {
      this.emitLinkPlatformsEvent('progress', {
        message: `Configuring CSV file monitoring for ${result.csvFiles.length} files...`,
      });
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

  // MÉTODOS ELIMINADOS: getAvailableWindowsDrives() y generateSearchLocations()
  // Estos métodos pertenecen a Find Bots, no a Link Platforms
  // Link Platforms solo debe instalar bots, no buscar en múltiples discos

  // MÉTODO ELIMINADO: findExistingCSVFilesWithProgress()
  // Este método pertenece a Find Bots, no a Link Platforms
  // Link Platforms solo debe instalar bots, no buscar CSV

  // MÉTODO ELIMINADO: cacheCSVPaths()
  // Este método pertenece a Find Bots, no a Link Platforms
  // Link Platforms solo debe instalar bots, no cachear CSV

  // Método eliminado - ya no necesitamos file watching

  // Método eliminado - ya no necesitamos file watching

  // Método eliminado - ya no necesitamos file watching duplicado



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
      isFindingBots: this.isFindingBots,
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

  // Escanear drive solo para plataformas e instalar bots (sin CSV)
  async scanDriveForPlatformsOnly(drivePath, progressCallback = null) {
    const result = {
      mql4Folders: [],
      mql5Folders: [],
      ctraderFolders: [],
      ninjaTraderFolders: [],
      created: 0,
      synced: 0,
      errors: [],
      filesCreated: 0,
    };

    try {
      // Buscar MQL4, MQL5, cTrader y NinjaTrader folders
      if (progressCallback) {
        progressCallback('Searching for platform folders...');
      }
      
      const { mql4Folders, mql5Folders, ctraderFolders } = await this.findBothMQLFolders();
      const ninjaTraderFolders = await this.findNinjaTraderFolders();

      // Solo agregar carpetas al resultado
      result.mql4Folders = mql4Folders;
      result.mql5Folders = mql5Folders;
      result.ctraderFolders = ctraderFolders;
      result.ninjaTraderFolders = ninjaTraderFolders;

      // Procesar carpetas MQL4 - SOLO INSTALAR BOTS
      for (let j = 0; j < mql4Folders.length; j++) {
        const folder = mql4Folders[j];
        
        if (progressCallback) {
          progressCallback(`Installing bots in MT4 platform ${j + 1}/${mql4Folders.length}: ${path.basename(folder)}`);
        }
        
        try {
          const expertsPath = path.join(folder, 'Experts');

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
        } catch (error) {
          result.errors.push(`Error processing MQL4 folder ${folder}: ${error.message}`);
        }
      }

      // Procesar carpetas MQL5 - SOLO INSTALAR BOTS
      for (let j = 0; j < mql5Folders.length; j++) {
        const folder = mql5Folders[j];
        
        if (progressCallback) {
          progressCallback(`Installing bots in MT5 platform ${j + 1}/${mql5Folders.length}: ${path.basename(folder)}`);
        }
        
        try {
          const expertsPath = path.join(folder, 'Experts');

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
        } catch (error) {
          result.errors.push(`Error processing MQL5 folder ${folder}: ${error.message}`);
        }
      }

      // Procesar carpetas NinjaTrader - SOLO INSTALAR BOTS
      for (let j = 0; j < ninjaTraderFolders.length; j++) {
        const folder = ninjaTraderFolders[j];
        
        if (progressCallback) {
          progressCallback(`Installing bots in NinjaTrader platform ${j + 1}/${ninjaTraderFolders.length}: ${path.basename(folder)}`);
        }
        
        try {
          await this.processNinjaTraderFolderBotsOnly(folder, result);
        } catch (error) {
          result.errors.push(`Error processing NinjaTrader folder ${folder}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Error scanning drive ${drivePath}: ${error.message}`);
    }

    return result;
  }

  async scanDrive(drivePath, searchOnly = false, progressCallback = null) {
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
      if (progressCallback) {
        progressCallback('Searching for platform folders...');
      }
      
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
        for (let j = 0; j < mql4Folders.length; j++) {
          const folder = mql4Folders[j];
          
          if (progressCallback) {
            progressCallback(`Processing MT4 platform ${j + 1}/${mql4Folders.length}: ${path.basename(folder)}`);
          }
          
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
        for (let j = 0; j < mql5Folders.length; j++) {
          const folder = mql5Folders[j];
          
          if (progressCallback) {
            progressCallback(`Processing MT5 platform ${j + 1}/${mql5Folders.length}: ${path.basename(folder)}`);
          }
          
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

  // Búsqueda simplificada para Windows - busca directamente por nombres de carpetas
  async findBothMQLFoldersWindows() {
    try {
      console.log('🔍 Searching for platform folders by exact name across all drives...');
      console.log('🚫 Excluding system directories: Windows, Program Files, System Volume Information, etc.');

      // Comando PowerShell optimizado - busca carpetas excluyendo directorios del sistema
      const command = `Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $drive = $_.Root
    Write-Host "Scanning drive: $drive"
    
    # Definir exclusiones para mejorar rendimiento
    $excludePaths = @(
        "Windows", "Program Files", "Program Files (x86)", "System Volume Information", 
        "$Recycle.Bin", "ProgramData", "pagefile.sys", "hiberfil.sys", "swapfile.sys",
        "Users\\*\\AppData\\Local\\Temp", "Users\\*\\AppData\\Local\\Microsoft",
        "Users\\*\\AppData\\Roaming\\Microsoft", "node_modules", ".git"
    )
    
    # Buscar MQL4 (excluyendo carpetas del sistema)
    Get-ChildItem -Path $drive -Recurse -Directory -Name "MQL4" -ErrorAction SilentlyContinue | Where-Object {
        $fullPath = Join-Path $drive $_
        $shouldExclude = $false
        foreach ($exclude in $excludePaths) {
            if ($fullPath -like "*$exclude*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | ForEach-Object {
        Join-Path $drive $_
    }
    
    # Buscar MQL5 (excluyendo carpetas del sistema)
    Get-ChildItem -Path $drive -Recurse -Directory -Name "MQL5" -ErrorAction SilentlyContinue | Where-Object {
        $fullPath = Join-Path $drive $_
        $shouldExclude = $false
        foreach ($exclude in $excludePaths) {
            if ($fullPath -like "*$exclude*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | ForEach-Object {
        Join-Path $drive $_
    }
    
    ${this.cTraderEnabled ? `
    # Buscar cTrader folders si está habilitado (excluyendo carpetas del sistema)
    Get-ChildItem -Path $drive -Recurse -Directory -Name "cTrader" -ErrorAction SilentlyContinue | Where-Object {
        $fullPath = Join-Path $drive $_
        $shouldExclude = $false
        foreach ($exclude in $excludePaths) {
            if ($fullPath -like "*$exclude*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | ForEach-Object {
        Join-Path $drive $_
    }
    Get-ChildItem -Path $drive -Recurse -Directory -Name "cAlgo" -ErrorAction SilentlyContinue | Where-Object {
        $fullPath = Join-Path $drive $_
        $shouldExclude = $false
        foreach ($exclude in $excludePaths) {
            if ($fullPath -like "*$exclude*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | ForEach-Object {
        Join-Path $drive $_
    }
    Get-ChildItem -Path $drive -Recurse -Directory -Name "Spotware" -ErrorAction SilentlyContinue | Where-Object {
        $fullPath = Join-Path $drive $_
        $shouldExclude = $false
        foreach ($exclude in $excludePaths) {
            if ($fullPath -like "*$exclude*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | ForEach-Object {
        Join-Path $drive $_
    }` : ''}
}`;

      // Ejecutar comando con timeout
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
        if (error.stdout) {
          stdout = error.stdout;
        }
      }

      // Procesar resultados - NO necesitamos filtros complejos
      const allFolders = stdout
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('Scanning drive:'));

      // Separar por tipo de carpeta basado en el NOMBRE de la carpeta, no la ruta
      const mql4Folders = allFolders.filter(folder => {
        const folderName = path.basename(folder);
        return folderName === 'MQL4';
      });
      
      const mql5Folders = allFolders.filter(folder => {
        const folderName = path.basename(folder);
        return folderName === 'MQL5';
      });
      
      const ctraderFolders = this.cTraderEnabled
        ? allFolders.filter(folder => {
            const folderName = path.basename(folder);
            return folderName === 'cTrader' || folderName === 'cAlgo' || folderName === 'Spotware';
          })
        : [];

      // Remover duplicados
      const uniqueMQL4 = [...new Set(mql4Folders)];
      const uniqueMQL5 = [...new Set(mql5Folders)];
      const uniqueCtrader = [...new Set(ctraderFolders)];

      console.log(`✅ Found ${uniqueMQL4.length} MQL4, ${uniqueMQL5.length} MQL5${this.cTraderEnabled ? `, ${uniqueCtrader.length} cTrader` : ''} folders`);

      return {
        mql4Folders: uniqueMQL4,
        mql5Folders: uniqueMQL5,
        ctraderFolders: uniqueCtrader,
      };
    } catch (error) {
      console.error(`❌ Error in Windows platform search: ${error.message}`);
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

  // Búsqueda simplificada para NinjaTrader en Windows - busca por nombres exactos
  async findNinjaTraderFoldersWindows() {
    try {
      console.log('🔍 Searching for NinjaTrader folders by exact name across all drives...');

      // Comando PowerShell simplificado - busca SOLO carpetas con nombres que contengan "NinjaTrader"
      const command = `Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $drive = $_.Root
    Write-Host "Scanning drive for NinjaTrader: $drive"
    
    # Buscar carpetas que contengan "NinjaTrader" en el nombre (excluyendo cache/temp)
    Get-ChildItem -Path $drive -Recurse -Directory -ErrorAction SilentlyContinue 2>$null | 
    Where-Object { 
        $_.Name -like "*NinjaTrader*" -and 
        $_.Name -notlike "*cache*" -and 
        $_.Name -notlike "*temp*" -and
        $_.Name -notlike "*backup*"
    } | 
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

      // Procesar resultados
      const allFolders = stdout
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('Scanning drive'));

      // Filtrar solo carpetas válidas que existan
      const validFolders = allFolders.filter(folder => {
        try {
          return fs.existsSync(folder) && fs.statSync(folder).isDirectory();
        } catch (error) {
          return false;
        }
      });

      // Remover duplicados
      const uniqueFolders = [...new Set(validFolders)];

      console.log(`✅ Found ${uniqueFolders.length} NinjaTrader folders`);
      if (uniqueFolders.length > 0) {
        console.log(`📁 NinjaTrader locations: ${uniqueFolders.map(f => path.basename(f)).join(', ')}`);
      }

      return uniqueFolders;
    } catch (error) {
      console.error(`❌ Error in Windows NinjaTrader search: ${error.message}`);
      return [];
    }
  }


  // Procesar una carpeta NinjaTrader solo para instalar bots (sin CSV)
  async processNinjaTraderFolderBotsOnly(folder, result) {
    try {
      // Verificar que estamos en Windows
      if (this.operatingSystem !== 'windows') {
        console.log('ℹ️ NinjaTrader processing skipped - only supported on Windows');
        return;
      }

      // Determinar la estructura correcta basada en el nombre de la carpeta
      const folderName = path.basename(folder).toUpperCase();
      let customPath;

      if (folderName.includes('NINJATRADER 8') || folderName.includes('NINJATRADER8')) {
        // NinjaTrader 8 structure: Documents/NinjaTrader 8/bin/Custom
        customPath = path.join(folder, 'bin', 'Custom');
      } else {
        // Default NinjaTrader structure: NinjaTrader/bin/Custom
        customPath = path.join(folder, 'bin', 'Custom');
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
    } catch (error) {
      result.errors.push(`Error processing NinjaTrader folder ${folder}: ${error.message}`);
      console.error(`❌ Error processing NinjaTrader folder:`, error);
    }
  }

  // Procesar una carpeta NinjaTrader individual (solo Windows) - método original completo
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
