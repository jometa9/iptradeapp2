const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
let serverInstance;

async function startServer() {
  try {
    let serverPath;
    if (isDev) {
      serverPath = path.join(__dirname, '../server/dist/server.cjs');
    } else {
      // En producción, el server está en resources/server/dist/server.cjs
      serverPath = path.join(process.resourcesPath, 'server/dist/server.cjs');
    }
    
    console.log('[ELECTRON] Loading server from:', serverPath);
    
    // Importar el servidor directamente
    const { startServer } = require(serverPath);
    serverInstance = await startServer();
    
    console.log('[ELECTRON] Server started successfully');
  } catch (error) {
    console.error('[ELECTRON] Failed to start server:', error);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (serverInstance) {
    console.log('[ELECTRON] Closing server');
    serverInstance.close();
  }
  if (process.platform !== 'darwin') app.quit();
}); 