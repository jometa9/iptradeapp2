import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = util.promisify(exec);

class LinkPlatformsController {
  constructor() {
    this.botsPath = path.join(__dirname, '../../../bots');
  }

  async linkPlatforms(req, res) {
    try {
      console.log('🔗 Starting Link Platforms process...');
      
      const result = await this.findAndSyncMQLFolders();
      
      res.json({
        success: true,
        message: 'Link Platforms process completed',
        result
      });
    } catch (error) {
      console.error('❌ Link Platforms error:', error);
      res.status(500).json({
        success: false,
        message: 'Link Platforms process failed',
        error: error.message
      });
    }
  }

  async findAndSyncMQLFolders() {
    const result = {
      mql4Folders: [],
      mql5Folders: [],
      created: 0,
      synced: 0,
      errors: []
    };

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
        } catch (error) {
          result.errors.push(`Error scanning drive ${drive}: ${error.message}`);
        }
      }

      console.log(`✅ Link Platforms completed: ${result.mql4Folders.length} MQL4 folders, ${result.mql5Folders.length} MQL5 folders`);
      console.log(`📁 Created: ${result.created}, Synced: ${result.synced}, Errors: ${result.errors.length}`);

    } catch (error) {
      result.errors.push(`General error: ${error.message}`);
    }

    return result;
  }

  async getAvailableDrives() {
    try {
      const { stdout } = await execAsync('wmic logicaldisk get caption');
      const drives = stdout
        .split('\n')
        .slice(1) // Remove header
        .map(line => line.trim())
        .filter(line => line && line.length > 0)
        .map(drive => drive + '\\');
      
      console.log(`🔍 Found drives: ${drives.join(', ')}`);
      return drives;
    } catch (error) {
      console.error('❌ Error getting drives:', error);
      return ['C:\\']; // Fallback to C: drive
    }
  }

  async scanDrive(drivePath) {
    const result = {
      mql4Folders: [],
      mql5Folders: [],
      created: 0,
      synced: 0,
      errors: []
    };

    try {
      // Buscar carpetas MQL4 y MQL5 recursivamente
      const mql4Folders = await this.findFoldersRecursively(drivePath, 'MQL4');
      const mql5Folders = await this.findFoldersRecursively(drivePath, 'MQL5');

      // Procesar carpetas MQL4
      for (const folder of mql4Folders) {
        try {
          const expertsPath = path.join(folder, 'Experts');
          const botPath = path.join(this.botsPath, 'MQL4.mq4');
          
          if (!fs.existsSync(expertsPath)) {
            fs.mkdirSync(expertsPath, { recursive: true });
            result.created++;
            console.log(`📁 Created MQL4/Experts folder: ${expertsPath}`);
          }

          const targetBotPath = path.join(expertsPath, 'MQL4.mq4');
          if (fs.existsSync(botPath)) {
            fs.copyFileSync(botPath, targetBotPath);
            result.synced++;
            console.log(`📋 Synced MQL4 bot to: ${targetBotPath}`);
          }

          result.mql4Folders.push(folder);
        } catch (error) {
          result.errors.push(`Error processing MQL4 folder ${folder}: ${error.message}`);
        }
      }

      // Procesar carpetas MQL5
      for (const folder of mql5Folders) {
        try {
          const expertsPath = path.join(folder, 'Experts');
          const botPath = path.join(this.botsPath, 'MQL5.mq5');
          
          if (!fs.existsSync(expertsPath)) {
            fs.mkdirSync(expertsPath, { recursive: true });
            result.created++;
            console.log(`📁 Created MQL5/Experts folder: ${expertsPath}`);
          }

          const targetBotPath = path.join(expertsPath, 'MQL5.mq5');
          if (fs.existsSync(botPath)) {
            fs.copyFileSync(botPath, targetBotPath);
            result.synced++;
            console.log(`📋 Synced MQL5 bot to: ${targetBotPath}`);
          }

          result.mql5Folders.push(folder);
        } catch (error) {
          result.errors.push(`Error processing MQL5 folder ${folder}: ${error.message}`);
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
      const findCommand = `dir /s /b /ad "${rootPath}" | findstr /i "\\\\${folderName}$"`;
      const { stdout } = await execAsync(findCommand);
      
      const foundFolders = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.length > 0);
      
      folders.push(...foundFolders);
      
    } catch (error) {
      // Si el comando falla, intentar con una búsqueda más simple
      try {
        await this.findFoldersRecursivelySimple(rootPath, folderName, folders);
      } catch (simpleError) {
        console.error(`Error in simple folder search for ${folderName}:`, simpleError);
      }
    }

    return folders;
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
                // Evitar carpetas del sistema y temporales
                const skipFolders = ['$RECYCLE.BIN', 'System Volume Information', 'Windows', 'Program Files', 'Program Files (x86)', 'Temp', 'tmp'];
                if (!skipFolders.some(skip => item.toUpperCase().includes(skip.toUpperCase()))) {
                  await searchRecursively(fullPath, depth + 1);
                }
              }
            }
          } catch (error) {
            // Ignorar errores de acceso
          }
        }
      } catch (error) {
        // Ignorar errores de acceso
      }
    };

    await searchRecursively(rootPath);
  }
}

export default new LinkPlatformsController();
