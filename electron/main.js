const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Set app name
app.setName('IPTRADE');

// Set app as default protocol client for iptradeapp://
try {
  if (isDev) {
    // In development, force registration with full path
    const electronPath = process.execPath;
    const appPath = app.getAppPath();

    // Force remove any existing registration first
    app.removeAsDefaultProtocolClient('iptradeapp');

    // Register with full executable path
    app.setAsDefaultProtocolClient('iptradeapp', electronPath, [appPath]);

    // Also try simple registration as backup
    app.setAsDefaultProtocolClient('iptradeapp');
  } else {
    // In production, register normally
    if (!app.isDefaultProtocolClient('iptradeapp')) {
      app.setAsDefaultProtocolClient('iptradeapp');
    }
  }
} catch (error) {
  // Silent error handling
}

// Make app single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

// Determine the server path
const getServerPath = () => {
  if (isDev) {
    return path.join(__dirname, '../server/src/index.js');
  }
  // In production, the server is in the extra resources
  return path.join(process.resourcesPath, 'server/src/index.js');
};

// Import the Express server
const server = require(getServerPath());

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  // Server running on port 30
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'IPTRADE',
    titleBarStyle: 'default',
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  // In development, load from the dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    //mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle protocol for Windows/Linux
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    // Handle deep link from command line
    const url = commandLine.find(arg => arg.startsWith('iptradeapp://'));
    if (url) {
      handleDeepLink(url);
    }
  }
});

// Handle protocol for macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Function to handle deep link
function handleDeepLink(url) {
  if (mainWindow && url.startsWith('iptradeapp://login')) {
    // Focus the window first
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();

    // Send via IPC
    mainWindow.webContents.send('deep-link', { url });

    // Also inject directly via JavaScript as fallback
    const jsCode = `
      window.dispatchEvent(new CustomEvent('auth-callback', {
        detail: { url: '${url}' }
      }));
    `;

    mainWindow.webContents.executeJavaScript(jsCode).catch(() => {
      // Silent error handling
    });
  }
}

// Handle deep link on app startup (Windows/Linux)
if (process.platform === 'win32' || process.platform === 'linux') {
  const args = process.argv.slice(1);
  const deepLinkUrl = args.find(arg => arg.startsWith('iptradeapp://'));
  if (deepLinkUrl) {
    // Delay handling until app is ready
    app.whenReady().then(() => {
      setTimeout(() => handleDeepLink(deepLinkUrl), 1000);
    });
  }
}
