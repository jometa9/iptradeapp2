const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');

// Mejorar la detección de modo desarrollo
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let serverInstance;
let serverProcess; // Para el proceso del servidor en desarrollo
let mainWindow;

// Configuración del autoUpdater
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
  // Configurar para NO descargar automáticamente
  autoUpdater.autoDownload = false;
}

// Configurar eventos del autoUpdater
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', info => {
  console.log('Update available.');
  // Notificar al renderer process
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', info => {
  console.log('Update not available.');
});

autoUpdater.on('error', err => {
  console.log('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', progressObj => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  console.log(log_message);

  // Enviar progreso al renderer
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', info => {
  console.log('Update downloaded');
  // Mostrar diálogo para reiniciar
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// IPC handlers para el renderer
ipcMain.handle('check-for-updates', async () => {
  if (!isDev) {
    return await autoUpdater.checkForUpdatesAndNotify();
  }
  return null;
});

ipcMain.handle('download-update', async () => {
  if (!isDev) {
    return await autoUpdater.downloadUpdate();
  }
  return null;
});

ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

async function startServer() {
  try {
    console.log('[ELECTRON] Development mode:', isDev);

    if (isDev) {
      console.log('[ELECTRON] Starting development server...');

      // En desarrollo, lanzar el servidor como proceso hijo
      const serverPath = path.join(__dirname, '../server/src/dev.js');
      console.log('[ELECTRON] Starting server from:', serverPath);

      serverProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PORT: '3000' },
      });

      serverProcess.stdout.on('data', data => {
        console.log(`[SERVER] ${data.toString().trim()}`);
      });

      serverProcess.stderr.on('data', data => {
        console.error(`[SERVER ERROR] ${data.toString().trim()}`);
      });

      serverProcess.on('close', code => {
        console.log(`[SERVER] Process exited with code ${code}`);
      });

      serverProcess.on('error', err => {
        console.error('[SERVER] Failed to start:', err);
      });

      // Esperar un poco para que el servidor se inicie
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('[ELECTRON] Development server should be starting...');
      return;
    }

    // Only start the embedded server in production
    const serverPath = path.join(process.resourcesPath, 'server/dist/server.mjs');
    console.log('[ELECTRON] Loading server from:', serverPath);

    const { startServer } = require(serverPath);
    serverInstance = await startServer();

    console.log('[ELECTRON] Server started successfully');
  } catch (error) {
    console.error('[ELECTRON] Failed to start server:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    minWidth: 1000,
    height: 750,
    minHeight: 750,
    icon: path.join(__dirname, '../public/iconShadow025.png'),
    title: 'IPTRADE',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

    if (isDev) {
    // Try to load from the correct port (Vite might use different ports)
    const devServerPort = process.env.VITE_PORT || 5174;
    mainWindow.loadURL(`http://localhost:${devServerPort}`);
    // Uncomment the line below if you need DevTools during development
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // Verificar actualizaciones después de cargar la app (solo en producción)
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3600000);
  }
}

app.whenReady().then(async () => {
  await startServer();
  // Cambiar el nombre de la app
  app.setName('IPTRADE');
  createWindow();

  // Configurar el icono del dock en macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '../public/iconShadow025.png'));
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (serverInstance) {
    console.log('[ELECTRON] Closing server');
    serverInstance.close();
  }

  // Terminar el proceso del servidor en desarrollo
  if (serverProcess) {
    console.log('[ELECTRON] Closing development server');
    serverProcess.kill();
  }

  if (process.platform !== 'darwin') app.quit();
});
