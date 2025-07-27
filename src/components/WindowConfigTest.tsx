import React from 'react';

import { useFullscreen } from '../hooks/useFullscreen';
import { useOperatingSystem } from '../hooks/useOperatingSystem';
import { useWindowConfig } from '../hooks/useWindowConfig';

export const WindowConfigTest: React.FC = () => {
  const { windowConfig, loading } = useWindowConfig();
  const isFullscreen = useFullscreen();
  const os = useOperatingSystem();

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'darwin':
        return '🍎';
      case 'win32':
        return '🪟';
      case 'linux':
        return '🐧';
      default:
        return '❓';
    }
  };

  const getPaddingInfo = () => {
    if (isFullscreen) return 'Ninguno (Fullscreen)';
    if (loading || !windowConfig) return 'Cargando...';

    if (windowConfig.hasTitleBar) {
      return 'Ninguno (Barra de título nativa)';
    }

    switch (os) {
      case 'windows':
        return 'pt-2 (Windows sin frame)';
      case 'macos':
        return 'pt-3 (macOS sin frame)';
      case 'linux':
        return 'pt-2 (Linux sin frame)';
      default:
        return 'pt-3 (Default)';
    }
  };

  if (loading) {
    return (
      <div className="fixed top-4 left-4 bg-white p-4 rounded-lg shadow-lg border z-50">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 bg-white p-4 rounded-lg shadow-lg border z-50 max-w-xs">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <span>{getPlatformIcon(windowConfig?.platform || 'unknown')}</span>
        Configuración de Ventana
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">Plataforma:</span>
          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
            {windowConfig?.platform || 'unknown'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Barra de título:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              windowConfig?.hasTitleBar ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {windowConfig?.hasTitleBar ? 'Sí' : 'No'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Frame nativo:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              windowConfig?.hasFrame ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {windowConfig?.hasFrame ? 'Sí' : 'No'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Barra de menú:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              windowConfig?.hasMenuBar ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {windowConfig?.hasMenuBar ? 'Visible' : 'Oculta'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Fullscreen:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              isFullscreen ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {isFullscreen ? 'Sí' : 'No'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Padding aplicado:</span>
          <span className="text-xs text-gray-600">{getPaddingInfo()}</span>
        </div>
        <div className="text-xs text-gray-500 mt-3 pt-2 border-t">
          <div>OS Detectado: {os.toUpperCase()}</div>
          <div>
            Electron API: {typeof window !== 'undefined' && window.electronAPI ? '✅' : '❌'}
          </div>
        </div>
      </div>
    </div>
  );
};
