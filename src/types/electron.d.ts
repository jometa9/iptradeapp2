export interface UpdateInfo {
  version: string;
  files: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
  path: string;
  sha512: string;
  releaseDate: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface WindowConfig {
  platform: string;
  isMacOS: boolean;
  hasTitleBar: boolean;
  hasFrame: boolean;
  hasMenuBar: boolean;
}

export interface ElectronAPI {
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartApp: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  openExternalLink: (url: string) => Promise<{ success: boolean; error?: string }>;
  quitApp: () => Promise<void>;
  getFullscreenState: () => Promise<boolean>;
  getPlatform: () => Promise<string>;
  getWindowConfig: () => Promise<WindowConfig>;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => void;
  onDeepLink: (callback: (data: { url: string }) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: {
      // APIs de actualización
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<any>;
      restartApp: () => Promise<any>;
      getAppVersion: () => Promise<string>;

      // API para abrir enlaces externos
      openExternalLink: (url: string) => Promise<{ success: boolean; error?: string }>;

      // API para cerrar la aplicación
      quitApp: () => Promise<void>;

      // API para obtener el estado de fullscreen
      getFullscreenState: () => Promise<boolean>;

      // API para obtener la plataforma del sistema operativo
      getPlatform: () => Promise<string>;

      // API para obtener la configuración de la ventana
      getWindowConfig: () => Promise<WindowConfig>;

      // Listeners para eventos de actualización
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onDownloadProgress: (callback: (progress: any) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;

      // Listener para cambios de fullscreen
      onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => void;

      // Deep link listener
      onDeepLink: (callback: (data: { url: string }) => void) => void;

      // Remover listeners
      removeAllListeners: (channel: string) => void;
    };
  }
}

export {};
