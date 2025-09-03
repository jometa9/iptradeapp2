import React, { useCallback, useEffect, useRef, useState, memo } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  HousePlug,
  Info,
  Pencil,
  Power,
  PowerOff,
  SaveIcon,
  Settings,
  Shield,
  Trash,
  Unlink,
  Unplug,
  WifiOff,
  XCircle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useUnifiedAccountDataContext } from '../context/UnifiedAccountDataContext';
import {
  canCreateMoreAccounts,
  canCustomizeLotSizes,
  getAccountLimitMessage,
  getLotSizeMessage,
  getPlanDisplayName,
  getSubscriptionLimits,
  shouldShowSubscriptionLimitsCard,
} from '../lib/subscriptionUtils';
import { getPlatformDisplayName } from '../lib/utils';
import csvFrontendService from '../services/csvFrontendService';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Tooltip } from './ui/tooltip';
import { useToast } from './ui/use-toast';

interface TradingAccount {
  id: string;
  accountNumber: string;
  platform: string;
  server: string;
  password: string;
  accountType: string;
  status: string;
  lotCoefficient?: number;
  forceLot?: number;
  reverseTrade?: boolean;
  prefix?: string;
  suffix?: string;
  connectedToMaster?: string;
  connectedSlaves?: Array<{ id: string; name: string; platform: string }>;
  totalSlaves?: number;
  masterOnline?: boolean;
}

// MasterAccountStatus interface moved to useUnifiedAccountData hook

// CopierStatus interface moved to useUnifiedAccountData hook

interface SlaveConfig {
  config: {
    enabled: boolean;
    lotMultiplier?: number;
    forceLot?: number | null;
    reverseTrading?: boolean;
    masterId?: string | null;
    description?: string;
  };
}



const TradingAccountsConfigComponent = () => {
  const { toast: toastUtil } = useToast();
  const { userInfo, secretKey } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<string | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null);
  const [disconnectAllConfirmId, setDisconnectAllConfirmId] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [collapsedMasters, setCollapsedMasters] = useState<{ [key: string]: boolean }>({});
  const collapsedMastersRef = useRef<{ [key: string]: boolean }>({});

  // Sync ref with state
  useEffect(() => {
    collapsedMastersRef.current = collapsedMasters;
  }, [collapsedMasters]);

  // Scroll to edit form when editing account
  useEffect(() => {
    if (editingAccount && editFormRef.current) {
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100); // Small delay to ensure the form is rendered
    }
  }, [editingAccount]);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [updatingCopier, setUpdatingCopier] = useState<string | null>(null);
  const [recentlyDeployedSlaves, setRecentlyDeployedSlaves] = useState<Set<string>>(new Set());
  const [slaveConfigs, setSlaveConfigs] = useState<Record<string, SlaveConfig>>({});
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<string>>(new Set());

  // Usar el hook unificado SSE
  const {
    data: unifiedData,
    loading: isLoading,
    error,
    updateMasterStatus,
    updateSlaveConfig,
    refresh: refreshCSVData,
  } = useUnifiedAccountDataContext();

  // Extract data from unified response
  const copierStatus = unifiedData?.copierStatus;
  const csvAccounts = unifiedData?.configuredAccounts;

  // Escuchar eventos de conversión de cuentas
  useEffect(() => {
    const handleAccountConverted = () => {
      refreshCSVData();
    };

    // Suscribirse a eventos
    window.addEventListener('accountConverted', handleAccountConverted);

    return () => {
      window.removeEventListener('accountConverted', handleAccountConverted);
    };
  }, [refreshCSVData]);

  // Cargar configuraciones de slaves desde los datos CSV
  useEffect(() => {
    if (!csvAccounts) return;

    const newSlaveConfigs: Record<string, SlaveConfig> = {};

    // Obtener configuraciones para todas las cuentas slave desde los datos CSV
    const connectedSlaves = Object.values(csvAccounts.masterAccounts || {}).flatMap(
      master => master.connectedSlaves || []
    );
    const unconnectedSlaves = csvAccounts.unconnectedSlaves || [];

    const slaveAccounts = [...connectedSlaves, ...unconnectedSlaves];

    // Usar la configuración que ya viene en los datos CSV
    for (const slave of slaveAccounts) {
      if (slave.config) {
        // Usar tanto el ID como el accountNumber como claves para asegurar compatibilidad
        const slaveConfig = {
          slaveAccountId: slave.id,
          config: slave.config,
          status: 'success',
        };

        newSlaveConfigs[slave.id] = slaveConfig;
        // También usar accountNumber si es diferente del ID
        // Para slaves conectados, usar el id como accountNumber si no existe
        const accountNumber = slave.accountNumber || slave.id;
        if (accountNumber !== slave.id) {
          newSlaveConfigs[accountNumber] = slaveConfig;
        }
      }
    }

    setSlaveConfigs(newSlaveConfigs);
  }, [csvAccounts]);

  // Convertir datos CSV a formato esperado con optimización
  const accounts = React.useMemo(() => {
    if (!csvAccounts) {
      return [];
    }

    const allAccounts: TradingAccount[] = [];

    // Filtrar cuentas ocultas
    const shouldShowAccount = (accountId: string) => !hiddenAccounts.has(accountId);

    // Agregar master accounts y sus slaves conectados
    Object.entries(csvAccounts.masterAccounts || {}).forEach(([id, master]: [string, any]) => {
      if (shouldShowAccount(id)) {
        allAccounts.push({
          id,
          accountNumber: master.accountNumber || id,
          platform: master.platform || 'Unknown',
          server: master.server || '',
          password: master.password || '',
          accountType: 'master',
          status: master.status || 'offline',
          lotCoefficient: master.lotCoefficient || 1,
          forceLot: master.forceLot || 0,
          reverseTrade: master.reverseTrade || false,
          connectedSlaves: master.connectedSlaves || [],
          totalSlaves: master.totalSlaves || 0,
          masterOnline: master.masterOnline || false,
        });

        // También agregar los slaves conectados a la lista principal
        (master.connectedSlaves || []).forEach((slave: any) => {
          if (shouldShowAccount(slave.id)) {
            allAccounts.push({
              id: slave.id,
              accountNumber: slave.accountNumber || slave.id,
              platform: slave.platform || 'Unknown',
              server: slave.server || '',
              password: slave.password || '',
              accountType: 'slave',
              status: slave.status || 'offline',
              lotCoefficient: slave.lotCoefficient || 1,
              forceLot: slave.forceLot || 0,
              reverseTrade: slave.reverseTrade || false,
              connectedToMaster: id, // Indicar a qué master está conectado
            });
          }
        });
      }
    });

    // Agregar unconnected slaves
    (csvAccounts.unconnectedSlaves || []).forEach((slave: any) => {
      if (shouldShowAccount(slave.id)) {
        allAccounts.push({
          id: slave.id,
          accountNumber: slave.accountNumber || slave.id,
          platform: slave.platform || 'Unknown',
          server: slave.server || '',
          password: slave.password || '',
          accountType: 'slave',
          status: slave.status || 'offline',
          lotCoefficient: slave.lotCoefficient || 1,
          forceLot: slave.forceLot || 0,
          reverseTrade: slave.reverseTrade || false,
        });
      }
    });

    return allAccounts;
  }, [csvAccounts, hiddenAccounts]);

  // Memoize the accounts data with a hash to prevent unnecessary re-renders
  const accountsHash = React.useMemo(() => {
    return JSON.stringify(accounts.map(acc => ({
      id: acc.id,
      status: acc.status,
      accountType: acc.accountType,
      platform: acc.platform,
      totalSlaves: acc.totalSlaves,
      masterOnline: acc.masterOnline
    })));
  }, [accounts]);

  // Connectivity stats from unified data
  const connectivityStats = React.useMemo(() => {
    if (!unifiedData?.serverStats) return null;

    // Usar los datos del serverStats del endpoint unificado
    const serverStats = unifiedData.serverStats;
    
    return {
      total: serverStats.totalMasterAccounts + serverStats.totalSlaveAccounts + serverStats.totalPendingAccounts,
      online: serverStats.totalOnlineAccounts,
      pending: serverStats.totalPendingAccounts,
      offline: serverStats.totalOfflineAccounts,
      slaves: { total: serverStats.totalSlaveAccounts },
      masters: { total: serverStats.totalMasterAccounts },
    };
  }, [unifiedData?.serverStats]);

  // Derived values for subscription limits
  const canAddMoreAccounts = userInfo ? canCreateMoreAccounts(userInfo, accounts.length) : false;
  const planDisplayName = userInfo ? getPlanDisplayName(userInfo.subscriptionType) : 'Free';
  const canCustomizeLotSizesValue = userInfo ? canCustomizeLotSizes(userInfo) : false;

  const [formState, setFormState] = useState({
    accountNumber: '',
    platform: 'MT5',
    serverIp: '',
    password: '',
    accountType: 'master',
    status: 'synchronized',
    lotCoefficient: 1,
    forceLot: 0,
    reverseTrade: false,
    prefix: '',
    suffix: '',
    connectedToMaster: 'none',
  });

  const formRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);

  // Platform options
  const platformOptions = [
    { value: 'MT4', label: 'MetaTrader 4' },
    { value: 'MT5', label: 'MetaTrader 5' },
    { value: 'cTrader', label: 'cTrader' },
    { value: 'TradingView', label: 'TradingView' },
    { value: 'NinjaTrader', label: 'NinjaTrader' },
    { value: 'Other', label: 'Other Platform' },
  ];

  // Account types
  const accountTypeOptions = [
    { value: 'master', label: 'Master Account (Signal Provider)' },
    { value: 'slave', label: 'Slave Account (Signal Follower)' },
    { value: 'pending', label: 'Pending Account (Not Configured)' },
  ];

  // Los datos se cargan automáticamente via SSE
  const fetchAccounts = useCallback(async () => {
    // Los datos ya están disponibles via SSE
    // No necesitamos hacer fetch manual
  }, []);

  // Mark slave account as recently deployed
  const markSlaveAsRecentlyDeployed = (slaveAccountId: string) => {
    setRecentlyDeployedSlaves(prev => new Set([...prev, slaveAccountId]));

    // Clear the "recently deployed" status after 5 seconds
    setTimeout(() => {
      setRecentlyDeployedSlaves(prev => {
        const newSet = new Set(prev);
        newSet.delete(slaveAccountId);
        return newSet;
      });
    }, 5000);
  };

  // Fetch pending accounts count
  const fetchPendingAccountsCount = useCallback(async () => {
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(`http://localhost:${serverPort}/api/accounts/pending`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });

      if (response.ok) {
        await response.json();
        // Data handled by SSE
      } else {
        // Silent error handling
      }
    } catch (error) {
      // Silent error handling
    }
  }, [secretKey]);

  // Polling adicional cada 3 segundos para asegurar actualizaciones rápidas
  useEffect(() => {
    // Los datos se actualizan automáticamente via SSE
  }, []);

  // Load copier status on component mount
  useEffect(() => {
    loadCopierData();
  }, []);

  // Load copier data when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      loadCopierData();
    }
  }, [accounts.length, accounts]);

  // Los datos de copier se cargan automáticamente via SSE
  const loadCopierData = useCallback(async () => {
    // Los datos ya están disponibles via SSE
  }, []);

  // Los datos se actualizan automáticamente via SSE
  useEffect(() => {
    if (error) {
      toastUtil({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error]);

  const [localGlobalStatus, setLocalGlobalStatus] = useState<boolean>(false);

  // Sync global status with server
  useEffect(() => {
    if (copierStatus?.globalStatus !== undefined) {
      setLocalGlobalStatus(copierStatus.globalStatus);
    }
  }, [copierStatus?.globalStatus]);

  const handleToggleGlobalStatus = async (enabled: boolean) => {
    setLocalGlobalStatus(enabled);
    try {
      await csvFrontendService.updateGlobalStatus(enabled);
    } catch (error) {
      // Silent error handling
      // Revert on error
      setLocalGlobalStatus(!enabled);
    }
  };

  // Cancel global copier disable confirmation
  const cancelGlobalDisable = () => {
    setShowGlobalConfirm(false);
  };

  // Toggle master account copier status usando SSE
  const toggleAccountStatus = async (accountId: string, enabled: boolean) => {
    try {
      await csvFrontendService.updateAccountStatus(accountId, enabled);
      toastUtil({
        title: 'Success',
        description: `Account ${accountId} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      // Silent error handling
      toastUtil({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update account status',
        variant: 'destructive',
      });
    }
  };

  // Toggle slave account copier status usando SSE

  // Get effective copier status for master account
  const getMasterEffectiveStatus = (masterAccountId: string) => {
    if (!copierStatus) return false;

    // Buscar la cuenta en los datos CSV para obtener el estado enabled/disabled
    const masterAccount = csvAccounts?.masterAccounts?.[masterAccountId];
    if (masterAccount) {
      // El estado enabled viene del config.enabled - solo depender del estado del master
      return masterAccount.config?.enabled === true;
    }

    // Fallback al sistema anterior si no encontramos la cuenta en CSV
    const masterStatus = copierStatus.masterAccounts?.[masterAccountId];
    return masterStatus?.masterStatus === true;
  };

  // Get effective copier status for slave account
  const getSlaveEffectiveStatus = (slaveAccountId: string, masterAccountId?: string) => {
    if (!copierStatus) return false;

    // Buscar la cuenta slave en los datos CSV para obtener el estado enabled/disabled
    // Primero buscar en slaveAccounts (slaves conectados)
    let slaveAccount = csvAccounts?.slaveAccounts?.[slaveAccountId];

    // Si no se encuentra, buscar en unconnectedSlaves (slaves desconectados)
    if (!slaveAccount && csvAccounts?.unconnectedSlaves) {
      slaveAccount = csvAccounts.unconnectedSlaves.find(
        (slave: any) => slave.id === slaveAccountId || slave.accountNumber === slaveAccountId
      );
    }

    if (slaveAccount) {
      // El estado enabled viene del config.enabled - solo depender del estado del slave
      const slaveEnabled = slaveAccount.config?.enabled === true;
      return slaveEnabled;
    }

    // Fallback al sistema anterior si no encontramos la cuenta en CSV
    const slaveConfig = slaveConfigs[slaveAccountId];
    const slaveEnabled = slaveConfig?.config?.enabled === true;

    // Solo depender del estado del slave, sin verificar master o global status
    return slaveEnabled;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === 'accountType' && value === 'master') {
      setFormState({ ...formState, [name]: value, status: 'synchronized' });
    } else if (name === 'accountType' && value === 'pending') {
      setFormState({ ...formState, [name]: value, status: 'pending' });
    } else {
      setFormState({ ...formState, [name]: value });
    }
  };

  const handlePlatformChange = (value: string) => {
    setFormState({
      ...formState,
      platform: value,
      serverIp: '',
    });
  };

  const handleEditAccount = async (account: TradingAccount) => {
    setIsAddingAccount(true);
    setEditingAccount(account);

    // Preparar el formulario con los datos básicos de la cuenta
    let formData = {
      accountNumber: account.accountNumber,
      platform: account.platform.toLowerCase(),
      serverIp: account.server,
      password: '', // Password not needed for backend operations
      accountType: account.accountType,
      status: account.status,
      lotCoefficient: account.lotCoefficient || 1,
      forceLot: account.forceLot || 0,
      reverseTrade: account.reverseTrade || false,
      prefix: account.prefix || '',
      suffix: account.suffix || '',
      connectedToMaster: account.connectedToMaster || 'none',
    };

    // Si es una cuenta slave, usar la configuración que ya viene en los datos CSV
    if (account.accountType === 'slave') {
      // Para slaves conectados, usar el id como accountNumber si no existe
      const accountNumber = account.accountNumber || account.id;

      // Buscar la configuración tanto por accountNumber como por id
      const slaveConfig = slaveConfigs[accountNumber] || slaveConfigs[account.id];

      if (slaveConfig?.config) {
        // Actualizar el formulario con la configuración específica del slave
        formData = {
          ...formData,
          lotCoefficient: slaveConfig.config.lotMultiplier || 1,
          forceLot: slaveConfig.config.forceLot || 0,
          reverseTrade: slaveConfig.config.reverseTrading || false,
        };
      }
    }

    setFormState(formData);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeleteAccount = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const { toast } = useToast();

  // Función para ocultar una cuenta temporalmente
  const hideAccountTemporarily = useCallback((accountId: string) => {
    setHiddenAccounts(prev => {
      const newSet = new Set(prev);
      newSet.add(accountId);
      return newSet;
    });

    // Después de 10 segundos, si la cuenta aún existe, la mostramos de nuevo
    setTimeout(() => {
      setHiddenAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }, 5000);
  }, []);

  const confirmDeleteAccount = async () => {
    if (!deleteConfirmId) return;

    try {
      setIsSubmitting(true);
      setIsDeletingAccount(deleteConfirmId);

      // Ocultar la cuenta inmediatamente
      hideAccountTemporarily(deleteConfirmId);

      // Determinar el tipo de cuenta para usar el endpoint correcto
      const accountToDelete = accounts.find(acc => acc.id === deleteConfirmId);
      const isMasterAccount = accountToDelete?.accountType === 'master';
      const isSlaveAccount = accountToDelete?.accountType === 'slave';

      let success = false;

      if (isMasterAccount) {
        // Usar el endpoint correcto para borrar master accounts (desconecta slaves primero)
        success = await csvFrontendService.deleteMasterAccount(deleteConfirmId);
      } else if (isSlaveAccount) {
        // Intentar usar el endpoint específico para slave accounts
        success = await csvFrontendService.deleteSlaveAccount(deleteConfirmId);
        
        // Si falla (devuelve false), usar convertToPending como fallback
        if (!success) {
          success = await csvFrontendService.convertToPending(deleteConfirmId);
        }
      } else {
        // Para cuentas que no son ni master ni slave, usar conversión a pending
        success = await csvFrontendService.convertToPending(deleteConfirmId);
      }

      if (success) {
        const actionText = isMasterAccount ? 'deleted' : (isSlaveAccount ? 'deleted' : 'converted to pending');
        toast({
          title: 'Account deleted',
          description: `Account ${deleteConfirmId} has been ${actionText}.`,
          variant: 'default',
        });
        setDeleteConfirmId(null);
        setIsDeletingAccount(null);

        // Forzar actualización inmediata de datos
        setTimeout(() => {
          fetchAccounts();
        }, 100);
      } else {

        toast({
          title: 'Error',
          description: `Failed to delete account ${deleteConfirmId}.`,
          variant: 'destructive',
        });
        // Si falla, mostrar la cuenta de nuevo
        setHiddenAccounts(prev => {
          const newSet = new Set(prev);
          newSet.delete(deleteConfirmId);
          return newSet;
        });
      }
    } catch (error) {

      toast({
        title: 'Error',
        description: 'An error occurred while deleting the account.',
        variant: 'destructive',
      });
      // Si hay error, mostrar la cuenta de nuevo
      setHiddenAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteConfirmId);
        return newSet;
      });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmId(null);
      setIsDeletingAccount(null);
    }
  };

  const cancelDeleteAccount = () => {
    setDeleteConfirmId(null);
  };

  // Helper function for consistent delete button styling
  const DeleteButton = ({ accountId, onClick, disabled = false, title = 'Delete Account' }) => (
    <Button
      variant="outline"
      size="sm"
      className="h-9 w-9 p-0 rounded-lg bg-white border border-red-200 hover:bg-red-50"
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <Trash className="h-4 w-4 text-red-600" />
    </Button>
  );

  const disconnectSlaveAccount = async (slaveAccountId: string, masterAccountId: string) => {
    try {
      setIsDisconnecting(slaveAccountId);
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(
        `http://localhost:${serverPort}/api/slave-config/${slaveAccountId}/disconnect/${masterAccountId}`,
        {
          method: 'POST',
          headers: {
            'x-api-key': secretKey || '',
          },
        }
      );

      if (response.ok) {
        toastUtil({
          title: 'Success',
          description: 'Slave account disconnected successfully',
        });
        setDisconnectConfirmId(null);
        fetchAccounts();
      } else {
        throw new Error('Failed to disconnect slave account');
      }
    } catch (error) {
      // Silent error handling
      toastUtil({
        title: 'Error',
        description: 'Failed to disconnect slave account',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(null);
    }
  };

  const disconnectAllSlaves = async (masterAccountId: string) => {
    try {
      setIsDisconnecting(masterAccountId);
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(
        `http://localhost:${serverPort}/api/slave-config/master/${masterAccountId}/disconnect-all`,
        {
          method: 'POST',
          headers: {
            'x-api-key': secretKey || '',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        toastUtil({
          title: 'Success',
          description: `${result.disconnectedCount} slave accounts disconnected successfully`,
        });
        setDisconnectAllConfirmId(null);
        fetchAccounts();
      } else {
        throw new Error('Failed to disconnect all slave accounts');
      }
    } catch (error) {
      // Silent error handling
      toastUtil({
        title: 'Error',
        description: 'Failed to disconnect all slave accounts',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(null);
    }
  };

  const cancelDisconnectAction = () => {
    setDisconnectConfirmId(null);
    setDisconnectAllConfirmId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      let response;
      let payload;

      // Si estamos editando una cuenta
      if (editingAccount) {
        const accountId = editingAccount.id;

        // Si el tipo de cuenta no cambió, solo actualizar configuración
        if (editingAccount.accountType === formState.accountType) {
          if (editingAccount.accountType === 'slave') {
            // Validar forceLot antes de enviar
            const validatedForceLot =
              formState.forceLot && formState.forceLot > 0 ? Number(formState.forceLot) : null;

            // Actualizar configuración de cuenta slave
            const slavePayload = {
              slaveAccountId: accountId,
              lotMultiplier: formState.lotCoefficient,
              forceLot: validatedForceLot,
              reverseTrading: formState.reverseTrade,
              masterId: formState.connectedToMaster === 'none' ? null : formState.connectedToMaster,
              prefix: formState.prefix || '',
              suffix: formState.suffix || '',
            };

            response = await fetch(`http://localhost:${serverPort}/api/slave-config`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': secretKey || '',
              },
              body: JSON.stringify(slavePayload),
            });


          } else if (editingAccount.accountType === 'master') {
            // Actualizar configuración de cuenta master - solo usar trading-config endpoint
            const tradingConfigPayload = {
              masterAccountId: accountId,
              lotMultiplier: formState.lotCoefficient,
              forceLot: formState.forceLot && formState.forceLot > 0 ? Number(formState.forceLot) : null,
              reverseTrading: formState.reverseTrade,
              prefix: formState.prefix || '',
              suffix: formState.suffix || '',
            };

            response = await fetch(`http://localhost:${serverPort}/api/trading-config`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': secretKey || '',
              },
              body: JSON.stringify(tradingConfigPayload),
            });


          }
        } else {
          // Si el tipo de cuenta cambió, usar los endpoints de conversión

          // Si la cuenta actual es master o slave y queremos convertirla a pending
          if (editingAccount.accountType !== 'pending' && formState.accountType === 'pending') {
            // Convertir a pending usando el endpoint convert-to-pending
            response = await fetch(
              `http://localhost:${serverPort}/api/csv/convert-to-pending/${accountId}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': secretKey || '',
                },
              }
            );


          } else if (formState.accountType === 'master') {
            // Convertir a master - primero convertir a pending, luego a master
            if (editingAccount.accountType !== 'pending') {
              // Primero convertir a pending
              const pendingResponse = await fetch(
                `http://localhost:${serverPort}/api/csv/convert-to-pending/${accountId}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': secretKey || '',
                  },
                }
              );

              if (!pendingResponse.ok) {
                throw new Error('Failed to convert account to pending first');
              }


            }

            // Ahora convertir a master
            const masterPayload = {
              newType: 'master',
            };

            response = await fetch(
              `http://localhost:${serverPort}/api/csv/pending/${accountId}/update-type`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': secretKey || '',
                },
                body: JSON.stringify(masterPayload),
              }
            );


          } else if (formState.accountType === 'slave') {
            // Convertir a slave - primero convertir a pending, luego a slave
            if (editingAccount.accountType !== 'pending') {
              // Primero convertir a pending
              const pendingResponse = await fetch(
                `http://localhost:${serverPort}/api/csv/convert-to-pending/${accountId}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': secretKey || '',
                  },
                }
              );

              if (!pendingResponse.ok) {
                throw new Error('Failed to convert account to pending first');
              }


            }

            // Ahora convertir a slave
            const slavePayload = {
              newType: 'slave',
              slaveConfig: {
                masterAccountId:
                  formState.connectedToMaster !== 'none' ? formState.connectedToMaster : null,
                lotCoefficient: formState.lotCoefficient,
                forceLot: formState.forceLot > 0 ? formState.forceLot : null,
                reverseTrade: formState.reverseTrade,
                prefix: formState.prefix || '',
                suffix: formState.suffix || '',
              },
            };

            response = await fetch(
              `http://localhost:${serverPort}/api/csv/pending/${accountId}/update-type`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': secretKey || '',
                },
                body: JSON.stringify(slavePayload),
              }
            );


          }
        }
      } else {
        // Crear nueva cuenta - usar la lógica existente
        if (formState.accountType === 'master') {
          payload = {
            masterAccountId: formState.accountNumber,
            name: formState.accountNumber,
            description: '',
            broker: formState.serverIp,
            platform: formState.platform.toUpperCase(),
          };

          response = await fetch(`http://localhost:${serverPort}/api/accounts/master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          // Slave account
          payload = {
            slaveAccountId: formState.accountNumber,
            name: formState.accountNumber,
            description: '',
            broker: formState.serverIp,
            platform: formState.platform.toUpperCase(),
            ...(formState.connectedToMaster !== 'none' &&
              formState.connectedToMaster !== '' && {
                masterAccountId: formState.connectedToMaster,
              }),
          };

          response = await fetch(`http://localhost:${serverPort}/api/accounts/slave`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': secretKey || '',
            },
            body: JSON.stringify(payload),
          });

          // If it's a NEW slave account with specific configurations, set them after creating the account
          if (
            response.ok &&
            (formState.lotCoefficient !== 1 || formState.forceLot > 0 || formState.reverseTrade)
          ) {
            const slaveConfigPayload = {
              slaveAccountId: formState.accountNumber,
              lotMultiplier: Number(formState.lotCoefficient),
              forceLot: Number(formState.forceLot) > 0 ? Number(formState.forceLot) : null,
              reverseTrading: formState.reverseTrade,
              enabled: true,
              description: 'Auto-configured from frontend',
              prefix: formState.prefix || '',
              suffix: formState.suffix || '',
            };

            await fetch(`http://localhost:${serverPort}/api/slave-config`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': secretKey || '',
              },
              body: JSON.stringify(slaveConfigPayload),
            });
          }
        }
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save trading account');
      }

      await fetchAccounts();
      await fetchPendingAccountsCount();

      // If we just created a slave account connected to a master, show deployment message
      if (
        !editingAccount &&
        formState.accountType === 'slave' &&
        formState.connectedToMaster &&
        formState.connectedToMaster !== 'none'
      ) {
        toastUtil({
          title: 'Slave Account Deployed',
          description: `Slave account ${formState.accountNumber} has been deployed under master ${formState.connectedToMaster}`,
        });

        // Mark the slave account as recently deployed
        markSlaveAsRecentlyDeployed(formState.accountNumber);
      } else {
        toastUtil({
          title: editingAccount ? 'Account Updated' : 'Account Created',
          description: `Your trading account has been ${editingAccount ? 'updated' : 'created'} successfully.`,
        });
      }

      handleCancel();
    } catch (error) {
      // Silent error handling
      toastUtil({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save trading account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsAddingAccount(false);
    setEditingAccount(null);
  };

  const getServerStatus = () => {
    if (accounts.length === 0) return 'none';

    // Use connectivity stats from backend if available, otherwise fallback to frontend calculation
    if (connectivityStats) {
      const { online, offline, pending, total } = connectivityStats;

      if (total === 0) return 'none';

      // Calculate percentages
      const pendingPercentage = (pending / total) * 100;
      const offlinePercentage = (offline / total) * 100;
      const onlinePercentage = (online / total) * 100;

      // ORANGE: When most accounts are pending (more than 50% pending)
      if (pendingPercentage > 50) {
        return 'pending';
      }

      // GREEN: When all accounts are online and none are pending
      if (onlinePercentage === 100 && pendingPercentage === 0) {
        return 'optimal';
      }

      // RED: When most accounts are offline (more than 50% offline)
      if (offlinePercentage > 50) {
        return 'offline';
      }

      // Default to mixed status for other cases
      return 'mixed';
    }

    // Fallback to frontend calculation
    const onlineCount = accounts.filter(acc => acc.status === 'online').length;
    const offlineCount = accounts.filter(acc => acc.status === 'offline').length;
    const pendingCount = accounts.filter(acc => acc.status === 'pending').length;
    const total = accounts.length;

    if (total === 0) return 'none';

    // Calculate percentages
    const pendingPercentage = (pendingCount / total) * 100;
    const offlinePercentage = (offlineCount / total) * 100;
    const onlinePercentage = (onlineCount / total) * 100;

    // ORANGE: When most accounts are pending (more than 50% pending)
    if (pendingPercentage > 50) {
      return 'pending';
    }

    // GREEN: When all accounts are online and none are pending
    if (onlinePercentage === 100 && pendingPercentage === 0) {
      return 'optimal';
    }

    // RED: When most accounts are offline (more than 50% offline)
    if (offlinePercentage > 50) {
      return 'offline';
    }

    // Default to mixed status for other cases
    return 'mixed';
  };

  const getServerStatusDetails = () => {
    if (accounts.length === 0) {
      return {
        message: 'No accounts configured',
        recommendation: 'Add trading accounts to get started',
        severity: 'info',
      };
    }

    // Use connectivity stats from backend if available
    if (connectivityStats) {
      const { online, offline, total } = connectivityStats;

      if (total === 0) {
        return {
          message: 'No relevant accounts found',
          recommendation: 'Add master or slave accounts to get started',
          severity: 'info',
        };
      }

      const onlinePercentage = Math.round((online / total) * 100);
      const offlinePercentage = Math.round((offline / total) * 100);

      const status = getServerStatus();

      switch (status) {
        case 'optimal':
          return {
            message: `${onlinePercentage}% of accounts are online - All operational`,
            recommendation: 'All systems operational - copy trading active',
            severity: 'success',
          };
        case 'offline':
          return {
            message: `${offlinePercentage}% of accounts are offline`,
            recommendation: 'Check network connections and account credentials',
            severity: 'error',
          };
        case 'mixed':
          return {
            message: `Mixed status: ${onlinePercentage}% online, ${offlinePercentage}% offline`,
            recommendation: 'Address offline accounts to improve system performance',
            severity: 'warning',
          };
        default:
          return {
            message: 'Unknown status',
            recommendation: 'Check system configuration',
            severity: 'info',
          };
      }
    }

    // Fallback to frontend calculation
    // Usar directamente los stats del servidor
    const stats = unifiedData?.serverStats;
    
    // Si no hay stats, retornar todos en 0
    if (!stats) {
      return {
        message: 'No server stats available',
        recommendation: 'Check server connection',
        severity: 'warning'
      };
    }

    const mastersCount = stats.totalMasterAccounts;
    const slavesCount = stats.totalSlaveAccounts;
    const pendingCount = stats.totalPendingAccounts;
    const onlineCount = stats.totalOnlineAccounts;
    const offlineCount = stats.totalOfflineAccounts;
    const relevantTotal = mastersCount + slavesCount + pendingCount;

    if (relevantTotal === 0) {
      return {
        message: 'No relevant accounts found',
        recommendation: 'Add master or slave accounts to get started',
        severity: 'info',
      };
    }

    const slavesPercentage = Math.round((slavesCount / relevantTotal) * 100);
    const mastersPercentage = Math.round((mastersCount / relevantTotal) * 100);
    const offlinePercentage = Math.round((offlineCount / relevantTotal) * 100);
    const pendingPercentage = Math.round((pendingCount / relevantTotal) * 100);

    const status = getServerStatus();

    switch (status) {
      case 'optimal':
        return {
          message: `${mastersPercentage}% masters, ${slavesPercentage}% slaves - All operational`,
          recommendation: 'All systems operational - copy trading active',
          severity: 'success',
        };
      case 'offline':
        return {
          message: `${offlinePercentage}% of accounts are offline`,
          recommendation: 'Check network connections and account credentials',
          severity: 'error',
        };
      case 'pending':
        return {
          message: `${pendingPercentage}% of accounts are pending`,
          recommendation: 'Connect slaves to masters to enable copy trading',
          severity: 'warning',
        };
      case 'mixed':
        return {
          message: `Mixed status: ${mastersPercentage}% masters, ${slavesPercentage}% slaves, ${offlinePercentage}% offline, ${pendingPercentage}% pending`,
          recommendation: 'Connect slaves to masters and address offline accounts',
          severity: 'warning',
        };
      default:
        return {
          message: 'Unknown status',
          recommendation: 'Check system configuration',
          severity: 'info',
        };
    }
  };

  const toggleMasterCollapse = (masterId: string) => {
    setCollapsedMasters(prev => {
      const newState = {
        ...prev,
        [masterId]: !prev[masterId],
      };
      collapsedMastersRef.current = newState;
      return newState;
    });
  };

  // Helper function to get CSV configuration status for an account
  const getCSVConfigurationStatus = (accountId: string) => {
    // Use the existing functions that read from CSV data
    if (!accounts || accounts.length === 0)
      return { enabled: false, masterId: null, type: 'unknown' };

    // Find the account in the accounts array
    const account = accounts.find(acc => acc.accountNumber === accountId || acc.name === accountId);
    if (account) {
      if (account.accountType === 'master') {
        const enabled = getMasterEffectiveStatus(accountId);
        return {
          enabled,
          masterId: null,
          type: 'master',
        };
      } else if (account.accountType === 'slave') {
        const enabled = getSlaveEffectiveStatus(accountId, account.connectedToMaster);
        return {
          enabled,
          masterId: account.connectedToMaster !== 'none' ? account.connectedToMaster : null,
          type: 'slave',
        };
      }
    }

    // If not found in accounts array, check if it's a connected slave
    if (csvAccounts) {
      // Search in connected slaves of all masters
      for (const master of Object.values(csvAccounts.masterAccounts || {})) {
        const connectedSlave = master.connectedSlaves?.find(slave => slave.id === accountId);
        if (connectedSlave) {
          // Use the config that already comes in connectedSlave
          const enabled = connectedSlave.config?.enabled ?? false;
          const masterId = connectedSlave.config?.masterId ?? null;

          return {
            enabled,
            masterId,
            type: 'slave',
          };
        }
      }
    }

    return { enabled: false, masterId: null, type: 'unknown' };
  };

  // Helper function to get status display text
  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'synchronized':
        return 'Connected';
      case 'pending':
        return 'Not Connected';
      case 'offline':
        return 'Offline';
      default:
        return 'Not Connected'; // Default for unknown statuses
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synchronized':
        return <CheckCircle className="text-green-700" />;
      case 'pending':
        return <Clock className="text-orange-500" />;
      case 'offline':
        return <XCircle className="text-red-700" />;
      default:
        return <CheckCircle className="text-green-700" />;
    }
  };

  const getStatusBadge = (status: boolean) => {
    return status ? (
      <Badge className="bg-green-100 text-green-800 border border-green-400">
        <Power className="w-3 h-3 mr-1" />
        ON
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 border border-red-200">
        <PowerOff className="w-3 h-3 mr-1" />
        OFF
      </Badge>
    );
  };

  // Helper function to render configuration badge based on CSV status
  const getConfigurationBadge = (accountId: string) => {
    const csvStatus = getCSVConfigurationStatus(accountId);

    if (csvStatus.type === 'master') {
      // For master accounts, show enabled/disabled status
      return csvStatus.enabled ? (
        <div className="rounded-full px-2 py-0.5 text-xs bg-green-100 border border-green-400 text-green-800 inline-block">
          Enabled
        </div>
      ) : (
        <div className="rounded-full px-2 py-0.5 text-xs bg-red-100 border border-red-300 text-red-800 inline-block">
          Disabled
        </div>
      );
    } else if (csvStatus.type === 'slave') {
      // For slave accounts, prioritize enabled/disabled status over connection status
      if (!csvStatus.enabled) {
        return (
          <div className="rounded-full px-2 py-0.5 text-xs bg-red-100 border border-red-300 text-red-800 inline-block">
            Disabled
          </div>
        );
      } else if (csvStatus.masterId) {
        return (
          <div className="rounded-full px-2 py-0.5 text-xs bg-green-100 border border-green-400 text-green-800 inline-block">
            Connected
          </div>
        );
      } else {
        return (
          <div className="rounded-full px-2 py-0.5 text-xs bg-orange-100 border border-orange-300 text-orange-800 inline-block">
            Not connected
          </div>
        );
      }
    } else {
      // Unknown account type
      return (
        <div className="rounded-full px-2 py-0.5 text-xs bg-gray-100 border border-gray-300 text-gray-800 inline-block">
          Unknown
        </div>
      );
    }
  };

  const fadeInDownAnimation = {
    opacity: 1,
    animation: 'fadeInDown 0.25s ease-out',
    transition: 'opacity 0.3s, transform 0.3s',
  };
  // fadeOutAnimation removed - not used

  return (
    <div>
      {/* Debug logs removed */}

      {/* Subscription Info Card para planes con límites */}
      {userInfo && shouldShowSubscriptionLimitsCard(userInfo, accounts.length) && (
        <Card
          className="border-yellow-400 bg-yellow-50 flex items-center p-4 gap-3 mb-3"
          style={fadeInDownAnimation}
        >
          <AlertTriangle className="w-6 h-6 text-yellow-900" />
          <div className="gap-3">
            <CardTitle className="text-yellow-800 mt-1">Subscription Limits</CardTitle>
            <p className="text-sm mt-1.5 text-yellow-800">
              {getAccountLimitMessage(userInfo, accounts.length)} {getLotSizeMessage(userInfo)}
            </p>
          </div>
        </Card>
      )}

      {/* Eliminada la tarjeta verde para usuarios ilimitados según requisitos */}

      <Card className="bg-white rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Trading Accounts Configuration
              </CardTitle>
              <CardDescription className="text-sm text-gray-400 mt-2">
                Manage your trading accounts and copy trading configuration
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Global Copier Status */}
          <div
            className={`border ${
              localGlobalStatus ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'
            } rounded-xl p-4 mb-4 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield
                  className={`w-6 h-6 ${localGlobalStatus ? 'text-blue-900' : 'text-orange-900'}`}
                />
                <div>
                  <h3
                    className={`font-semibold ${
                      localGlobalStatus ? 'text-blue-900' : 'text-orange-900'
                    }`}
                  >
                    Global Copier Status
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showGlobalConfirm && getStatusBadge(localGlobalStatus)}
                <Switch
                  checked={localGlobalStatus}
                  onCheckedChange={handleToggleGlobalStatus}
                />
              </div>
            </div>
          </div>

          {/* Server Status Bar */}
          <div
            className={`mb-4 border border-gray-200 rounded-xl shadow-sm overflow-hidden
            ${
              getServerStatus() === 'optimal'
                ? 'bg-green-50 border-green-200'
                : getServerStatus() === 'offline'
                  ? 'bg-red-50 border-red-200'
                  : getServerStatus() === 'pending'
                    ? 'bg-orange-50 border-orange-200'
                    : getServerStatus() === 'mixed'
                      ? 'bg-orange-50 border-orange-200'
                                        : getServerStatus() === 'mixed'
                    ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between p-4 px-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Server Status:</div>
                  {(() => {
                    switch (getServerStatus()) {
                      case 'optimal':
                        return <CheckCircle className="h-4 w-4 text-green-500" />;
                      case 'offline':
                        return <WifiOff className="h-4 w-4 text-red-500" />;
                      case 'pending':
                        return <Clock className="h-4 w-4 text-orange-500" />;
                      case 'mixed':
                        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
                      default:
                        return <Info className="h-4 w-4 text-gray-500" />;
                    }
                  })()}
                  <div className="text-sm font-medium">
                    {getServerStatus() === 'optimal'
                      ? 'All Connected'
                      : getServerStatus() === 'offline'
                        ? 'Mostly Offline'
                        : getServerStatus() === 'pending'
                          ? 'Not Connected'
                          : getServerStatus() === 'mixed'
                            ? 'Mixed Status'
                              : 'No Accounts'}
                  </div>
                </div>

                {/* Status Details */}
                <div className="hidden md:block border-l border-gray-300 pl-3">
                  <div className="text-xs text-gray-600">{getServerStatusDetails().message}</div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="border-b border-gray-200 mx-4"></div>
            <div className="grid grid-cols-6 gap-4 p-4 px-6">
              {/* Slaves */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-green-200 shadow-sm">
                <div className="text-2xl font-bold text-green-700">
                  {unifiedData?.serverStats?.totalSlaveAccounts || 0}
                </div>
                <div className="text-xs text-green-700 text-center">Slaves</div>
              </div>

              {/* Masters */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="text-2xl font-bold text-blue-700">
                  {unifiedData?.serverStats?.totalMasterAccounts || 0}
                </div>
                <div className="text-xs text-blue-700 text-center">Masters</div>
              </div>

              {/* Pending */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-orange-200 shadow-sm">
                <div className="text-2xl font-bold text-orange-700">
                  {unifiedData?.serverStats?.totalPendingAccounts || 0}
                </div>
                <div className="text-xs text-orange-700 text-center">Pendings</div>
              </div>

              {/* Online */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-emerald-200 shadow-sm">
                <div className="text-2xl font-bold text-emerald-700">
                  {unifiedData?.serverStats?.totalOnlineAccounts || 0}
                </div>
                <div className="text-xs text-emerald-700 text-center">Online</div>
              </div>

              {/* Offline */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-red-200 shadow-sm">
                <div className="text-2xl font-bold text-red-700">
                  {unifiedData?.serverStats?.totalOfflineAccounts || 0}
                </div>
                <div className="text-xs text-red-700 text-center">Offline</div>
              </div>

              {/* Total */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-gray-700">
                  {(unifiedData?.serverStats?.totalMasterAccounts || 0) + 
                   (unifiedData?.serverStats?.totalSlaveAccounts || 0) + 
                   (unifiedData?.serverStats?.totalPendingAccounts || 0)}
                </div>
                <div className="text-xs text-gray-700 text-center">Total</div>
              </div>
            </div>
          </div>

          {/* Add/Edit Account Form */}
          {(isAddingAccount || editingAccount) && (
            <Card
              ref={editFormRef}
              className={
                editingAccount
                  ? formState.accountType === 'master'
                    ? 'border-blue-200 bg-blue-50/30'
                    : 'border-green-200 bg-green-50/30'
                  : ''
              }
            >
              <CardHeader>
                <CardTitle
                  className={
                    editingAccount
                      ? formState.accountType === 'master'
                        ? 'text-blue-700'
                        : 'text-green-700'
                      : ''
                  }
                >
                  {editingAccount ? (
                    <div className="flex items-center gap-2">
                      {formState.accountType === 'master' ? (
                        <HousePlug className="h-5 w-5" />
                      ) : formState.accountType === 'slave' ? (
                        <Unplug className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                      <span>
                        {editingAccount.accountNumber}{' '}
                        {formState.accountType === 'master'
                          ? 'Master'
                          : formState.accountType === 'slave'
                            ? 'Slave'
                            : 'Pending'}{' '}
                        Configuration
                      </span>
                    </div>
                  ) : (
                    'Add New Account'
                  )}
                </CardTitle>
                {!canAddMoreAccounts && !editingAccount && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Account limit reached
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            Your {planDisplayName} plan has reached the maximum number of accounts
                            allowed. Please upgrade your plan to add more accounts.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {canAddMoreAccounts || editingAccount ? (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div
                      className={`grid gap-4 ${
                        // Si estamos editando una cuenta y seleccionamos master o pending, usar una columna
                        editingAccount &&
                        ((editingAccount.accountType === 'master' &&
                          formState.accountType === 'master') ||
                          formState.accountType === 'master' ||
                          formState.accountType === 'pending')
                          ? 'grid-cols-1'
                          : 'grid-cols-1 md:grid-cols-2'
                      }`}
                    >
                      {/* Para cuentas nuevas o cuentas master existentes, mostrar todos los campos */}

                      <div
                        className={
                          // Si estamos editando una cuenta y seleccionamos master o pending, hacer que ocupe todo el ancho
                          editingAccount &&
                          ((editingAccount.accountType === 'master' &&
                            formState.accountType === 'master') ||
                            formState.accountType === 'master' ||
                            formState.accountType === 'pending')
                            ? 'col-span-1'
                            : ''
                        }
                      >
                        <Label htmlFor="accountType">Account Type</Label>
                        <Select
                          name="accountType"
                          value={formState.accountType}
                          onValueChange={value => handleSelectChange('accountType', value)}
                        >
                          <SelectTrigger className="bg-white border border-gray-200 shadow-sm cursor-pointer">
                            <SelectValue placeholder="Select Type" className="bg-white" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200">
                            {accountTypeOptions.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="bg-white cursor-pointer hover:bg-gray-50"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                          Select the type of account you want to convert
                        </p>
                      </div>

                      {/* Configuration fields for Master accounts - only prefix/suffix */}
                      {formState.accountType === 'master' && editingAccount && (
                        <>
                          {/* Prefix and Suffix Fields for Masters */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="prefix">Ticker Symbol Prefix</Label>
                              <Input
                                id="prefix"
                                name="prefix"
                                type="text"
                                placeholder="Enter prefix..."
                                value={formState.prefix || ''}
                                onChange={e =>
                                  setFormState({
                                    ...formState,
                                    prefix: e.target.value,
                                  })
                                }
                                className="bg-white border border-gray-200 shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                Text to remove at the beginning of ticker symbols
                              </p>  
                            </div>

                            <div>
                              <Label htmlFor="suffix">Ticker Symbol Suffix</Label>
                              <Input
                                id="suffix"
                                name="suffix"
                                type="text"
                                placeholder="Enter suffix..."
                                value={formState.suffix || ''}
                                onChange={e =>
                                  setFormState({
                                    ...formState,
                                    suffix: e.target.value,
                                  })
                                }
                                className="bg-white border border-gray-200 shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                Text to remove at the end of ticker symbols
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Full configuration fields for Slave accounts */}
                      {formState.accountType === 'slave' && (
                        <>
                          <div>
                            <Label htmlFor="connectedToMaster">Connect to Master Account</Label>
                            <Select
                              name="connectedToMaster"
                              value={formState.connectedToMaster}
                              onValueChange={value =>
                                handleSelectChange('connectedToMaster', value)
                              }
                            >
                              <SelectTrigger className="bg-white border border-gray-200 shadow-sm cursor-pointer">
                                <SelectValue
                                  placeholder="Select Master Account (Optional)"
                                  className="bg-white"
                                />
                              </SelectTrigger>
                              <SelectContent className="bg-white border border-gray-200">
                                {(() => {
                                  const masterAccounts = accounts.filter(
                                    acc =>
                                      acc.accountType === 'master' &&
                                      // Excluir la cuenta que se está editando si se está convirtiendo de master a slave
                                      !(
                                        editingAccount &&
                                        editingAccount.accountType === 'master' &&
                                        formState.accountType === 'slave' &&
                                        acc.id === editingAccount.id
                                      )
                                  );
                                  if (masterAccounts.length === 0) {
                                    return (
                                      <SelectItem
                                        value="none"
                                        className="cursor-pointer hover:bg-gray-50 text-gray-500"
                                        disabled
                                      >
                                        No master accounts available
                                      </SelectItem>
                                    );
                                  } else {
                                    return (
                                      <>
                                        <SelectItem
                                          value="none"
                                          className="cursor-pointer hover:bg-gray-50"
                                        >
                                          Not Connected
                                        </SelectItem>
                                        {masterAccounts.map(masterAcc => (
                                          <SelectItem
                                            key={masterAcc.id}
                                            value={masterAcc.accountNumber}
                                            className="bg-white cursor-pointer hover:bg-gray-50"
                                          >
                                            {masterAcc.accountNumber} (
                                            {masterAcc.platform.toUpperCase()})
                                          </SelectItem>
                                        ))}
                                      </>
                                    );
                                  }
                                })()}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                              Set the master account to connect to
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="lotCoefficient">
                              Lot Size Multiplier
                              {(() => {
                                const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                if (limits.maxLotSize !== null) {
                                  return ` (Fixed at 1.0 for ${getPlanDisplayName(userInfo?.subscriptionType || 'free')} plan)`;
                                }
                                return '';
                              })()}
                            </Label>
                            <Input
                              id="lotCoefficient"
                              name="lotCoefficient"
                              type="number"
                              min="0.01"
                              max="100"
                              step="0.01"
                              value={
                                canCustomizeLotSizesValue
                                  ? formState.lotCoefficient && formState.lotCoefficient !== 1
                                    ? formState.lotCoefficient.toFixed(2)
                                    : '1.00'
                                  : '1.00'
                              }
                              onChange={e => {
                                const inputValue = e.target.value;
                                let value = 1;

                                if (inputValue !== '') {
                                  // Permitir valores con hasta 2 decimales
                                  const parsedValue = parseFloat(inputValue);
                                  if (!isNaN(parsedValue) && parsedValue > 0) {
                                    // Redondear a 2 decimales para evitar problemas de precisión
                                    value = Math.round(parsedValue * 100) / 100;
                                  }
                                }

                                setFormState({
                                  ...formState,
                                  lotCoefficient: canCustomizeLotSizesValue ? value : 1,
                                });
                              }}
                              disabled={(() => {
                                const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                return limits.maxLotSize !== null;
                              })()}
                              className="bg-white border border-gray-200 shadow-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                              {(() => {
                                const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                if (limits.maxLotSize !== null) {
                                  return `Lot multiplier disabled - ${getPlanDisplayName(userInfo?.subscriptionType || 'free')} plan has lot size restrictions`;
                                }
                                return "Multiplies the lot size from the master account";
                              })()}
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="forceLot">
                              Fixed Lot Size
                              {(() => {
                                const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                if (limits.maxLotSize !== null) {
                                  return ` (Limited to ${limits.maxLotSize} for ${getPlanDisplayName(userInfo?.subscriptionType || 'free')} plan)`;
                                }
                                return '';
                              })()}
                            </Label>
                            <Input
                              id="forceLot"
                              name="forceLot"
                              type="number"
                              min="0"
                              max={(() => {
                                const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                if (limits.maxLotSize !== null) {
                                  return limits.maxLotSize.toString();
                                }
                                return '100';
                              })()}
                              step="0.01"
                              value={
                                (() => {
                                  const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                  if (limits.maxLotSize !== null) {
                                    // Si hay límite de lot, mostrar el límite máximo
                                    return limits.maxLotSize.toFixed(2);
                                  }
                                  // Si no hay límite, usar la lógica normal
                                  return formState.forceLot && formState.forceLot > 0
                                    ? formState.forceLot.toFixed(2)
                                    : '0.00';
                                })()
                              }
                              onChange={e => {
                                const inputValue = e.target.value;
                                let value = 0;

                                if (inputValue !== '') {
                                  // Permitir valores con hasta 2 decimales
                                  const parsedValue = parseFloat(inputValue);
                                  if (!isNaN(parsedValue)) {
                                    // Redondear a 2 decimales para evitar problemas de precisión
                                    value = Math.round(parsedValue * 100) / 100;
                                    
                                    // Aplicar límites de suscripción
                                    if (!canCustomizeLotSizesValue) {
                                      value = value > 0 ? 0.01 : 0;
                                    } else {
                                      // Para planes con límites personalizados
                                      const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                      if (limits.maxLotSize !== null && value > limits.maxLotSize) {
                                        value = limits.maxLotSize;
                                        toastUtil({
                                          title: "Lot size limit exceeded",
                                          description: `Your plan limits lot size to ${limits.maxLotSize}`,
                                          variant: "destructive"
                                        });
                                      }
                                    }
                                  }
                                }

                                setFormState({
                                  ...formState,
                                  forceLot: value
                                });
                              }}
                              disabled={!canCustomizeLotSizesValue}
                              className="bg-white border border-gray-200 shadow-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                              {(() => {
                                const limits = getSubscriptionLimits(userInfo?.subscriptionType || 'free');
                                if (limits.maxLotSize !== null) {
                                  return `Fixed lot size disabled - ${getPlanDisplayName(userInfo?.subscriptionType || 'free')} plan limits lot size to ${limits.maxLotSize}`;
                                }
                                return "If set above 0, uses this fixed lot size instead of copying";
                              })()}
                            </p>
                          </div>


                            <div>
                              <Label htmlFor="prefix">Ticker Symbol Prefix</Label>
                              <Input
                                id="prefix"
                                name="prefix"
                                type="text"
                                placeholder="Enter prefix..."
                                value={formState.prefix || ''}
                                onChange={e =>
                                  setFormState({
                                    ...formState,
                                    prefix: e.target.value,
                                  })
                                }
                                className="bg-white border border-gray-200 shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                Text to remove at the beginning of ticker symbols
                              </p>
                            </div>

                            <div>
                              <Label htmlFor="suffix">Ticker Symbol Suffix</Label>
                              <Input
                                id="suffix"
                                name="suffix"
                                type="text"
                                placeholder="Enter suffix..."
                                value={formState.suffix || ''}
                                onChange={e =>
                                  setFormState({
                                    ...formState,
                                    suffix: e.target.value,
                                  })
                                }
                                className="bg-white border border-gray-200 shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                Text to remove at the end of ticker symbols
                              </p>
                            </div>
                            
                          <div>
                            <Label htmlFor="forceLot">
                              Reverse trading
                            </Label>
                            <Switch
                              id="reverseTrade"
                              checked={formState.reverseTrade}
                              onCheckedChange={checked =>
                                setFormState({
                                  ...formState,
                                  reverseTrade: checked,
                                })
                              }
                              className='block my-1'
                            />
                            <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                             Reverse the trading direction (buy/sell)
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        type="button"
                        onClick={handleCancel}
                        variant="outline"
                        disabled={isSubmitting}
                        className="bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-white border border-blue-200 shadow-sm h-9 hover:bg-blue-50"
                      >
                        <SaveIcon className="h-4 w-4 mr-2" />
                        {isSubmitting ? (
                          <>
                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                            Saving...
                          </>
                        ) : editingAccount ? (
                          editingAccount.accountType === 'slave' ? (
                            'Update Configuration'
                          ) : (
                            'Update Account'
                          )
                        ) : (
                          'Add Account'
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      Please upgrade your plan to add more accounts.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Accounts Table */}
          {accounts.length === 0 ? (
            <div className="text-center py-10">
              <div>
                <p className="text-muted-foreground text-gray-400">
                  No trading accounts configured yet
                </p>
                <p className="text-sm text-muted-foreground mt-2 text-gray-400">
                  Accounts must be added through the pending accounts section first
                </p>
              </div>
            </div>
          ) : (
            (() => {
          
              return (
            <div className="mt-4 border rounded-xl border-gray-200 shadow-sm relative overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted/50">
                  <tr>
                    <th className=" px-4 py-3 align-middle"></th>
                    <th className=" px-4 py-3 text-center text-xs uppercase align-middle">
                      Status
                    </th>
                    <th className=" px-4 py-3 text-center text-xs uppercase align-middle">Copy</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Account</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Type</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Platform</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Config</th>
                    <th className=" px-4 py-3 text-center text-xs uppercase align-middle">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {/* Master accounts */}
                  {accounts
                    .filter(account => account.accountType === 'master')
                    .map(masterAccount => {
                      const connectedSlaves = masterAccount.connectedSlaves || [];
                      const hasSlaves = connectedSlaves.length > 0;
                      return (
                        <React.Fragment key={`master-group-${masterAccount.id}`}>
                          <tr
                            className="bg-blue-50 cursor-pointer"
                            onClick={e => {
                              if (!(e.target as HTMLElement).closest('.actions-column')) {
                                toggleMasterCollapse(masterAccount.id);
                              }
                            }}
                          >
                            <td className="pl-6 py-2 align-middle">
                              <div className="flex items-center justify-center h-full w-full">
                                {hasSlaves ? (
                                  <button
                                    type="button"
                                    className="focus:outline-none"
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleMasterCollapse(masterAccount.id);
                                    }}
                                    aria-label={
                                      collapsedMasters[masterAccount.id]
                                        ? 'Expand slaves'
                                        : 'Collapse slaves'
                                    }
                                  >
                                    {collapsedMasters[masterAccount.id] ? (
                                      <ChevronRight className="h-4 w-4 text-gray-700" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-gray-700" />
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                            <td className=" py-2 align-middle">
                              <div className="flex items-center justify-center h-full w-full">
                                <span className="flex items-center justify-center h-5 w-5">
                                  {getStatusIcon(masterAccount.status)}
                                </span>
                              </div>
                            </td>
                            <td className=" px-4 py-2 align-middle actions-column">
                              <div className="flex items-center justify-center">
                                <Switch
                                  checked={getMasterEffectiveStatus(masterAccount.accountNumber)}
                                  onCheckedChange={enabled =>
                                    toggleAccountStatus(masterAccount.accountNumber, enabled)
                                  }

                                  title='Copy trading'
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                              {masterAccount.accountNumber}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-blue-700 align-middle">
                              Master
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                              {getPlatformDisplayName(masterAccount.platform)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs align-middle">
                              <div className="flex gap-2 flex-wrap">
                                {/* Badge de slaves conectados */}
                                {masterAccount.totalSlaves && masterAccount.totalSlaves > 0 ? (
                                  <div className="rounded-full px-2 py-0.5 text-xs bg-blue-100 border border-blue-400 text-blue-800 inline-block">
                                    {masterAccount.totalSlaves} slave
                                    {masterAccount.totalSlaves > 1 ? 's' : ''}
                                  </div>
                                ) : (
                                  <div className="rounded-full px-2 border border-gray-200 py-0.5 text-xs bg-white text-gray-800 inline-block">
                                    No slaves
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className=" px-4 py-2 whitespace-nowrap align-middle actions-column">
                              {deleteConfirmId === masterAccount.id ? (
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={e => {
                                      e.stopPropagation();
                                      confirmDeleteAccount();
                                    }}
                                    disabled={isDeletingAccount === masterAccount.id}
                                    className="bg-red-50 h-9  border border-red-200 text-red-700 hover:bg-red-100"
                                  >
                                    {isDeletingAccount === masterAccount.id
                                      ? 'Deleting...'
                                      : 'Delete'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={e => {
                                      e.stopPropagation();
                                      cancelDeleteAccount();
                                    }}
                                    disabled={isDeletingAccount === masterAccount.id}
                                    className="bg-white h-9 border-gray-200 text-gray-700 hover:bg-gray-100"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : disconnectAllConfirmId === masterAccount.id ? (
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                                    onClick={e => {
                                      e.stopPropagation();
                                      disconnectAllSlaves(masterAccount.accountNumber);
                                    }}
                                    disabled={isDisconnecting === masterAccount.id}
                                  >
                                    {isDisconnecting === masterAccount.id ? (
                                      <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent mr-1" />
                                        Disconnecting...
                                      </>
                                    ) : (
                                      <>Disconnect</>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={e => {
                                      e.stopPropagation();
                                      cancelDisconnectAction();
                                    }}
                                    disabled={isDisconnecting === masterAccount.id}
                                    className="bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex space-x-2">
                                  {(!masterAccount.totalSlaves ||
                                    masterAccount.totalSlaves === 0) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleEditAccount(masterAccount);
                                      }}
                                      title="Edit Account"
                                      disabled={isDeletingAccount === masterAccount.id}
                                    >
                                      <Pencil className="h-4 w-4 text-blue-600" />
                                    </Button>
                                  )}
                                  {(!masterAccount.totalSlaves ||
                                    masterAccount.totalSlaves === 0) && (
                                    <DeleteButton
                                      accountId={masterAccount.id}
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleDeleteAccount(masterAccount.id);
                                      }}
                                      disabled={isDeletingAccount === masterAccount.id}
                                      title="Delete Account"
                                    />
                                  )}
                                  {masterAccount.totalSlaves && masterAccount.totalSlaves > 0 ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setDisconnectAllConfirmId(masterAccount.id);
                                      }}
                                      title="Disconnect All Slaves"
                                      disabled={
                                        isDeletingAccount === masterAccount.id ||
                                        isDisconnecting === masterAccount.id
                                      }
                                    >
                                      <Unlink className="h-4 w-4 text-orange-600" />
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Slave accounts connected to this master */}
                          {!collapsedMasters[masterAccount.id] &&
                            connectedSlaves.map(slaveAccount => {
                              // Crear el objeto procesado directamente aquí para tener todos los campos correctos
                              const accountToUse = {
                                id: slaveAccount.id,
                                accountNumber: slaveAccount.accountNumber || slaveAccount.id,
                                platform: slaveAccount.platform || 'Unknown',
                                server: slaveAccount.server || '',
                                password: slaveAccount.password || '',
                                accountType: 'slave',
                                status: slaveAccount.status || 'offline',
                                lotCoefficient: slaveAccount.lotCoefficient || 1,
                                forceLot: slaveAccount.forceLot || 0,
                                reverseTrade: slaveAccount.reverseTrade || false,
                                connectedToMaster: masterAccount.id,
                                config: slaveAccount.config,
                                masterOnline: slaveAccount.masterOnline || true, // Para slaves conectados, asumir que el master está online
                              };

                              return (
                                <tr
                                  key={accountToUse.id}
                                  className={`bg-white hover:bg-muted/50 ${recentlyDeployedSlaves.has(accountToUse.accountNumber) ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}
                                >
                                  <td className=" px-2 py-1.5 align-middle"></td>
                                  <td className=" px-4 py-1.5 align-middle">
                                    <div className="flex items-center justify-center h-full w-full">
                                      <span className="flex items-center justify-center h-5 w-5">
                                        {getStatusIcon(accountToUse.status)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className=" px-4 py-1.5 align-middle actions-column">
                                    <div className="flex items-center justify-center">
                                      <Switch
                                        checked={getSlaveEffectiveStatus(
                                          accountToUse.accountNumber,
                                          masterAccount.accountNumber
                                        )}
                                        onCheckedChange={enabled =>
                                          toggleAccountStatus(accountToUse.accountNumber, enabled)
                                        }

                                        title='Copy trading'
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-1.5 whitespace-nowrap text-sm align-middle">
                                    <div className="flex items-center gap-2">
                                      {accountToUse.accountNumber}
                                      {recentlyDeployedSlaves.has(accountToUse.accountNumber) && (
                                        <div className="flex items-center gap-1">
                                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                          <span className="text-xs text-green-600 font-medium">
                                            New
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-1.5 whitespace-nowrap text-sm text-green-700 align-middle">
                                    Slave
                                  </td>
                                  <td className="px-4 py-1.5 whitespace-nowrap text-sm align-middle">
                                    {getPlatformDisplayName(accountToUse.platform)}
                                  </td>
                                  <td className="px-4 py-1.5 whitespace-nowrap text-xs align-middle">
                                    <div className="flex gap-2 flex-wrap">
                                      {/* Mostrar configuraciones de slave usando la config que ya viene en slaveAccount */}
                                      {(() => {
                                        const config = accountToUse.config;

                                        const labels = [];

                                        if (config) {
                                          // Fixed lot tiene prioridad sobre multiplier
                                          if (config.forceLot && config.forceLot > 0) {
                                            labels.push(
                                              <div
                                                key="forceLot"
                                                className="rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-800 border border-blue-400 inline-block"
                                              >
                                                {config.forceLot} Lot
                                              </div>
                                            );
                                          } else if (config.lotMultiplier) {
                                            // Solo mostrar multiplier si no hay fixed lot
                                            labels.push(
                                              <div
                                                key="lotMultiplier"
                                                className="rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-800 border border-green-400 inline-block"
                                              >
                                                {config.lotMultiplier}x
                                              </div>
                                            );
                                          }

                                          // Reverse trading (siempre mostrar si está habilitado)
                                          if (config.reverseTrading) {
                                            labels.push(
                                              <div
                                                key="reverseTrading"
                                                className="rounded-full px-2 py-0.5 text-xs bg-purple-100 text-purple-800 border border-purple-400 inline-block"
                                              >
                                                Reverse
                                              </div>
                                            );
                                          }

                                          // Master ID (mostrar a qué master se conecta)
                                          if (config.masterId) {
                                            labels.push(
                                              <div
                                                key="masterId"
                                                className="rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-800 border border-blue-400 inline-block"
                                              >
                                                Listen {config.masterId}
                                              </div>
                                            );
                                          }
                                        }

                                        // Si no hay configuraciones específicas, no mostrar nada
                                        return labels;

                                        return labels;
                                      })()}
                                    </div>
                                  </td>
                                  <td className=" px-4 py-1.5 whitespace-nowrap align-middle actions-column">
                                    {deleteConfirmId === accountToUse.id ? (
                                      <div className="flex space-x-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={confirmDeleteAccount}
                                          disabled={isDeletingAccount === accountToUse.id}
                                          className="bg-red-50  h-9  border border-red-200 text-red-700 hover:bg-red-100"
                                        >
                                          {isDeletingAccount === accountToUse.id
                                            ? 'Deleting...'
                                            : 'Delete'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={cancelDeleteAccount}
                                          disabled={isDeletingAccount === accountToUse.id}
                                          className="bg-white h-9 border-gray-200 text-gray-700 hover:bg-gray-100"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : disconnectConfirmId === accountToUse.id ? (
                                      <div className="flex space-x-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                                          onClick={e => {
                                            e.stopPropagation();
                                            disconnectSlaveAccount(
                                              accountToUse.accountNumber,
                                              masterAccount.accountNumber
                                            );
                                          }}
                                          disabled={isDisconnecting === accountToUse.id}
                                        >
                                          {isDisconnecting === accountToUse.id ? (
                                            <>
                                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent mr-1" />
                                              Disconnecting...
                                            </>
                                          ) : (
                                            <>Disconnect</>
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={e => {
                                            e.stopPropagation();
                                            cancelDisconnectAction();
                                          }}
                                          disabled={isDisconnecting === accountToUse.id}
                                          className="bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex space-x-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                          onClick={e => {
                                            e.stopPropagation();
                                            handleEditAccount(accountToUse);
                                          }}
                                          title="Edit Account"
                                          disabled={isDeletingAccount === accountToUse.id}
                                        >
                                          <Pencil className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                          onClick={e => {
                                            e.stopPropagation();
                                            setDisconnectConfirmId(accountToUse.id);
                                          }}
                                          title="Disconnect from Master"
                                          disabled={
                                            isDeletingAccount === accountToUse.id ||
                                            isDisconnecting === accountToUse.id
                                          }
                                        >
                                          <Unlink className="h-4 w-4 text-orange-600" />
                                        </Button>
                                        {(!accountToUse.connectedToMaster ||
                                          accountToUse.connectedToMaster === 'none') && (
                                          <DeleteButton
                                            accountId={accountToUse.id}
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleDeleteAccount(accountToUse.id);
                                            }}
                                            disabled={isDeletingAccount === accountToUse.id}
                                            title="Delete Account"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}

                  {/* Orphan slave accounts */}
                  {accounts
                    .filter(
                      account =>
                        account.accountType === 'slave' &&
                        (!account.connectedToMaster ||
                          account.connectedToMaster === '' ||
                          account.connectedToMaster === 'none')
                    )
                    .map(orphanSlave => (
                      <tr key={orphanSlave.id} className="hover:bg-muted/50 bg-gray-50">
                        <td className="w-8 px-2 py-2 align-middle"></td>
                        <td className="w-20 px-4 py-2 align-middle">
                          <div className="flex items-center justify-center h-full w-full">
                            <span className="flex items-center justify-center h-5 w-5">
                              {getStatusIcon(orphanSlave.status)}
                            </span>
                          </div>
                        </td>
                        <td className="w-32 px-4 py-2 align-middle">
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={getSlaveEffectiveStatus(orphanSlave.accountNumber)}
                              onCheckedChange={enabled =>
                                toggleAccountStatus(orphanSlave.accountNumber, enabled)
                              }

                              title='Copy trading'
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                          {orphanSlave.accountNumber}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                          <span className="text-orange-600">Slave</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                          {getPlatformDisplayName(orphanSlave.platform)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs align-middle">
                          <div className="flex gap-2 flex-wrap">
                            {(() => {
                              // Buscar la configuración en los datos del CSV
                              let config = null;

                              // Buscar en unconnectedSlaves
                              if (csvAccounts?.unconnectedSlaves) {
                                const slave = csvAccounts.unconnectedSlaves.find(
                                  s =>
                                    s.id === orphanSlave.accountNumber ||
                                    s.name === orphanSlave.accountNumber
                                );
                                if (slave) {
                                  config = slave.config;
                                }
                              }

                              // Si no se encuentra en unconnectedSlaves, buscar en slaveConfigs como fallback
                              if (!config) {
                                const slaveConfig =
                                  slaveConfigs[orphanSlave.accountNumber] ||
                                  slaveConfigs[orphanSlave.id];
                                config = slaveConfig?.config;
                              }


                              const labels = [];

                              if (config) {
                                // Fixed lot tiene prioridad sobre multiplier
                                if (config.forceLot && config.forceLot > 0) {
                                  labels.push(
                                    <div
                                      key="forceLot"
                                      className="rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-800 border border-blue-400 inline-block"
                                    >
                                      {config.forceLot} Lot
                                    </div>
                                  );
                                } else if (config.lotMultiplier) {
                                  // Solo mostrar multiplier si no hay fixed lot
                                  labels.push(
                                    <div
                                      key="lotMultiplier"
                                      className="rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-800 border border-green-400 inline-block"
                                    >
                                      {config.lotMultiplier}x
                                    </div>
                                  );
                                }

                                // Reverse trading (siempre mostrar si está habilitado)
                                if (config.reverseTrading) {
                                  labels.push(
                                    <div
                                      key="reverseTrading"
                                      className="rounded-full px-2 py-0.5 text-xs bg-purple-100 text-purple-800 border border-purple-400 inline-block"
                                    >
                                      Reverse
                                    </div>
                                  );
                                }

                                // Max lot size (solo si está configurado)
                                if (config.maxLotSize && config.maxLotSize > 0) {
                                  labels.push(
                                    <div
                                      key="maxLotSize"
                                      className="rounded-full px-2 py-0.5 text-xs bg-orange-100 text-orange-800 border border-orange-400 inline-block"
                                    >
                                      Max {config.maxLotSize}
                                    </div>
                                  );
                                }

                                // Min lot size (solo si está configurado)
                                if (config.minLotSize && config.minLotSize > 0) {
                                  labels.push(
                                    <div
                                      key="minLotSize"
                                      className="rounded-full px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 border border-yellow-400 inline-block"
                                    >
                                      Min {config.minLotSize}
                                    </div>
                                  );
                                }

                                // Symbol filtering (solo si hay símbolos permitidos o bloqueados)
                                if (config.allowedSymbols && config.allowedSymbols.length > 0) {
                                  labels.push(
                                    <div
                                      key="allowedSymbols"
                                      className="rounded-full px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 border border-indigo-400 inline-block"
                                    >
                                      {config.allowedSymbols.length} symbols
                                    </div>
                                  );
                                }

                                if (config.blockedSymbols && config.blockedSymbols.length > 0) {
                                  labels.push(
                                    <div
                                      key="blockedSymbols"
                                      className="rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-800 border border-red-400 inline-block"
                                    >
                                      {config.blockedSymbols.length} blocked
                                    </div>
                                  );
                                }

                                // Order type filtering (solo si hay tipos permitidos o bloqueados)
                                if (
                                  config.allowedOrderTypes &&
                                  config.allowedOrderTypes.length > 0
                                ) {
                                  labels.push(
                                    <div
                                      key="allowedOrderTypes"
                                      className="rounded-full px-2 py-0.5 text-xs bg-teal-100 text-teal-800 border border-teal-400 inline-block"
                                    >
                                      {config.allowedOrderTypes.length} order types
                                    </div>
                                  );
                                }

                                if (
                                  config.blockedOrderTypes &&
                                  config.blockedOrderTypes.length > 0
                                ) {
                                  labels.push(
                                    <div
                                      key="blockedOrderTypes"
                                      className="rounded-full px-2 py-0.5 text-xs bg-pink-100 text-pink-800 border border-pink-400 inline-block"
                                    >
                                      {config.blockedOrderTypes.length} blocked types
                                    </div>
                                  );
                                }

                                // Trading hours (solo si está habilitado)
                                if (config.tradingHours && config.tradingHours.enabled) {
                                  labels.push(
                                    <div
                                      key="tradingHours"
                                      className="rounded-full px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 border border-cyan-400 inline-block"
                                    >
                                      Trading Hours
                                    </div>
                                  );
                                }
                              }

                              return labels;
                            })()}
                          </div>
                        </td>
                        <td className="w-32 px-4 py-2 whitespace-nowrap align-middle actions-column">
                          {deleteConfirmId === orphanSlave.id ? (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={confirmDeleteAccount}
                                disabled={isDeletingAccount === orphanSlave.id}
                                className="bg-red-50 border h-9 border-red-200 text-red-700 hover:bg-red-100"
                              >
                                {isDeletingAccount === orphanSlave.id ? 'Deleting...' : 'Delete'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelDeleteAccount}
                                disabled={isDeletingAccount === orphanSlave.id}
                                className="bg-white h-9 border-gray-200 text-gray-700 hover:bg-gray-100"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleEditAccount(orphanSlave);
                                }}
                                title="Edit Account"
                                disabled={isDeletingAccount === orphanSlave.id}
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <DeleteButton
                                accountId={orphanSlave.id}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDeleteAccount(orphanSlave.id);
                                }}
                                disabled={isDeletingAccount === orphanSlave.id}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const TradingAccountsConfig = memo(TradingAccountsConfigComponent);
