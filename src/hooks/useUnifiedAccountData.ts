import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import csvFrontendService from '../services/csvFrontendService';
import { SSEService } from '../services/sseService';

// Unified interfaces
interface PendingAccount {
  account_id: string;
  platform: string;
  status: 'online' | 'offline';
  current_status: 'online' | 'offline';
  timestamp: number;
  timeDifference: number;
  filePath: string;
  lastActivity: string;
}

interface ConfiguredAccounts {
  masterAccounts: Record<string, any>;
  slaveAccounts: Record<string, any>;
  unconnectedSlaves: Array<any>;
}

interface CopierStatus {
  globalStatus: boolean;
  globalStatusText: string;
  masterAccounts: Record<string, any>;
  totalMasterAccounts: number;
}

interface ServerStats {
  totalCSVFiles: number;
  totalPendingAccounts: number;
  onlinePendingAccounts: number;
  offlinePendingAccounts: number;
  totalMasterAccounts: number;
  totalSlaveAccounts: number;
  totalUnconnectedSlaves: number;
}

interface UnifiedAccountData {
  pendingAccounts: PendingAccount[];
  configuredAccounts: ConfiguredAccounts;
  copierStatus: CopierStatus;
  serverStats: ServerStats;
  
  // Computed data for compatibility
  pendingData: {
    accounts: PendingAccount[];
    summary: {
      totalAccounts: number;
      onlineAccounts: number;
      offlineAccounts: number;
      platformStats: Record<string, { online: number; offline: number; total: number }>;
    };
    platforms: string[];
  };
}

interface UnifiedAccountDataReturn {
  data: UnifiedAccountData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  
  // Action methods
  updateGlobalStatus: (enabled: boolean) => Promise<void>;
  updateMasterStatus: (masterId: string, enabled: boolean) => Promise<void>;
  updateSlaveConfig: (slaveId: string, enabled: boolean) => Promise<void>;
  updateAccountStatus: (accountId: string, enabled: boolean) => Promise<void>;
  emergencyShutdown: () => Promise<void>;
  resetAllToOn: () => Promise<void>;
  deletePendingAccount: (accountId: string) => Promise<any>;
  convertToPending: (accountId: string) => Promise<boolean>;
  deleteMasterAccount: (masterAccountId: string) => Promise<boolean>;
}

export const useUnifiedAccountData = (): UnifiedAccountDataReturn => {
  const { secretKey } = useAuth();
  const [data, setData] = useState<UnifiedAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listenerIdRef = useRef<string | null>(null);
  
  // Log to track hook instances
  console.log('🔧 [useUnifiedAccountData] Hook instance created/updated');

  // Configure API key in service
  useEffect(() => {
    if (secretKey) {
      csvFrontendService.setApiKey(secretKey);
    }
  }, [secretKey]);

  const processUnifiedData = useCallback((rawData: any): UnifiedAccountData => {
    const pendingAccounts = rawData.data?.pendingAccounts || [];
    const configuredAccounts = rawData.data?.configuredAccounts || {
      masterAccounts: {},
      slaveAccounts: {},
      unconnectedSlaves: [],
    };
    const copierStatus = rawData.data?.copierStatus || {
      globalStatus: false,
      globalStatusText: 'OFF',
      masterAccounts: {},
      totalMasterAccounts: 0,
    };
    const serverStats = rawData.data?.serverStats || {
      totalCSVFiles: 0,
      totalPendingAccounts: 0,
      onlinePendingAccounts: 0,
      offlinePendingAccounts: 0,
      totalMasterAccounts: 0,
      totalSlaveAccounts: 0,
      totalUnconnectedSlaves: 0,
    };

    // Compute platform stats for compatibility
    const platformStats = pendingAccounts.reduce(
      (stats: Record<string, { online: number; offline: number; total: number }>, account: PendingAccount) => {
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
      {}
    );

    const pendingData = {
      accounts: pendingAccounts,
      summary: {
        totalAccounts: pendingAccounts.length,
        onlineAccounts: pendingAccounts.filter((a: PendingAccount) => a.current_status === 'online').length,
        offlineAccounts: pendingAccounts.filter((a: PendingAccount) => a.current_status === 'offline').length,
        platformStats,
      },
      platforms: Object.keys(platformStats),
    };

    return {
      pendingAccounts,
      configuredAccounts,
      copierStatus,
      serverStats,
      pendingData,
    };
  }, []);

  const loadUnifiedData = useCallback(async () => {
    if (!secretKey) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔄 [useUnifiedAccountData] Loading unified data...');
      
      const startTime = Date.now();
      const rawData = await csvFrontendService.getUnifiedAccountData();
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ [useUnifiedAccountData] Data loaded in ${processingTime}ms`);
      console.log(`📊 [useUnifiedAccountData] Server processing: ${rawData.processingTimeMs}ms`);
      
      const processedData = processUnifiedData(rawData);
      setData(processedData);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [useUnifiedAccountData] Error loading data:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [secretKey]); // Removed processUnifiedData dependency

  // SSE listener for real-time updates
  useEffect(() => {
    if (!secretKey) return;

    // Connect to SSE
    SSEService.connect(secretKey);

    const handleSSEMessage = (eventData: any) => {
      // Handle various SSE events that should trigger data refresh
      if (
        eventData.type === 'initial_data' ||
        eventData.type === 'csvFileChanged' ||
        eventData.type === 'csv_updated' ||
        eventData.type === 'accountConverted' ||
        eventData.type === 'accountDeleted' ||
        eventData.type === 'pendingAccountsUpdate'
      ) {
        console.log(`🔄 [useUnifiedAccountData] SSE event received: ${eventData.type}`);
        // Refresh data when important events occur
        loadUnifiedData();
      }
    };

    // Add SSE listener
    const listenerId = SSEService.addListener(handleSSEMessage);
    listenerIdRef.current = listenerId;

    return () => {
      if (listenerIdRef.current) {
        SSEService.removeListener(listenerIdRef.current);
      }
    };
  }, [secretKey, loadUnifiedData]);

  // Initial data load
  useEffect(() => {
    if (secretKey) {
      loadUnifiedData();
    }
  }, [secretKey, loadUnifiedData]);

  // Polling every second for real-time updates
  useEffect(() => {
    if (!secretKey) return;

    const pollingInterval = setInterval(() => {
      loadUnifiedData();
    }, 1000); // Every 1 second for real-time updates

    return () => {
      clearInterval(pollingInterval);
    };
  }, [secretKey, loadUnifiedData]);

  // Action methods
  const updateGlobalStatus = useCallback(async (enabled: boolean) => {
    try {
      await csvFrontendService.updateGlobalStatus(enabled);
      // Refresh data after action
      await loadUnifiedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating global status');
      throw err;
    }
  }, [loadUnifiedData]);

  const updateMasterStatus = useCallback(async (masterId: string, enabled: boolean) => {
    try {
      await csvFrontendService.updateMasterStatus(masterId, enabled);
      await loadUnifiedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating master status');
      throw err;
    }
  }, [loadUnifiedData]);

  const updateSlaveConfig = useCallback(async (slaveId: string, enabled: boolean) => {
    try {
      await csvFrontendService.updateSlaveConfig(slaveId, enabled);
      await loadUnifiedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating slave config');
      throw err;
    }
  }, [loadUnifiedData]);

  const updateAccountStatus = useCallback(async (accountId: string, enabled: boolean) => {
    try {
      await csvFrontendService.updateAccountStatus(accountId, enabled);
      await loadUnifiedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating account status');
      throw err;
    }
  }, [loadUnifiedData]);

  const emergencyShutdown = useCallback(async () => {
    try {
      await csvFrontendService.emergencyShutdown();
      await loadUnifiedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error executing emergency shutdown');
      throw err;
    }
  }, [loadUnifiedData]);

  const resetAllToOn = useCallback(async () => {
    try {
      await csvFrontendService.resetAllToOn();
      await loadUnifiedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error resetting all to ON');
      throw err;
    }
  }, [loadUnifiedData]);

  const deletePendingAccount = useCallback(async (accountId: string) => {
    try {
      // Update local state immediately for better UX
      if (data && data.pendingAccounts) {
        const updatedPendingAccounts = data.pendingAccounts.filter(
          account => account.account_id !== accountId
        );
        
        const updatedData = {
          ...data,
          pendingAccounts: updatedPendingAccounts,
          pendingData: {
            ...data.pendingData,
            accounts: updatedPendingAccounts,
            summary: {
              ...data.pendingData.summary,
              totalAccounts: updatedPendingAccounts.length,
              onlineAccounts: updatedPendingAccounts.filter(acc => acc.current_status === 'online').length,
              offlineAccounts: updatedPendingAccounts.filter(acc => acc.current_status === 'offline').length,
            },
          },
        };
        
        setData(updatedData);
      }

      return {
        success: true,
        message: 'Pending account hidden from view',
        accountId,
        status: 'hidden',
      };
    } catch (error) {
      throw error;
    }
  }, [data]);

  const convertToPending = useCallback(async (accountId: string) => {
    try {
      const result = await csvFrontendService.convertToPending(accountId);
      if (result) {
        await loadUnifiedData();
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error converting to pending');
      throw err;
    }
  }, [loadUnifiedData]);

  const deleteMasterAccount = useCallback(async (masterAccountId: string) => {
    try {
      const result = await csvFrontendService.deleteMasterAccount(masterAccountId);
      if (result) {
        await loadUnifiedData();
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting master account');
      throw err;
    }
  }, [loadUnifiedData]);

  return {
    data,
    loading,
    error,
    refresh: loadUnifiedData,
    updateGlobalStatus,
    updateMasterStatus,
    updateSlaveConfig,
    updateAccountStatus,
    emergencyShutdown,
    resetAllToOn,
    deletePendingAccount,
    convertToPending,
    deleteMasterAccount,
  };
};
