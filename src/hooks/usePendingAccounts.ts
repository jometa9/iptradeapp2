import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

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

  const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:30';

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

  // SSE connection for real-time updates
  useEffect(() => {
    if (!secretKey) return;

    console.log('🔄 Setting up SSE for pending accounts...');
    const eventSource = new EventSource(`${baseUrl}/api/events?apiKey=${secretKey}`);

    eventSource.onopen = () => {
      console.log('🌐 SSE connected for pending accounts');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Listen for pending accounts updates
        if (data.type === 'pendingAccountsUpdate' || data.type === 'csvFileChanged') {
          console.log('🔄 Pending accounts update received via SSE');
          loadPendingAccounts();
        }
      } catch (error) {
        console.error('❌ Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
    };

    return () => {
      console.log('🔌 Closing SSE connection for pending accounts');
      eventSource.close();
    };
  }, [secretKey, baseUrl, loadPendingAccounts]);

  // Initial load
  useEffect(() => {
    loadPendingAccounts();
  }, [loadPendingAccounts]);

  // Periodic refresh every 10 seconds to check for status changes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Periodic refresh of pending accounts status');
      loadPendingAccounts();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [loadPendingAccounts]);

  return {
    pendingData,
    loading,
    error,
    refresh: loadPendingAccounts,
  };
};