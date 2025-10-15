const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createInstallerSidebar() {
  try {
    console.log('🎨 Creando imagen sidebar para instalador NSIS...');

    const inputPath = path.join(__dirname, '../public/sidebar.png');
    const outputBmpPath = path.join(__dirname, '../public/installer-sidebar.bmp');

    if (!fs.existsSync(inputPath)) {
      throw new Error(`No se encontró la imagen: ${inputPath}`);
    }

    // NSIS requiere 164x314 píxeles exactos
    const targetWidth = 164;
    const targetHeight = 314;
    
    console.log(`📐 Procesando imagen a ${targetWidth}x${targetHeight} BMP...`);
    
    // Convertir a BMP sin transparencia, fondo blanco
    // Sharp no puede crear BMP directamente, así que vamos a usar PNG temporalmente
    // y luego convertirlo con una utilidad nativa
    
    const tempPngPath = path.join(__dirname, '../public/temp-sidebar.png');
    
    await sharp(inputPath)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ compressionLevel: 0 })
      .toFile(tempPngPath);
    
    console.log('✅ Imagen temporal PNG creada');
    
    // Convertir a BMP usando Jimp
    try {
      const Jimp = require('jimp');
      console.log('📦 Cargando imagen con Jimp...');
      const image = await Jimp.read(tempPngPath);
      console.log('💾 Guardando como BMP...');
      await image.quality(100).writeAsync(outputBmpPath);
      console.log('✅ Imagen BMP creada con Jimp:', outputBmpPath);
    } catch (jimpError) {
      console.log('⚠️  Jimp error:', jimpError.message);
      console.log('⚠️  Usando PNG como alternativa');
      // Si Jimp falla, usar PNG
      const pngOutputPath = outputBmpPath.replace('.bmp', '.png');
      fs.copyFileSync(tempPngPath, pngOutputPath);
      console.log('✅ Usando PNG como alternativa:', pngOutputPath);
    }
    
    // Limpiar archivo temporal
    if (fs.existsSync(tempPngPath)) {
      fs.unlinkSync(tempPngPath);
    }
    
    // Copiar a dist si existe
    if (fs.existsSync(path.join(__dirname, '../dist'))) {
      const distPath = path.join(__dirname, '../dist/installer-sidebar.bmp');
      if (fs.existsSync(outputBmpPath)) {
        fs.copyFileSync(outputBmpPath, distPath);
        console.log('✅ Copiado a dist/');
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    return false;
  }
}

if (require.main === module) {
  createInstallerSidebar()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { createInstallerSidebar };

