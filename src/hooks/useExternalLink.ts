import { useCallback } from 'react';

/**
 * Hook para abrir enlaces externos en el navegador predeterminado del sistema
 */
export const useExternalLink = () => {
  const openExternalLink = useCallback(async (url: string) => {
    try {
      // Usar la función global de Neutralino
      if (typeof window.openExternal === 'function') {
        console.log('Opening URL in default browser:', url);
        const result = await window.openExternal(url);
        if (!result) {
          throw new Error('Failed to open with system browser');
        }
        return true;
      }

      // Fallback para desarrollo local
      console.log('Fallback: Opening URL with window.open:', url);
      window.open(url, '_system');
      return true;
    } catch (error) {
      console.error('Failed to open external link:', error);
      return false;
    }
  }, []);

  return { openExternalLink };
};