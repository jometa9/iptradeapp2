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
      await loadData(); // Recargar datos
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

  // Cargar datos iniciales
  useEffect(() => {
    if (secretKey) {
      loadData();
    }
  }, [secretKey]);

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
      console.log('Heartbeat received:', data);
      // La conexión está viva
    };

    const handleAccountDeleted = (data: any) => {
      console.log('Account deleted event received:', data);
      // Forzar actualización de datos cuando se elimina una cuenta
      if (data.type === 'accountDeleted') {
        console.log(
          `🔄 Account ${data.accountId} (${data.accountType}) was deleted, refreshing data...`
        );
        // Forzar recarga inmediata de datos
        loadData();
      }
    };

    const handleAccountConverted = (data: any) => {
      console.log('Account converted event received:', data);
      // Forzar actualización de datos cuando se convierte una cuenta
      if (data.type === 'accountConverted') {
        console.log(
          `🔄 Account ${data.accountId} was converted to ${data.newType}, refreshing data...`
        );
        // Forzar recarga inmediata de datos
        loadData();
      }
    };

    // Escuchar eventos específicos
    csvFrontendService.on('initialData', handleInitialData);
    csvFrontendService.on('csvUpdated', handleCSVUpdate);
    csvFrontendService.on('heartbeat', handleHeartbeat);
    csvFrontendService.on('accountDeleted', handleAccountDeleted);
    csvFrontendService.on('accountConverted', handleAccountConverted);

    // Cleanup
    return () => {
      csvFrontendService.disconnect();
    };
  }, []);

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
