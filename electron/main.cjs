const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Tray,
  Menu,
  nativeImage,
  protocol,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventSource } = require('eventsource');

// Función para manejar permisos de macOS de manera eficiente
async function requestMacOSPermissions() {
  if (process.platform !== 'darwin') return;

  try {
    const { systemPreferences } = require('electron');

    // Verificar si ya tenemos permisos de accesibilidad
    const hasAccessibilityPermission = systemPreferences.isTrustedAccessibilityClient(false);

    if (!hasAccessibilityPermission) {
      const granted = await systemPreferences.askForAccessibilityPermission();
    }

    // Verificar permisos de notificaciones
    const hasNotificationPermission = systemPreferences.isTrustedAccessibilityClient(false);
  } catch (error) {}
}

// Helper para leer el puerto del .env raíz o variables de entorno
function getPortFromEnv() {
  // Primero intentar leer de variables de entorno del proceso
  if (process.env.PORT) {
    return process.env.PORT;
  }

  if (process.env.VITE_SERVER_PORT) {
    return process.env.VITE_SERVER_PORT;
  }

  // Luego intentar leer del archivo .env en la raíz
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const portMatch = envContent.match(/^PORT=(\d+)/m);
    if (portMatch) return portMatch[1];

    const vitePortMatch = envContent.match(/^VITE_SERVER_PORT=(\d+)/m);
    if (vitePortMatch) return vitePortMatch[1];
  }

  return '3000'; // fallback por defecto
}

// Mejorar la detección de modo desarrollo
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let serverInstance;
let serverProcess; // Para el proceso del servidor en desarrollo
let mainWindow;
let tray = null;

// Configuración del autoUpdater
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
  // Configurar para NO descargar automáticamente
  autoUpdater.autoDownload = false;
}

// Configurar eventos del autoUpdater
autoUpdater.on('checking-for-update', () => {});

autoUpdater.on('update-available', info => {
  // Notificar al renderer process
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', info => {});

autoUpdater.on('error', err => {});

autoUpdater.on('download-progress', progressObj => {
  // Enviar progreso al renderer
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', info => {
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

// Handler para abrir enlaces externos
ipcMain.handle('open-external-link', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external link:', error);
    return { success: false, error: error.message };
  }
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

ipcMain.handle('quit-app', () => {
  app.isQuiting = true;
  app.quit();
});

// Handler para obtener el estado de fullscreen
ipcMain.handle('get-fullscreen-state', () => {
  if (mainWindow) {
    return mainWindow.isFullScreen();
  }
  return false;
});

// Handler para obtener la plataforma del sistema operativo
ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Handler para obtener la configuración de la ventana
ipcMain.handle('get-window-config', () => {
  const isMacOS = process.platform === 'darwin';
  return {
    platform: process.platform,
    isMacOS,
    hasTitleBar: isMacOS,
    hasFrame: isMacOS,
    hasMenuBar: !isMacOS, // En macOS se muestra, en otros se oculta
  };
});

async function startServer() {
  try {
    const port = getPortFromEnv();

    if (isDev) {
      // En desarrollo, lanzar el servidor como proceso hijo
      const serverPath = path.join(__dirname, '../server/src/dev.js');

      serverProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PORT: port },
        // En Windows, desconectar el proceso del padre para evitar que quede colgado
        detached: process.platform !== 'win32',
        windowsHide: true,
      });

      serverProcess.stdout.on('data', data => {});

      serverProcess.stderr.on('data', data => {});

      serverProcess.on('close', code => {});

      serverProcess.on('error', err => {});

      // Esperar un poco para que el servidor se inicie
      await new Promise(resolve => setTimeout(resolve, 2000));
      return;
    }

    // Only start the embedded server in production
    const serverPath = path.join(process.resourcesPath, 'server/dist/server.mjs');

    const { startServer } = require(serverPath);
    serverInstance = await startServer();
  } catch (error) {}
}

async function createAdaptiveIcon() {
  try {
    // Intentar usar canvas si está disponible
    const canvas = require('canvas').createCanvas(64, 64);
    const ctx = canvas.getContext('2d');

    // Habilitar suavizado para mejor calidad
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Crear un icono monocromático para template (solo negro)
    // Fondo transparente
  ctx.clearRect(0, 0, size, size);

    // Solo texto "IP" en negro (se invertirá automáticamente)
    ctx.fillStyle = '#000000';
  ctx.font = 'bold 54px Arial'; // Fuente más grande ya que no hay borde
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  ctx.fillText('IP', size / 2, size / 2);

    const buffer = canvas.toBuffer('image/png');
    const icon = nativeImage.createFromBuffer(buffer);

    // Redimensionar a 16x16 con alta calidad
    const resizedIcon = icon.resize({ width: 16, height: 16, quality: 'best' });

    // En macOS, marcar como template para adaptación automática
    if (process.platform === 'darwin') {
      resizedIcon.setTemplateImage(true);
    }

    return resizedIcon;
  } catch (error) {
    // Fallback: usar ícono estático si canvas no está disponible
    const iconPath = path.join(__dirname, '../public/tray-icon.png');
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath);
    }
    // Último fallback: usar el ícono principal
    const mainIconPath = path.join(__dirname, '../public/iconShadow025.png');
    return nativeImage.createFromPath(mainIconPath);
  }
}

async function createTray() {
  try {
    // Crear un icono adaptativo
    let icon;

    if (process.platform === 'darwin') {
      // En macOS, crear icono adaptativo
      icon = await createAdaptiveIcon();
    } else {
      // En otros sistemas, usar el archivo de icono
      const iconPath = path.join(__dirname, '../public/iconShadow025.png');
      if (require('fs').existsSync(iconPath)) {
        icon = nativeImage.createFromPath(iconPath);
      } else {
        return;
      }
    }

    tray = new Tray(icon);
    tray.setToolTip('IPTRADE');

    // Función para crear el menú del tray
    const createTrayMenu = (copierStatus = 'OFF') => {
      return Menu.buildFromTemplate([
        {
          label: `IPTRADE COPIER ${copierStatus}`,
          enabled: false, // Solo para mostrar el estado, no clickeable
          type: 'normal',
        },
        { type: 'separator' },
        {
          label: 'Go to the dashboard',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();

              // En macOS, mostrar el icono del dock cuando la ventana está visible
              if (process.platform === 'darwin') {
                app.dock.show();
              }
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.quit();
          },
        },
      ]);
    };

    // Función para actualizar el menú del tray con SSE
    const setupSSEForTray = () => {
      const serverPort = getPortFromEnv();
      const sseUrl = `http://localhost:${serverPort}/api/csv/events/frontend`;

      const eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        // Actualización inicial del menú - se actualizará cuando lleguen los datos
        if (tray) {
          tray.setContextMenu(createTrayMenu('OFF'));
        }
      };

      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          // Procesar eventos relevantes para el copier status
          if (data.type === 'csv_updated' || data.type === 'initial_data') {
            const copierStatus = data.copierStatus?.globalStatus ? 'ON' : 'OFF';

            // Solo actualizar si el estado cambió y el tray existe
            if (tray && tray.lastCopierStatus !== copierStatus) {
              tray.setContextMenu(createTrayMenu(copierStatus));
              tray.lastCopierStatus = copierStatus;
            }
          }
        } catch (error) {}
      };

      eventSource.onerror = error => {
        // En caso de error, mostrar estado OFF solo si el tray existe
        if (tray) {
          tray.setContextMenu(createTrayMenu('OFF'));
        }

        // Reintentar conexión después de 5 segundos
        setTimeout(() => {
          if (eventSource.readyState === EventSource.CLOSED) {
            setupSSEForTray();
          }
        }, 5000);
      };

      return eventSource;
    };

    // Configurar SSE para el tray
    let trayEventSource = null;

    // Esperar 5 segundos para que el servidor esté listo, luego configurar SSE
    setTimeout(() => {
      trayEventSource = setupSSEForTray();
    }, 5000);

    // NO hacer nada al hacer clic en el icono del tray
    // Solo mostrar el menú contextual
    tray.on('click', () => {});

    // En macOS, el icono se adapta automáticamente gracias a setTemplateImage(true)
    // No necesitamos verificar cambios de tema manualmente
  } catch (error) {}
}

function createWindow() {
  // Configuración de la ventana según el sistema operativo
  const isMacOS = process.platform === 'darwin';

  const windowConfig = {
    width: 1000,
    minWidth: 1000,
    height: 800,
    minHeight: 800,
    resizable: true,
    icon: path.join(__dirname, '../public/iconShadow025.png'),
    title: 'IPTRADE',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: isDev, // Solo habilitar DevTools en desarrollo
      webSecurity: false, // Permitir cargar recursos locales
    },
  };

  // Configuración específica según el sistema operativo
  if (isMacOS) {
    // En macOS: mostrar barra de título nativa
    Object.assign(windowConfig, {
      titleBarStyle: 'default', // Barra de título nativa de macOS
      frame: true, // Frame nativo
      autoHideMenuBar: false, // Mostrar barra de menú
    });
  } else {
    // En Windows/Linux: mostrar barra de título nativa
    Object.assign(windowConfig, {
      titleBarStyle: 'default',
      frame: true,
      autoHideMenuBar: true,
    });
  }

  mainWindow = new BrowserWindow(windowConfig);

  // Log de la configuración aplicada

  // Deshabilitar teclas de acceso rápido del navegador
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isMac = process.platform === 'darwin';
    const isCtrl = input.control || (isMac && input.meta);
    const isShift = input.shift;
    const key = input.key.toLowerCase();

    // Lista de combinaciones de teclas a deshabilitar
    const disabledShortcuts = [
      // Refresh
      { condition: isCtrl && key === 'r', name: 'Ctrl+R (Refresh)' },
      { condition: key === 'f5', name: 'F5 (Refresh)' },
      { condition: isCtrl && isShift && key === 'r', name: 'Ctrl+Shift+R (Hard Refresh)' },

      // DevTools
      { condition: key === 'f12', name: 'F12 (DevTools)' },
      { condition: isCtrl && isShift && key === 'i', name: 'Ctrl+Shift+I (DevTools)' },
      { condition: isCtrl && isShift && key === 'c', name: 'Ctrl+Shift+C (Inspector)' },
      { condition: isCtrl && isShift && key === 'j', name: 'Ctrl+Shift+J (Console)' },
      { condition: isCtrl && isShift && key === 'm', name: 'Ctrl+Shift+M (Responsive)' },

      // Ver código fuente
      { condition: isCtrl && key === 'u', name: 'Ctrl+U (View Source)' },

      // Navegación del navegador
      { condition: isCtrl && key === 'l', name: 'Ctrl+L (Address Bar)' },
      { condition: isCtrl && key === 't', name: 'Ctrl+T (New Tab)' },
      { condition: isCtrl && key === 'w', name: 'Ctrl+W (Close Tab)' },
      { condition: isCtrl && key === 'n', name: 'Ctrl+N (New Window)' },

      // Zoom
      { condition: isCtrl && key === '=', name: 'Ctrl+= (Zoom In)' },
      { condition: isCtrl && key === '-', name: 'Ctrl+- (Zoom Out)' },
      { condition: isCtrl && key === '0', name: 'Ctrl+0 (Reset Zoom)' },

      // En macOS, también deshabilitar Cmd+Option+I (DevTools)
      {
        condition: isMac && input.meta && input.alt && key === 'i',
        name: 'Cmd+Option+I (DevTools)',
      },
    ];

    // Verificar si la combinación de teclas está en la lista de deshabilitadas
    for (const shortcut of disabledShortcuts) {
      if (shortcut.condition) {
        event.preventDefault();
        return;
      }
    }
  });

  // Deshabilitar menú contextual del navegador
  mainWindow.webContents.on('context-menu', event => {
    event.preventDefault();
  });

  // Prevenir que se abran las DevTools
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });

  // Prevenir que se abran nuevas ventanas
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  // Manejar enlaces externos
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Manejar el evento de cierre de ventana
  mainWindow.on('close', async event => {
    // En Windows, cerrar la aplicación completamente cuando se cierra la ventana
    if (process.platform === 'win32') {
      event.preventDefault();

      // Marcar que estamos cerrando
      app.isQuiting = true;

      // Limpiar todos los procesos
      await cleanupProcesses();

      // Cerrar la ventana principal
      mainWindow = null;

      // Forzar el cierre de la aplicación
      app.exit(0);
    } else {
      // En otras plataformas, mantener el comportamiento de minimizar al tray
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();

        // En macOS, NO ocultar el icono del dock para mantener comportamiento nativo
        // Solo ocultar en otras plataformas
        if (process.platform !== 'darwin') {
          // Para otras plataformas, ocultar completamente
        }

        return false;
      }
    }
  });

  // Manejar el evento de minimizar
  mainWindow.on('minimize', event => {
    // En macOS, permitir minimización normal
    if (process.platform === 'darwin') {
      return; // No prevenir el comportamiento por defecto
    }

    // En otras plataformas, ocultar al tray
    event.preventDefault();
    mainWindow.hide();
  });

  // Manejar eventos de fullscreen
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', false);
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
  // Solicitar permisos necesarios una sola vez al inicio
  await requestMacOSPermissions();

  await startServer();
  // Cambiar el nombre de la app
  app.setName('IPTRADE');

  // Configurar menú de aplicación para deshabilitar teclas de acceso rápido
  if (process.platform !== 'darwin') {
    const { Menu } = require('electron');
    const template = [
      {
        label: 'IPTRADE',
        submenu: [
          {
            label: 'About IPTRADE',
            role: 'about',
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  createWindow();

  await createTray();

  // Configurar el icono del dock en macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '../public/iconShadow025.png'));
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async function () {
  // En Windows, cerrar la aplicación completamente
  if (process.platform === 'win32') {
    app.isQuiting = true;
    await cleanupProcesses();
    app.exit(0);
  }
  // En macOS, mantener la app abierta (comportamiento estándar de macOS)
  // En Linux, también cerrar la app
  else if (process.platform !== 'darwin') {
    app.isQuiting = true;
    await cleanupProcesses();
    app.quit();
  }
});

// Función para limpiar todos los procesos
async function cleanupProcesses() {
  // Cerrar el servidor
  if (serverInstance) {
    return new Promise(resolve => {
      serverInstance.close(() => {
        serverInstance = null;
        resolve();
      });
    });
  }

  // Terminar el proceso del servidor en desarrollo
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }

  // Destruir el tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

// Manejar el evento before-quit para limpiar recursos
app.on('before-quit', async event => {
  if (!app.isQuiting) {
    event.preventDefault();
    app.isQuiting = true;

    await cleanupProcesses();

    // Ahora sí, cerrar la app
    app.quit();
  }
});

// Manejar el evento will-quit para asegurar limpieza final
app.on('will-quit', () => {
  // Forzar el cierre de cualquier proceso restante
  if (serverProcess) {
    serverProcess.kill('SIGKILL');
  }
});

// Manejar señales de proceso para limpiar cuando se cierra desde la terminal
process.on('SIGINT', async () => {
  await cleanupProcesses();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupProcesses();
  process.exit(0);
});

// En Windows, también manejar CTRL+C
if (process.platform === 'win32') {
  process.on('SIGBREAK', async () => {
    await cleanupProcesses();
    process.exit(0);
  });
}
