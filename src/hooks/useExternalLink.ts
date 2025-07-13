import { useCallback } from 'react';

/**
 * Hook para manejar enlaces externos de manera consistente
 * Usa la API de Electron si está disponible, sino usa window.open
 */
export const useExternalLink = () => {
  const openExternalLink = useCallback((url: string) => {
    // Usar la API de Electron si está disponible
    if (window.electronAPI?.openExternalLink) {
      return window.electronAPI.openExternalLink(url);
    } else {
      // Fallback para desarrollo o cuando no está en Electron
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve({ success: true });
    }
  }, []);

  return { openExternalLink };
};
