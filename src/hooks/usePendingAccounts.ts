import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { SSEService } from '../services/sseService';
import { useHiddenPendingAccounts } from './useHiddenPendingAccounts';

interface PendingAccount {
  account_id: string;
  platform: string;
  timestamp: string;
  status: 'online' | 'offline';
  current_status?: 'online' | 'offline'; // Nuevo campo para el formato simplificado
  timeDiff: number;
  filePath: string;
  pending_indicator?: string; // Para el nuevo formato [0]
}

interface PendingAccountsData {
  accounts: PendingAccount[];
  summary: {
    totalAccounts: number;
    onlineAccounts: number;
    offlineAccounts: number;
    platformStats: Record<string, { online: number; offline: number; total: number }>;
  };
  platforms: string[];
}

export const usePendingAccounts = () => {
  const { secretKey } = useAuth();
  const [pendingData, setPendingData] = useState<PendingAccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listenerIdRef = useRef<string | null>(null);
  const { hideAccount, filterVisibleAccounts } = useHiddenPendingAccounts();

  const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
  const baseUrl = import.meta.env.VITE_SERVER_URL || `http://localhost:${serverPort}`;

  const loadPendingAccounts = useCallback(async () => {
    if (!secretKey) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔍 Loading pending accounts...');

      const response = await fetch(`${baseUrl}/api/accounts/pending`, {
        method: 'GET',
        headers: {
          'x-api-key': secretKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pending accounts loaded:', data);

        // Convertir el objeto pendingAccounts a array
        const accountsArray = Object.values(data.pendingAccounts || {}).map((account: any) => ({
          account_id: account.id,
          platform: account.platform || 'Unknown',
          current_status: account.status || 'offline',
          timestamp: account.timestamp,
          ...account,
        }));

        // Filtrar cuentas ocultas antes de establecer el estado
        const visibleAccounts = filterVisibleAccounts(accountsArray);

        // Calcular estadísticas de plataforma
        const platformStats = visibleAccounts.reduce(
          (stats, account) => {
            const platform = account.platform || 'Unknown';
            if (!stats[platform]) {
              stats[platform] = { total: 0, online: 0, offline: 0 };
            }
            stats[platform].total++;
            if (account.current_status === 'online') {
              stats[platform].online++;
            } else {
              stats[platform].offline++;
            }
            return stats;
          },
          {} as Record<string, { total: number; online: number; offline: number }>
        );

        const filteredData = {
          accounts: visibleAccounts,
          summary: {
            totalAccounts: visibleAccounts.length,
            onlineAccounts: visibleAccounts.filter(a => a.current_status === 'online').length,
            offlineAccounts: visibleAccounts.filter(a => a.current_status === 'offline').length,
            platformStats,
          },
          platforms: Object.keys(platformStats),
          message: data.message,
        };

        setPendingData(filteredData);
        console.log(
          `👁️ Found ${accountsArray.length} accounts, showing ${visibleAccounts.length} (${accountsArray.length - visibleAccounts.length} hidden)`
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load pending accounts');
        console.error('❌ Failed to load pending accounts:', errorData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('❌ Error loading pending accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [secretKey, baseUrl]);

  // SSE listener para actualizaciones de pending accounts
  useEffect(() => {
    if (!secretKey) return;

    console.log('📋 Pending Accounts: Setting up SSE listener...');

    // Conectar al SSE (solo creará conexión si no existe)
    SSEService.connect(secretKey);

    const handleSSEMessage = (data: any) => {
      // Manejar initial_data que incluye pending accounts
      if (data.type === 'initial_data' && data.accounts?.pendingAccounts) {
        console.log('📨 Received initial_data with pending accounts via SSE');
        const pendingArray = data.accounts.pendingAccounts;
        if (Array.isArray(pendingArray) && pendingArray.length > 0) {
          console.log(`📊 Initial data contains ${pendingArray.length} pending accounts`);
          handleSSEMessage({
            type: 'pendingAccountsUpdate',
            accounts: pendingArray,
          });
          return;
        }
      }

      if (
        data.type === 'pendingAccountsUpdate' ||
        data.type === 'csvFileChanged' ||
        data.type === 'csv_updated'
      ) {
        console.log('📨 Received pending accounts update via SSE');

        // En lugar de recargar todo, actualizar solo los datos que han cambiado
        // pero respetando las cuentas ocultas
        if (data.accounts && Array.isArray(data.accounts)) {
          console.log('🔄 Updating pending accounts from SSE while respecting hidden accounts');

          // Filtrar cuentas ocultas de los nuevos datos
          const visibleNewAccounts = filterVisibleAccounts(data.accounts);

          // Actualizar el estado manteniendo las cuentas ocultas
          if (pendingData) {
            const updatedPendingData = {
              ...pendingData,
              accounts: visibleNewAccounts,
              summary: {
                totalAccounts: visibleNewAccounts.length,
                onlineAccounts: visibleNewAccounts.filter(acc => acc.current_status === 'online')
                  .length,
                offlineAccounts: visibleNewAccounts.filter(acc => acc.current_status === 'offline')
                  .length,
                platformStats: visibleNewAccounts.reduce(
                  (stats, account) => {
                    const platform = account.platform || 'Unknown';
                    if (!stats[platform]) {
                      stats[platform] = { total: 0, online: 0, offline: 0 };
                    }
                    stats[platform].total++;
                    if (account.current_status === 'online') {
                      stats[platform].online++;
                    } else {
                      stats[platform].offline++;
                    }
                    return stats;
                  },
                  {} as Record<string, { total: number; online: number; offline: number }>
                ),
              },
            };

            setPendingData(updatedPendingData);
            console.log(
              `👁️ SSE update: ${data.accounts.length - visibleNewAccounts.length} hidden accounts filtered`
            );
          }
        } else {
          // Si no hay datos específicos, hacer reload completo
          loadPendingAccounts();
        }
      }
    };

    // Agregar listener
    const listenerId = SSEService.addListener(handleSSEMessage);
    listenerIdRef.current = listenerId;

    return () => {
      if (listenerIdRef.current) {
        console.log('🔌 Pending Accounts: Removing SSE listener');
        SSEService.removeListener(listenerIdRef.current);
      }
    };
  }, [secretKey, loadPendingAccounts, filterVisibleAccounts, pendingData]);

  // Initial load
  useEffect(() => {
    loadPendingAccounts();
  }, [loadPendingAccounts]);

  // Removed periodic refresh - using SSE only

  const deletePendingAccount = useCallback(
    async (accountId: string) => {
      if (!secretKey) {
        throw new Error('Authentication required');
      }

      try {
        console.log(`🗑️ Hiding pending account: ${accountId}`);

        // Encontrar la cuenta para obtener su plataforma
        const accountToHide = pendingData?.accounts.find(
          account => account.account_id === accountId
        );

        if (!accountToHide) {
          throw new Error('Account not found');
        }

        // Ocultar la cuenta usando el sistema de persistencia
        hideAccount(accountId, accountToHide.platform);

        // Actualizar el estado local inmediatamente
        if (pendingData && pendingData.accounts) {
          const updatedAccounts = pendingData.accounts.filter(
            account => account.account_id !== accountId
          );

          const updatedPendingData = {
            ...pendingData,
            accounts: updatedAccounts,
            summary: {
              ...pendingData.summary,
              totalAccounts: updatedAccounts.length,
              onlineAccounts: updatedAccounts.filter(acc => acc.current_status === 'online').length,
              offlineAccounts: updatedAccounts.filter(acc => acc.current_status === 'offline')
                .length,
              platformStats: updatedAccounts.reduce(
                (stats, account) => {
                  const platform = account.platform || 'Unknown';
                  if (!stats[platform]) {
                    stats[platform] = { total: 0, online: 0, offline: 0 };
                  }
                  stats[platform].total++;
                  if (account.current_status === 'online') {
                    stats[platform].online++;
                  } else {
                    stats[platform].offline++;
                  }
                  return stats;
                },
                {} as Record<string, { total: number; online: number; offline: number }>
              ),
            },
          };

          setPendingData(updatedPendingData);
          console.log('✅ Pending account hidden and removed from view');

          return {
            success: true,
            message: 'Pending account hidden from view',
            accountId,
            status: 'hidden',
          };
        } else {
          throw new Error('No pending data available');
        }
      } catch (error) {
        console.error('❌ Error hiding pending account:', error);
        throw error;
      }
    },
    [secretKey, pendingData, hideAccount]
  );

  return {
    pendingData,
    loading,
    error,
    refresh: loadPendingAccounts,
    deletePendingAccount,
  };
};
