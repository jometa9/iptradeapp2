const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function prepareInstallerImages() {
  try {
    console.log('🎨 Preparando imágenes del instalador...');

    const sidebarInputPath = path.join(__dirname, '../public/sidebar.png');
    const sidebarOutputPath = path.join(__dirname, '../public/installer-sidebar.png');

    // Verificar que existe la imagen fuente
    if (!fs.existsSync(sidebarInputPath)) {
      throw new Error(`No se encontró la imagen sidebar: ${sidebarInputPath}`);
    }

    // Obtener metadatos de la imagen
    const metadata = await sharp(sidebarInputPath).metadata();
    console.log(`📐 Imagen original: ${metadata.width}x${metadata.height}`);

    // NSIS requiere 164x314 píxeles para el sidebar
    const targetWidth = 164;
    const targetHeight = 314;
    
    // Si la imagen ya tiene el tamaño correcto, solo copiarla
    if (metadata.width === targetWidth && metadata.height === targetHeight) {
      console.log('✅ La imagen ya tiene el tamaño correcto, copiando...');
      fs.copyFileSync(sidebarInputPath, sidebarOutputPath);
    } else {
      console.log(`📐 Redimensionando a ${targetWidth}x${targetHeight} para NSIS...`);
      
      // Redimensionar manteniendo PNG
      await sharp(sidebarInputPath)
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // Fondo blanco
        })
        .png()
        .toFile(sidebarOutputPath);
    }
    
    console.log('✅ Imagen sidebar del instalador creada:', sidebarOutputPath);
    
    // También copiar a dist si existe
    const distSidebarPath = path.join(__dirname, '../dist/installer-sidebar.png');
    if (fs.existsSync(path.join(__dirname, '../dist'))) {
      fs.copyFileSync(sidebarOutputPath, distSidebarPath);
      console.log('✅ Imagen copiada a dist/');
    }

    return true;
  } catch (error) {
    console.error('❌ Error al preparar imágenes del instalador:', error.message);
    console.error(error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  prepareInstallerImages()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { prepareInstallerImages };

