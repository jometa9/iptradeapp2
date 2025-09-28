import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import csvFrontendService from '../services/csvFrontendService';
import { SSEService } from '../services/sseService';

// Utility function for deep comparison
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  
  return true;
};

// Unified interfaces
interface PendingAccount {
  account_id: string;
  platform: string;
  status: string;
  current_status: string;
  timestamp: number;
  timeDifference: number;
  filePath: string;
  lastActivity: string;
}

interface ConfiguredAccounts {
  masterAccounts: Record<string, unknown>;
  slaveAccounts: Record<string, unknown>;
  unconnectedSlaves: Array<unknown>;
}

interface CopierStatus {
  globalStatus: boolean;
  globalStatusText: string;
  masterAccounts: Record<string, unknown>;
  totalMasterAccounts: number;
}

interface ServerStats {
  totalCSVFiles: number;
  totalPendingAccounts: number;
  totalOnlineAccounts: number;
  totalOfflineAccounts: number;
  totalMasterAccounts: number;
  totalSlaveAccounts: number;
  totalConnectedSlaves: number;
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
  const lastDataRef = useRef<UnifiedAccountData | null>(null);
  
  // Log to track hook instances

  // Configure API key in service
  useEffect(() => {
    if (secretKey) {
      csvFrontendService.setApiKey(secretKey);
    }
  }, [secretKey]);

  // Función para verificar el estado de todas las cuentas
  const getAccountsGlobalState = useCallback((configuredAccounts: any) => {
    if (!configuredAccounts) return { allEnabled: false, allDisabled: false, hasAccounts: false };

    // Recopilar todas las cuentas (masters y slaves)
    const allAccounts: any[] = [];
    
    // Agregar masters
    const masterAccountIds = Object.keys(configuredAccounts.masterAccounts || {});
    masterAccountIds.forEach(masterId => {
      const masterAccount = configuredAccounts.masterAccounts[masterId];
      if (masterAccount) {
        allAccounts.push(masterAccount);
      }
    });

    // Agregar slaves conectados
    Object.values(configuredAccounts.masterAccounts || {}).forEach((master: any) => {
      if (master?.connectedSlaves) {
        allAccounts.push(...master.connectedSlaves);
      }
    });

    // Agregar slaves desconectados que estén configurados
    const unconnectedSlaves = configuredAccounts.unconnectedSlaves || [];
    const configuredUnconnectedSlaves = unconnectedSlaves.filter((slave: any) => 
      slave?.config && Object.keys(slave.config).length > 0
    );
    allAccounts.push(...configuredUnconnectedSlaves);

    // Si no hay cuentas configuradas, no cambiar nada
    if (allAccounts.length === 0) return { allEnabled: false, allDisabled: false, hasAccounts: false };

    // Verificar estados
    const enabledAccounts = allAccounts.filter(account => account?.config?.enabled === true);
    const disabledAccounts = allAccounts.filter(account => account?.config?.enabled === false);

    const allEnabled = enabledAccounts.length === allAccounts.length;
    const allDisabled = disabledAccounts.length === allAccounts.length;

    return { allEnabled, allDisabled, hasAccounts: true, totalAccounts: allAccounts.length };
  }, []);

  const processUnifiedData = useCallback((rawData: { data?: any }): UnifiedAccountData => {
    const pendingAccounts = (rawData.data as any)?.pendingAccounts || [];
    const configuredAccounts = (rawData.data as any)?.configuredAccounts || {
      masterAccounts: {},
      slaveAccounts: {},
      unconnectedSlaves: [],
    };
    let copierStatus = (rawData.data as any)?.copierStatus || {
      globalStatus: false,
      globalStatusText: 'OFF',
      masterAccounts: {},
      totalMasterAccounts: 0,
    };
    
    // Aplicar lógica automática del global status
    const accountsState = getAccountsGlobalState(configuredAccounts);
    if (accountsState.hasAccounts) {
      let shouldUpdateGlobalStatus = false;
      let newGlobalStatus = copierStatus.globalStatus;
      
      // Activar automáticamente si todas las cuentas están habilitadas
      if (accountsState.allEnabled && !copierStatus.globalStatus) {
        console.log('🔄 Auto-enabling global copier status: all accounts are enabled');
        newGlobalStatus = true;
        shouldUpdateGlobalStatus = true;
      }
      
      // Desactivar automáticamente si todas las cuentas están deshabilitadas
      if (accountsState.allDisabled && copierStatus.globalStatus) {
        console.log('🔄 Auto-disabling global copier status: all accounts are disabled');
        newGlobalStatus = false;
        shouldUpdateGlobalStatus = true;
      }
      
      if (shouldUpdateGlobalStatus) {
        // Actualizar el servidor de forma asíncrona sin bloquear el procesamiento
        csvFrontendService.updateGlobalStatus(newGlobalStatus).catch(error => {
          console.error('❌ Error auto-updating global status:', error);
        });
        
        // Actualizar el estado local inmediatamente
        copierStatus = {
          ...copierStatus,
          globalStatus: newGlobalStatus,
          globalStatusText: newGlobalStatus ? 'ON' : 'OFF',
        };
      }
    }
    
    const serverStats = (rawData.data as any)?.serverStats || {
      totalCSVFiles: 0,
      totalPendingAccounts: 0,
      totalOnlineAccounts: 0,
      totalOfflineAccounts: 0,
      totalMasterAccounts: 0,
      totalSlaveAccounts: 0,
      totalUnconnectedSlaves: 0,
    };

    // Compute platform stats for compatibility
    const platformStats = pendingAccounts.reduce(
      (stats: Record<string, { total: number }>, account: PendingAccount) => {
        const platform = account.platform || 'Unknown';
        if (!stats[platform]) {
          stats[platform] = { total: 0 };
        }
        stats[platform].total++;
        return stats;
      },
      {}
    );

    const pendingData = {
      accounts: pendingAccounts,
      summary: {
        totalAccounts: pendingAccounts.length,
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
  }, [getAccountsGlobalState]);

  const loadUnifiedData = useCallback(async () => {
    console.log('🔄 loadUnifiedData called');
    if (!secretKey) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔄 loadUnifiedData - fetching data...');
      const rawData = await csvFrontendService.getUnifiedAccountData();
      console.log('🔄 loadUnifiedData - data received:', rawData);
      
      const processedData = processUnifiedData(rawData);
      console.log('🔄 loadUnifiedData - processed data:', processedData);
      
      // Only update state if data has actually changed
      if (!deepEqual(processedData, lastDataRef.current)) {
        setData(processedData);
        lastDataRef.current = processedData;
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [secretKey, processUnifiedData]);

  // SSE listener for real-time updates
  useEffect(() => {
    if (!secretKey) return;

    // Connect to SSE
    SSEService.connect(secretKey);

    const handleSSEMessage = (eventData: { type: string }) => {
      // Handle various SSE events that should trigger data refresh
      if (
        eventData.type === 'initial_data' ||
        eventData.type === 'csvFileChanged' ||
        eventData.type === 'csv_updated' ||
        eventData.type === 'accountConverted' ||
        eventData.type === 'accountDeleted' ||
        eventData.type === 'pendingAccountsUpdate'
      ) {
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

  // Polling removed - data updates only via SSE events and manual refresh

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
