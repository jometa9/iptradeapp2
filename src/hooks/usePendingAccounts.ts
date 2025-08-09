import { useCallback, useEffect, useState, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { SSEService } from '../services/sseService';

interface PendingAccount {
  account_id: string;
  platform: string;
  timestamp: string;
  status: 'online' | 'offline';
  timeDiff: number;
  filePath: string;
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

  const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  const loadPendingAccounts = useCallback(async () => {
    if (!secretKey) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔍 Loading pending accounts...');

      const response = await fetch(`${baseUrl}/api/csv/scan-pending`, {
        method: 'GET',
        headers: {
          'x-api-key': secretKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pending accounts loaded:', data.summary);
        setPendingData(data);
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
      if (data.type === 'pendingAccountsUpdate' || data.type === 'csvFileChanged') {
        console.log('📨 Received pending accounts update via SSE');
        loadPendingAccounts();
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
  }, [secretKey, loadPendingAccounts]);

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
        console.log(`🗑️ Deleting pending account: ${accountId}`);

        const response = await fetch(`${baseUrl}/api/csv/pending/${accountId}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': secretKey,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Pending account deleted:', data);
          // Refresh the data immediately
          await loadPendingAccounts();
          return data;
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete pending account');
        }
      } catch (error) {
        console.error('❌ Error deleting pending account:', error);
        throw error;
      }
    },
    [secretKey, baseUrl, loadPendingAccounts]
  );

  return {
    pendingData,
    loading,
    error,
    refresh: loadPendingAccounts,
    deletePendingAccount,
  };
};
