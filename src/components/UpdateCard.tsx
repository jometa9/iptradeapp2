import { Progress } from '@/components/ui/progress';

import React from 'react';

import { AlertCircle, CheckCircle, Download, RefreshCw, RotateCcw } from 'lucide-react';

import { useUpdateTest } from '../context/UpdateTestContext';
import { useUpdater } from '../hooks/useUpdater';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getNextPatchVersion = (version: string): string => {
  try {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  } catch {
    return '1.0.0';
  }
};

export const UpdateCard: React.FC = () => {
  const {
    isElectron,
    isProduction,
    isUpdateAvailable,
    isDownloading,
    isUpdateReady,
    downloadProgress,
    downloadSpeed,
    downloadTransferred,
    downloadTotal,
    updateInfo,
    currentVersion,
    error,
    checkForUpdates,
    downloadUpdate,
    restartApp,
  } = useUpdater();

  const { isTestMode, testState } = useUpdateTest();

  const displayState =
    isTestMode && testState
      ? {
          isUpdateAvailable: testState.isUpdateAvailable,
          isDownloading: testState.isDownloading,
          isUpdateReady: testState.isUpdateReady,
          downloadProgress: testState.downloadProgress,
          error: testState.error,
          updateInfo: { version: testState.newVersion },
          currentVersion: testState.currentVersion,
        }
      : {
          isUpdateAvailable,
          isDownloading,
          isUpdateReady,
          downloadProgress,
          error,
          updateInfo,
          currentVersion,
        };

  const shouldShow =
    isElectron &&
    ((isTestMode && testState) || isUpdateAvailable || isDownloading || isUpdateReady || error) &&
    isProduction; // Solo mostrar en producción, excepto en test mode

  if (!shouldShow && !(isTestMode && testState)) {
    return null;
  }

  const isDemoMode = !isProduction && !isTestMode;
  const isRealTestMode = isTestMode && testState;

  if (isDemoMode) {
    displayState.isUpdateAvailable = true;
    displayState.isDownloading = false;
    displayState.isUpdateReady = false;
    displayState.error = null;
    // Usar versión actual real + incremento demo, o fallback si no hay versión
    // Esto permite que el demo sea más realista mostrando la próxima versión posible
    const baseVersion = currentVersion || '1.0.0';
    const demoNewVersion = getNextPatchVersion(baseVersion);
    displayState.updateInfo = { version: demoNewVersion };
    displayState.currentVersion = baseVersion;
  }

  const getStatusColor = () => {
    if (displayState.error) return 'bg-red-100 text-red-800 border-red-400';
    if (displayState.isUpdateReady) return 'bg-green-100 text-green-800 border-green-400';
    if (displayState.isDownloading) return 'bg-blue-100 text-blue-800 border-blue-400';
    if (displayState.isUpdateAvailable) return 'bg-yellow-100 text-yellow-800 border-yellow-400';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = () => {
    if (displayState.error) return <AlertCircle className="h-5 w-5" />;
    if (displayState.isUpdateReady) return <CheckCircle className="h-5 w-5" />;
    if (displayState.isDownloading) return <Download className="h-5 w-5 animate-pulse" />;
    if (displayState.isUpdateAvailable) return <RefreshCw className="h-5 w-5" />;
    return null;
  };

  const getStatusText = () => {
    if (displayState.error) return 'Update Error';
    if (displayState.isUpdateReady) return 'Update Ready';
    if (displayState.isDownloading) return 'Downloading Update';
    if (displayState.isUpdateAvailable) {
      if (isRealTestMode) return 'New Update Available (Test)';
      return 'New Update Available';
    }
    return '';
  };

  const getStatusDescription = () => {
    if (displayState.error) return displayState.error;
    if (displayState.isUpdateReady)
      return `Version ${displayState.updateInfo?.version} downloaded and ready to install. Restart the application to apply changes.`;
    if (displayState.isDownloading)
      return `Downloading version ${displayState.updateInfo?.version}. Please wait...`;
    if (displayState.isUpdateAvailable) {
      if (isDemoMode)
        return `New version ${displayState.updateInfo?.version} is available for download.`;
      if (isRealTestMode)
        return `Testing update available state. Version ${displayState.updateInfo?.version} ready to download.`;
      return `A new version (${displayState.updateInfo?.version}) is available. Click download to start.`;
    }
    return '';
  };

  const handleAction = (action: string) => {
    if (isRealTestMode) {
      alert(`Test: ${action} - In production this would work for real.`);
    } else {
      // En cualquier modo usar las funciones reales o simuladas
      if (action === 'restart') restartApp();
      else if (action === 'check') checkForUpdates();
      else if (action === 'download') downloadUpdate();
    }
  };

  const getButtonText = () => {
    if (isRealTestMode) return 'Test Action';
    if (displayState.isUpdateAvailable && !displayState.isDownloading) return 'Download Update';
    return 'Check for Updates';
  };

  const getPrimaryButtonStyles = () => {
    if (displayState.error) return 'bg-red-400 border-red-600 text-white';
    if (displayState.isUpdateReady) return 'bg-green-50 border-green-600 text-green-800';
    if (displayState.isDownloading) return 'bg-blue-400 border-blue-600 text-white';
    if (displayState.isUpdateAvailable) return 'bg-yellow-400 border-yellow-600 text-white';
    return 'bg-gray-400 border-gray-600 text-white';
  };

  const getSecondaryButtonStyles = () => {
    if (displayState.error) return 'border-red-500 hover:border-red-700 text-red-700 bg-red-50';
    if (displayState.isUpdateReady)
      return 'border-green-500 hover:border-green-700 text-green-700 bg-green-50 ';
    if (displayState.isDownloading)
      return 'border-blue-500 hover:border-blue-700 text-blue-700 bg-blue-50';
    if (displayState.isUpdateAvailable) return 'border-yellow-500 text-yellow-700 bg-yellow-50';
    return 'border-gray-500 text-gray-700 bg-gray-50 hover:bg-gray-50';
  };

  return (
    <Card className={`${getStatusColor()} shados-sm`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusText()}
            </CardTitle>
            <p className="text-sm opacity-90 pr-4 pt-2">{getStatusDescription()}</p>

            {(displayState.currentVersion || displayState.updateInfo?.version) && (
              <div className="flex items-center gap-2 text-xs pt-1">
                {displayState.currentVersion && (
                  <span className="opacity-70">Current: v{displayState.currentVersion}</span>
                )}
                {displayState.updateInfo?.version && (
                  <span className="font-medium">New: v{displayState.updateInfo.version}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 min-w-fit">
            {displayState.isUpdateReady && (
              <Button
                onClick={() => handleAction('restart')}
                className={`${getPrimaryButtonStyles()} flex items-center gap-2 border`}
                size="sm"
              >
                <RotateCcw className="h-4 w-4" />
                Restart Now
              </Button>
            )}

            {displayState.error && (
              <Button
                onClick={() => handleAction('check')}
                variant="outline"
                className={`${getSecondaryButtonStyles()} flex items-center gap-2 border`}
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            )}

            {displayState.isUpdateAvailable &&
              !displayState.isDownloading &&
              !displayState.isUpdateReady &&
              !displayState.error && (
                <Button
                  onClick={() => handleAction('download')}
                  variant="outline"
                  className={`${getSecondaryButtonStyles()} flex items-center gap-2 border`}
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  {getButtonText()}
                </Button>
              )}
          </div>
        </div>
      </CardHeader>

      {displayState.isDownloading && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <Progress
              value={displayState.downloadProgress}
              className="h-3 bg-blue-100 rounded-full border border-blue-400 overflow-hidden"
            />
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs opacity-70">
                <span>Download Progress</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{Math.round(displayState.downloadProgress)}%</span>
                  {isRealTestMode && (
                    <span className="text-yellow-600 font-medium">(Test Mode)</span>
                  )}
                </div>
              </div>

              {/* Información detallada solo en producción real */}
              {isProduction &&
                !isRealTestMode &&
                downloadSpeed &&
                downloadTransferred &&
                downloadTotal && (
                  <div className="flex justify-between items-center text-xs opacity-60">
                    <span>Speed: {formatBytes(downloadSpeed)}/s</span>
                    <span>
                      {formatBytes(downloadTransferred)} / {formatBytes(downloadTotal)}
                    </span>
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
