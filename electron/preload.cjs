const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs al renderer process de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
  // APIs de actualización
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

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

  // Remover listeners
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  },
});
