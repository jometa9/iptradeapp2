const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs al renderer process de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
  // APIs de actualización
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // API para abrir enlaces externos
  openExternalLink: url => ipcRenderer.invoke('open-external-link', url),

  // API para cerrar la aplicación
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // API para obtener el estado de fullscreen
  getFullscreenState: () => ipcRenderer.invoke('get-fullscreen-state'),

  // API para obtener la plataforma del sistema operativo
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // API para obtener la configuración de la ventana
  getWindowConfig: () => ipcRenderer.invoke('get-window-config'),

  // Listeners para eventos de actualización
  onUpdateAvailable: callback => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },

  onDownloadProgress: callback => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },

  onUpdateDownloaded: callback => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },

  // Listener para cambios de fullscreen
  onFullscreenChanged: callback => {
    ipcRenderer.on('fullscreen-changed', (event, isFullscreen) => callback(isFullscreen));
  },

  // Remover listeners
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  },
});
