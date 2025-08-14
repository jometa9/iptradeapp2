import { useToast } from '@/hooks/use-toast';
import csvUnifiedService from '@/services/csvUnifiedService';

import { useCallback, useEffect, useState } from 'react';

export interface UseCSVDataReturn {
  pendingAccounts: any[];
  masterAccounts: Record<string, any>;
  slaveAccounts: Record<string, any>;
  unconnectedSlaves: any[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  convertToMaster: (accountId: string, name?: string) => Promise<void>;
  convertToSlave: (accountId: string, masterId: string) => Promise<void>;
  updateMasterConfig: (accountId: string, config: any) => Promise<void>;
  updateSlaveConfig: (accountId: string, config: any) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
}

export function useCSVDataUnified(): UseCSVDataReturn {
  const [pendingAccounts, setPendingAccounts] = useState<any[]>([]);
  const [masterAccounts, setMasterAccounts] = useState<Record<string, any>>({});
  const [slaveAccounts, setSlaveAccounts] = useState<Record<string, any>>({});
  const [unconnectedSlaves, setUnconnectedSlaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Cargar datos iniciales
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const accounts = await csvUnifiedService.getAllAccounts();

      setMasterAccounts(accounts.masterAccounts || {});
      setSlaveAccounts(accounts.slaveAccounts || {});
      setUnconnectedSlaves(accounts.unconnectedSlaves || []);
      setPendingAccounts(accounts.pendingAccounts || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch CSV data';
      setError(errorMessage);
      console.error('Error fetching CSV data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Convertir pending a master
  const convertToMaster = useCallback(
    async (accountId: string, name?: string) => {
      try {
        await csvUnifiedService.convertToMaster(accountId, name);
        toast({
          title: 'Success',
          description: `Account ${accountId} converted to master`,
        });
        await fetchData();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to convert account';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchData, toast]
  );

  // Convertir pending a slave
  const convertToSlave = useCallback(
    async (accountId: string, masterId: string) => {
      try {
        await csvUnifiedService.convertToSlave(accountId, masterId);
        toast({
          title: 'Success',
          description: `Account ${accountId} converted to slave of ${masterId}`,
        });
        await fetchData();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to convert account';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchData, toast]
  );

  // Actualizar configuración de master
  const updateMasterConfig = useCallback(
    async (accountId: string, config: any) => {
      try {
        await csvUnifiedService.updateMasterConfig(accountId, config);
        toast({
          title: 'Success',
          description: `Master ${accountId} configuration updated`,
        });
        await fetchData();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchData, toast]
  );

  // Actualizar configuración de slave
  const updateSlaveConfig = useCallback(
    async (accountId: string, config: any) => {
      try {
        await csvUnifiedService.updateSlaveConfig(accountId, config);
        toast({
          title: 'Success',
          description: `Slave ${accountId} configuration updated`,
        });
        await fetchData();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchData, toast]
  );

  // Eliminar cuenta
  const deleteAccount = useCallback(
    async (accountId: string) => {
      try {
        await csvUnifiedService.deleteAccount(accountId);
        toast({
          title: 'Success',
          description: `Account ${accountId} deleted`,
        });
        await fetchData();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchData, toast]
  );

  // Efecto para cargar datos iniciales
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribe = csvUnifiedService.subscribeToUpdates(data => {
      console.log('CSV update received:', data);
      // Actualizar datos automáticamente cuando hay cambios
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  return {
    pendingAccounts,
    masterAccounts,
    slaveAccounts,
    unconnectedSlaves,
    isLoading,
    error,
    refetch: fetchData,
    convertToMaster,
    convertToSlave,
    updateMasterConfig,
    updateSlaveConfig,
    deleteAccount,
  };
}
