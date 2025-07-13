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

export interface ElectronAPI {
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartApp: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
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

      // Listeners para eventos de actualización
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onDownloadProgress: (callback: (progress: any) => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;

      // Remover listeners
      removeAllListeners: (channel: string) => void;
    };
  }
}

export {};
