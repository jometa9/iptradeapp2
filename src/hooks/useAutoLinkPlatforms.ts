import { useEffect, useRef } from 'react';

import { useUnifiedAccountDataContext } from '../context/UnifiedAccountDataContext';
// Removed useHiddenPendingAccounts - functionality moved to useUnifiedAccountData
import { useLinkPlatforms } from './useLinkPlatforms';

const AUTO_LINK_CACHE_KEY = 'iptrade_auto_link_executed';

// Variable global para indicar si el proceso se omitió por cache
let autoLinkSkippedByCache = false;

export const useAutoLinkPlatforms = () => {
  const { linkPlatforms } = useLinkPlatforms();
  const { data: unifiedData } = useUnifiedAccountDataContext();
  const accounts = unifiedData?.configuredAccounts;
  // Removed clearHiddenAccounts - functionality moved to useUnifiedAccountData
  const hasExecutedOnStartup = useRef(false);

  useEffect(() => {
    // Solo ejecutar una vez al inicio cuando las cuentas estén disponibles
    if (accounts && !hasExecutedOnStartup.current) {
      hasExecutedOnStartup.current = true;

      // Verificar si ya se ejecutó el proceso automático anteriormente
      const hasAutoLinkExecuted = localStorage.getItem(AUTO_LINK_CACHE_KEY);

      if (!hasAutoLinkExecuted) {
        // Ejecutar link platforms al inicio de la app solo si no se ha ejecutado antes
        autoLinkSkippedByCache = false;
        linkPlatforms().catch(error => {
          // Silent error handling
        });

        // Marcar como ejecutado en el cache
        localStorage.setItem(AUTO_LINK_CACHE_KEY, 'true');
      } else {
        // Marcar que se omitió por cache
        autoLinkSkippedByCache = true;
      }
    }
  }, [accounts, linkPlatforms]);

  // Función para verificar si se omitió por cache
  const wasSkippedByCache = () => {
    return autoLinkSkippedByCache;
  };

  return { wasSkippedByCache };
};

// Exportar la función para uso en otros componentes
export const getAutoLinkSkippedByCache = () => autoLinkSkippedByCache;
