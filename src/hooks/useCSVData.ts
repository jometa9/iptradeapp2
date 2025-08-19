import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import csvFrontendService from '../services/csvFrontendService';

interface UseCSVDataReturn {
  copierStatus: any;
  accounts: any;
  slaveConfigs: Record<string, any>;
  loading: boolean;
  error: string | null;
  updateGlobalStatus: (enabled: boolean) => Promise<void>;
  updateMasterStatus: (masterId: string, enabled: boolean) => Promise<void>;
  updateSlaveConfig: (slaveId: string, enabled: boolean) => Promise<void>;
  emergencyShutdown: () => Promise<void>;
  resetAllToOn: () => Promise<void>;
  scanCSVFiles: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCSVData = (): UseCSVDataReturn => {
  const [copierStatus, setCopierStatus] = useState<any>(null);
  const [accounts, setAccounts] = useState<any>(null);
  const [slaveConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { secretKey } = useAuth();

  // Configurar API key en el servicio
  useEffect(() => {
    if (secretKey) {
      csvFrontendService.setApiKey(secretKey);
    }
  }, [secretKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos en paralelo
      const [copierData, accountsData] = await Promise.all([
        csvFrontendService.getCopierStatus(),
        csvFrontendService.getAllAccounts(),
      ]);

      setCopierStatus(copierData);
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const updateGlobalStatus = async (enabled: boolean) => {
    try {
      await csvFrontendService.updateGlobalStatus(enabled);
      // No necesitamos loadData() aquí porque los eventos del servicio actualizarán los datos
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating global status');
    }
  };

  const updateMasterStatus = async (masterId: string, enabled: boolean) => {
    try {
      await csvFrontendService.updateMasterStatus(masterId, enabled);
      await loadData(); // Recargar datos
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating master status');
    }
  };

  const updateSlaveConfig = async (slaveId: string, enabled: boolean) => {
    try {
      await csvFrontendService.updateSlaveConfig(slaveId, enabled);
      await loadData(); // Recargar datos
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating slave config');
    }
  };

  const emergencyShutdown = async () => {
    try {
      await csvFrontendService.emergencyShutdown();
      await loadData(); // Recargar datos
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error executing emergency shutdown');
    }
  };

  const resetAllToOn = async () => {
    try {
      await csvFrontendService.resetAllToOn();
      await loadData(); // Recargar datos
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error resetting all to ON');
    }
  };

  const scanCSVFiles = async () => {
    try {
      // Solo refrescar datos existentes, no hacer búsqueda completa
      await csvFrontendService.refreshCSVData();
      await loadData(); // Recargar datos
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error refreshing CSV data');
    }
  };

  const refresh = async () => {
    await loadData();
  };

  // Cargar datos iniciales y sincronizar estado global
  useEffect(() => {
    if (secretKey) {
      const loadInitialData = async () => {
        try {
          setLoading(true);
          // Cargar datos iniciales
          const [copierData, accountsData] = await Promise.all([
            csvFrontendService.getCopierStatus(),
            csvFrontendService.getAllAccounts(),
          ]);

          console.log('📊 Initial copier status:', copierData);

          // Actualizar estados
          setCopierStatus(copierData);
          setAccounts(accountsData);
        } catch (err) {
          console.error('❌ Error loading initial data:', err);
          setError(err instanceof Error ? err.message : 'Error loading initial data');
        } finally {
          setLoading(false);
        }
      };

      loadInitialData();
    }
  }, [secretKey]);

  // Polling fallback para asegurar actualizaciones rápidas
  useEffect(() => {
    if (!secretKey) return;

    console.log('⏰ Setting up polling fallback for CSV data (every 1 second)');

    const pollingInterval = setInterval(() => {
      console.log('⏰ [POLLING] Checking for CSV updates...');
      loadData();
    }, 1000); // Cada 1 segundo

    return () => {
      console.log('⏰ Clearing CSV polling fallback');
      clearInterval(pollingInterval);
    };
  }, [secretKey, loadData]);

  useEffect(() => {
    // Configurar listeners para actualizaciones en tiempo real
    const handleInitialData = (data: any) => {
      console.log('Initial data received:', data);
      if (data.copierStatus) {
        setCopierStatus(data.copierStatus);
      }
      if (data.accounts) {
        setAccounts(data.accounts);
      }
      setLoading(false);
    };

    const handleCSVUpdate = (data: any) => {
      console.log('CSV file updated:', data);
      // Actualizar directamente con los datos recibidos
      if (data.copierStatus) {
        setCopierStatus(data.copierStatus);
      }
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    };

    const handleHeartbeat = (data: any) => {
      if (data.changes) {
        console.log('Heartbeat with changes:', data.changes);
        loadData(); // Recargar datos si hay cambios
      }
    };

    const handleAccountDeleted = (data: any) => {
      console.log('Account deleted:', data);
      loadData(); // Recargar datos
    };

    const handleAccountConverted = (data: any) => {
      console.log('Account converted:', data);
      loadData(); // Recargar datos
    };

    // Escuchar eventos específicos del servicio
    csvFrontendService.on('initialData', handleInitialData);
    csvFrontendService.on('csvUpdated', handleCSVUpdate);
    csvFrontendService.on('heartbeat', handleHeartbeat);
    csvFrontendService.on('accountDeleted', handleAccountDeleted);
    csvFrontendService.on('accountConverted', handleAccountConverted);

    // Escuchar eventos DOM para sincronización entre componentes
    const handleCSVDataUpdated = (event: any) => {
      console.log('CSV data updated event:', event);
      if (event.detail) {
        if (event.detail.copierStatus) {
          setCopierStatus(event.detail.copierStatus);
        }
        if (event.detail.accounts) {
          setAccounts(event.detail.accounts);
        }
      } else {
        loadData(); // Si no hay detalles, recargar todo
      }
    };

    window.addEventListener('csvDataUpdated', handleCSVDataUpdated);

    // Cleanup
    return () => {
      csvFrontendService.disconnect();
      window.removeEventListener('csvDataUpdated', handleCSVDataUpdated);
    };
  }, [loadData]); // Incluir loadData en las dependencias

  return {
    copierStatus,
    accounts,
    slaveConfigs,
    loading,
    error,
    updateGlobalStatus,
    updateMasterStatus,
    updateSlaveConfig,
    emergencyShutdown,
    resetAllToOn,
    scanCSVFiles,
    refresh,
  };
};
