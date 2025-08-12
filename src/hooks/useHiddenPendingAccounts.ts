import { useCallback, useEffect, useState } from 'react';

const HIDDEN_ACCOUNTS_KEY = 'hiddenPendingAccounts';

interface HiddenAccountsData {
  [accountId: string]: {
    hiddenAt: string;
    platform: string;
  };
}

export const useHiddenPendingAccounts = () => {
  const [hiddenAccounts, setHiddenAccounts] = useState<HiddenAccountsData>({});

  // Cargar cuentas ocultas desde localStorage al inicializar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDDEN_ACCOUNTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHiddenAccounts(parsed);
        console.log(
          `📋 Loaded ${Object.keys(parsed).length} hidden pending accounts from localStorage`
        );
      }
    } catch (error) {
      console.error('Error loading hidden accounts from localStorage:', error);
    }
  }, []);

  // Ocultar una cuenta
  const hideAccount = useCallback((accountId: string, platform: string) => {
    setHiddenAccounts(prev => {
      const updated = {
        ...prev,
        [accountId]: {
          hiddenAt: new Date().toISOString(),
          platform,
        },
      };

      // Guardar en localStorage
      try {
        localStorage.setItem(HIDDEN_ACCOUNTS_KEY, JSON.stringify(updated));
        console.log(`👻 Hidden pending account: ${accountId} (${platform})`);
      } catch (error) {
        console.error('Error saving hidden accounts to localStorage:', error);
      }

      return updated;
    });
  }, []);

  // Mostrar una cuenta (remover de ocultas)
  const showAccount = useCallback((accountId: string) => {
    setHiddenAccounts(prev => {
      const { [accountId]: removed, ...rest } = prev;

      // Guardar en localStorage
      try {
        localStorage.setItem(HIDDEN_ACCOUNTS_KEY, JSON.stringify(rest));
        console.log(`👁️ Unhidden pending account: ${accountId}`);
      } catch (error) {
        console.error('Error saving hidden accounts to localStorage:', error);
      }

      return rest;
    });
  }, []);

  // Limpiar todas las cuentas ocultas
  const clearHiddenAccounts = useCallback(() => {
    setHiddenAccounts({});

    // Limpiar localStorage
    try {
      localStorage.removeItem(HIDDEN_ACCOUNTS_KEY);
      console.log('🧹 Cleared all hidden pending accounts');
    } catch (error) {
      console.error('Error clearing hidden accounts from localStorage:', error);
    }
  }, []);

  // Verificar si una cuenta está oculta
  const isAccountHidden = useCallback(
    (accountId: string) => {
      return accountId in hiddenAccounts;
    },
    [hiddenAccounts]
  );

  // Filtrar cuentas visibles
  const filterVisibleAccounts = useCallback(
    (accounts: any[]) => {
      return accounts.filter(account => !isAccountHidden(account.account_id));
    },
    [isAccountHidden]
  );

  return {
    hiddenAccounts,
    hideAccount,
    showAccount,
    clearHiddenAccounts,
    isAccountHidden,
    filterVisibleAccounts,
  };
};
