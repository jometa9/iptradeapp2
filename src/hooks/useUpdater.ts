import { useCallback, useEffect, useState } from 'react';

import type { DownloadProgress, UpdateInfo } from '../types/electron';

interface UpdaterState {
  isUpdateAvailable: boolean;
  isDownloading: boolean;
  isUpdateReady: boolean;
  downloadProgress: number;
  downloadSpeed?: number;
  downloadTransferred?: number;
  downloadTotal?: number;
  updateInfo: UpdateInfo | null;
  currentVersion: string | null;
  error: string | null;
}

export const useUpdater = () => {
  const [state, setState] = useState<UpdaterState>({
    isUpdateAvailable: false,
    isDownloading: false,
    isUpdateReady: false,
    downloadProgress: 0,
    updateInfo: null,
    currentVersion: null,
    error: null,
  });

  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  const isProduction = isElectron && !window.location.hostname.includes('localhost');

  const checkForUpdates = useCallback(async () => {
    if (!isElectron || !isProduction) return;

    try {
      setState(prev => ({ ...prev, error: null }));
      await window.electronAPI?.checkForUpdates();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Error checking for updates',
      }));
    }
  }, [isElectron, isProduction]);

  const downloadUpdate = useCallback(async () => {
    if (!isElectron || !isProduction) return;

    try {
      setState(prev => ({ ...prev, error: null, isDownloading: true }));
      await window.electronAPI?.downloadUpdate();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Error downloading update',
        isDownloading: false,
      }));
    }
  }, [isElectron, isProduction]);

  const restartApp = useCallback(async () => {
    if (!isElectron || !isProduction) return;

    try {
      await window.electronAPI?.restartApp();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Error restarting app',
      }));
    }
  }, [isElectron, isProduction]);

  const getCurrentVersion = useCallback(async () => {
    if (!isElectron) return;

    try {
      const version = await window.electronAPI?.getAppVersion();
      setState(prev => ({ ...prev, currentVersion: version ?? null }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Error getting app version',
      }));
    }
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron) return;

    getCurrentVersion();

    if (!isProduction) return;

    window.electronAPI?.onUpdateAvailable((info: UpdateInfo) => {
      setState(prev => ({
        ...prev,
        isUpdateAvailable: true,
        updateInfo: info,
        isDownloading: false,
      }));
    });

    window.electronAPI?.onDownloadProgress((progress: DownloadProgress) => {
      setState(prev => ({
        ...prev,
        downloadProgress: progress.percent,
        downloadSpeed: progress.bytesPerSecond,
        downloadTransferred: progress.transferred,
        downloadTotal: progress.total,
      }));
    });

    window.electronAPI?.onUpdateDownloaded((info: UpdateInfo) => {
      setState(prev => ({
        ...prev,
        isDownloading: false,
        isUpdateReady: true,
        downloadProgress: 100,
        updateInfo: info,
      }));
    });

    return () => {
      window.electronAPI?.removeAllListeners('update-available');
      window.electronAPI?.removeAllListeners('download-progress');
      window.electronAPI?.removeAllListeners('update-downloaded');
    };
  }, [isElectron, isProduction, getCurrentVersion]);

  return {
    ...state,
    isElectron,
    isProduction,
    checkForUpdates,
    downloadUpdate,
    restartApp,
    getCurrentVersion,
  };
};
