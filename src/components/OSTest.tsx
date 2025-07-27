import React from 'react';

import { useFullscreen } from '../hooks/useFullscreen';
import { useOperatingSystem } from '../hooks/useOperatingSystem';

export const OSTest: React.FC = () => {
  const os = useOperatingSystem();
  const isFullscreen = useFullscreen();

  const getOSIcon = () => {
    switch (os) {
      case 'windows':
        return '🪟';
      case 'macos':
        return '🍎';
      case 'linux':
        return '🐧';
      default:
        return '❓';
    }
  };

  const getOSColor = () => {
    switch (os) {
      case 'windows':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'macos':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'linux':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed top-4 left-4 bg-white p-4 rounded-lg shadow-lg border z-50 max-w-xs">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <span>{getOSIcon()}</span>
        Sistema Operativo
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">OS Detectado:</span>
          <span className={`px-2 py-1 rounded text-xs border ${getOSColor()}`}>
            {os.toUpperCase()}
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
          <span className="font-medium">Padding Aplicado:</span>
          <span className="text-xs text-gray-600">
            {isFullscreen
              ? 'Ninguno (FS)'
              : os === 'windows'
                ? 'Ninguno (Windows)'
                : os === 'macos'
                  ? 'pt-3 (macOS)'
                  : os === 'linux'
                    ? 'pt-2 (Linux)'
                    : 'pt-3 (Default)'}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-3 pt-2 border-t">
          <div>
            Electron API:{' '}
            {typeof window !== 'undefined' && window.electronAPI
              ? '✅ Disponible'
              : '❌ No disponible'}
          </div>
          <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
        </div>
      </div>
    </div>
  );
};
