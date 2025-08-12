import { useEffect, useRef } from 'react';

import { useCSVData } from './useCSVData';
import { useHiddenPendingAccounts } from './useHiddenPendingAccounts';
import { useLinkPlatforms } from './useLinkPlatforms';

export const useAutoLinkPlatforms = () => {
  const { linkPlatforms } = useLinkPlatforms();
  const { accounts } = useCSVData();
  const { clearHiddenAccounts } = useHiddenPendingAccounts();
  const previousAccountsRef = useRef<any>(null);
  const isInitialMount = useRef(true);
  const hasExecutedOnce = useRef(false);

  const hasAccountChanged = (current: any, previous: any): boolean => {
    const fieldsToCompare = ['accountNumber', 'platform', 'server', 'accountType', 'status'];

    for (const field of fieldsToCompare) {
      if (current[field] !== previous[field]) {
        return true;
      }
    }

    return false;
  };

  const detectAccountChanges = (currentAccounts: any, previousAccounts: any): boolean => {
    if (!previousAccounts || !currentAccounts) return false;

    // Comparar el número total de cuentas (masterAccounts es un objeto, no array)
    const currentCount = Object.keys(currentAccounts.masterAccounts || {}).length;
    const previousCount = Object.keys(previousAccounts.masterAccounts || {}).length;

    if (currentCount !== previousCount) {
      console.log(`📊 Account count changed: ${previousCount} -> ${currentCount}`);
      return true;
    }

    // Comparar cuentas individuales por ID (usar Object.keys para objetos)
    const currentMasterIds = new Set(Object.keys(currentAccounts.masterAccounts || {}));
    const previousMasterIds = new Set(Object.keys(previousAccounts.masterAccounts || {}));

    // Verificar si se agregaron o eliminaron cuentas
    for (const id of currentMasterIds) {
      if (!previousMasterIds.has(id)) {
        console.log(`➕ New account detected: ${id}`);
        return true;
      }
    }

    for (const id of previousMasterIds) {
      if (!currentMasterIds.has(id)) {
        console.log(`➖ Account removed: ${id}`);
        return true;
      }
    }

    // Comparar cambios en las propiedades de las cuentas
    for (const accountId of Object.keys(currentAccounts.masterAccounts || {})) {
      const currentAccount = currentAccounts.masterAccounts[accountId];
      const previousAccount = previousAccounts.masterAccounts?.[accountId];

      if (previousAccount && hasAccountChanged(currentAccount, previousAccount)) {
        console.log(`✏️ Account modified: ${accountId}`);
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    // No ejecutar en el montaje inicial
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousAccountsRef.current = accounts;
      return;
    }

    // Solo ejecutar si hay cambios en las cuentas
    if (accounts && previousAccountsRef.current !== accounts) {
      const previousAccounts = previousAccountsRef.current;

      // Detectar si se agregaron, editaron o eliminaron cuentas
      const hasChanges = detectAccountChanges(accounts, previousAccounts);

      if (hasChanges) {
        // Solo ejecutar si ya se ejecutó al menos una vez (evitar ejecutar al inicio)
        if (hasExecutedOnce.current) {
          console.log('🔄 Account changes detected, executing Link Platforms...');

          // REMOVIDO: Ya no limpiamos las cuentas ocultas automáticamente
          // console.log('🧹 Clearing hidden accounts due to auto Link Platforms execution');
          // clearHiddenAccounts();

          linkPlatforms().catch(error => {
            console.error('Auto Link Platforms failed:', error);
          });
        } else {
          console.log(
            '🔄 Account changes detected, but skipping first execution (server handles it)'
          );
          hasExecutedOnce.current = true;
        }
      }

      previousAccountsRef.current = accounts;
    }
  }, [accounts, linkPlatforms]);
};
