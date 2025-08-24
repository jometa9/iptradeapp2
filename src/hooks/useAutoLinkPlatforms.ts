import { useEffect, useRef } from 'react';

import { useCSVData } from './useCSVData';
import { useHiddenPendingAccounts } from './useHiddenPendingAccounts';
import { useLinkPlatforms } from './useLinkPlatforms';

export const useAutoLinkPlatforms = () => {
  const { linkPlatforms } = useLinkPlatforms();
  const { accounts } = useCSVData();
  const { clearHiddenAccounts } = useHiddenPendingAccounts();
  const hasExecutedOnStartup = useRef(false);

  useEffect(() => {
    // Solo ejecutar una vez al inicio cuando las cuentas estén disponibles
    if (accounts && !hasExecutedOnStartup.current) {
      hasExecutedOnStartup.current = true;

      // Ejecutar link platforms al inicio de la app
      linkPlatforms().catch(error => {
        // Silent error handling
      });
    }
  }, [accounts, linkPlatforms]);
};
