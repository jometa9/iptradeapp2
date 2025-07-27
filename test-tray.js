const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Crear un icono simple de prueba
function createTestIcon() {
  const size = 16;
  const canvas = require('canvas').createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fondo azul
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(0, 0, size, size);

  // Texto "IP" en blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IP', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  return nativeImage.createFromBuffer(buffer);
}

app.whenReady().then(() => {
  console.log('[TEST] Creating test tray...');

  const icon = createTestIcon();
  const tray = new Tray(icon);
  tray.setToolTip('IPTRADE Test');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Test - Mostrar',
      click: () => {
        console.log('[TEST] Test menu clicked');
      },
    },
    {
      label: 'Test - Salir',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    console.log('[TEST] Tray icon clicked');
  });

  console.log('[TEST] Test tray created successfully');
  console.log('[TEST] Look for the blue "IP" icon in your menu bar');
});

app.on('window-all-closed', () => {
  // No cerrar la app
});
