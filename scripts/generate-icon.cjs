const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

async function generateIcon() {
  try {
    console.log('🎨 Generando icono de aplicación...');

    const inputPath = path.join(__dirname, '../public/iconShadow025.png');
    const outputPath = path.join(__dirname, '../public/app-icon.ico');

    // Verificar que existe la imagen fuente
    if (!fs.existsSync(inputPath)) {
      throw new Error(`No se encontró la imagen fuente: ${inputPath}`);
    }

    // Dimensiones necesarias para Windows
    const sizes = [16, 32, 48, 64, 128, 256];
    
    console.log(`📐 Generando imágenes en ${sizes.length} tamaños...`);
    
    // Generar cada tamaño
    const buffers = await Promise.all(
      sizes.map(async (size) => {
        console.log(`  ↳ Generando ${size}x${size}...`);
        return await sharp(inputPath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toBuffer();
      })
    );

    console.log('🔨 Creando archivo .ico...');
    
    // Crear el archivo .ico con todos los tamaños
    const icoBuffer = await toIco(buffers);
    
    // Guardar el archivo
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log('✅ Icono generado exitosamente en:', outputPath);
    console.log('📊 Tamaños incluidos:', sizes.map(s => `${s}x${s}`).join(', '));
    
    // También copiar a dist si existe
    const distIconPath = path.join(__dirname, '../dist/app-icon.ico');
    if (fs.existsSync(path.join(__dirname, '../dist'))) {
      fs.writeFileSync(distIconPath, icoBuffer);
      console.log('✅ Icono copiado a dist/');
    }

    return true;
  } catch (error) {
    console.error('❌ Error al generar el icono:', error.message);
    console.error(error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateIcon()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { generateIcon };

