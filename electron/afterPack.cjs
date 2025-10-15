const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hook afterPack de electron-builder
 * Se ejecuta después de empaquetar la aplicación pero antes de crear el instalador
 * 
 * Este script embebe el icono en el ejecutable y lo copia al directorio correcto
 */
exports.default = async function(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'win32') {
    console.log('Skipping icon embedding (not Windows)');
    return;
  }

  try {
    const sourceIcon = path.join(__dirname, '../public/app-icon.ico');
    const exePath = path.join(appOutDir, 'IPTRADE.exe');
    
    if (!fs.existsSync(sourceIcon)) {
      return;
    }

    if (!fs.existsSync(exePath)) {
      return;
    }

    const rceditPath = path.join(
      __dirname, 
      '..',
      'node_modules',
      'rcedit',
      'bin',
      'rcedit.exe'
    );

    if (fs.existsSync(rceditPath)) {
      try {
        execSync(`"${rceditPath}" "${exePath}" --set-icon "${sourceIcon}"`, {
          stdio: 'inherit'
        });
      } catch (error) {
        console.warn('Error al embebed icono con rcedit:', error.message);
      }
    } else {
      console.log('rcedit no encontrado, electron-builder debería manejar el icono');
    }
    
    // Copiar el icono a múltiples ubicaciones para asegurar que Windows lo encuentre
    const targetLocations = [
      path.join(appOutDir, 'app-icon.ico'),
      path.join(appOutDir, 'resources', 'app-icon.ico'),
    ];

    for (const targetIcon of targetLocations) {
      const targetDir = path.dirname(targetIcon);
      
      // Crear el directorio si no existe
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copiar el icono
      fs.copyFileSync(sourceIcon, targetIcon);
    }

  } catch (error) {
    console.error('Error al configurar el icono:', error);
    // No lanzar el error para no interrumpir el build
  }
};

