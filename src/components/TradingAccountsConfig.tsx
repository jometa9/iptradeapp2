import React, { useEffect, useRef, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  HousePlug,
  Info,
  Pencil,
  Power,
  PowerOff,
  SaveIcon,
  Shield,
  Trash,
  Unlink,
  Unplug,
  WifiOff,
  XCircle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useRealTimeEvents } from '../hooks/useRealTimeEvents';
import {
  canCreateMoreAccounts,
  canCustomizeLotSizes,
  getAccountLimitMessage,
  getLotSizeMessage,
  getPlanDisplayName,
  isUnlimitedPlan,
  shouldShowSubscriptionLimitsCard,
  validateLotSize,
} from '../lib/subscriptionUtils';
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
  connectedToMaster?: string;
  connectedSlaves?: Array<{ id: string; name: string; platform: string }>;
  totalSlaves?: number;
}

interface MasterAccountStatus {
  masterStatus: boolean;
  effectiveStatus: boolean;
  status: string;
}

interface CopierStatus {
  globalStatus: boolean;
  globalStatusText: string;
  masterAccounts: Record<string, MasterAccountStatus>;
}

interface SlaveConfig {
  config: {
    enabled: boolean;
    lotMultiplier?: number;
    forceLot?: number | null;
    reverseTrading?: boolean;
    description?: string;
  };
}

interface ApiAccountData {
  id: string;
  platform?: string;
  broker?: string;
  status?: string;
  connectedSlaves?: ApiAccountData[];
  totalSlaves?: number;
}

interface ApiResponse {
  masterAccounts?: Record<string, ApiAccountData>;
  unconnectedSlaves?: ApiAccountData[];
}

export function TradingAccountsConfig() {
  const { toast: toastUtil } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
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
  const [isLeaving, setIsLeaving] = useState(false);

  // Copier status management
  const [copierStatus, setCopierStatus] = useState<CopierStatus | null>(null);
  const [slaveConfigs, setSlaveConfigs] = useState<Record<string, SlaveConfig>>({});
  const [updatingCopier, setUpdatingCopier] = useState<string | null>(null);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [pendingAccountsCount, setPendingAccountsCount] = useState<number>(0);
  const [connectivityStats, setConnectivityStats] = useState<any>(null);

  // Derived values for subscription limits
  const canAddMoreAccounts = userInfo ? canCreateMoreAccounts(userInfo, accounts.length) : false;
  const planDisplayName = userInfo ? getPlanDisplayName(userInfo.subscriptionType) : 'Free';
  const canCustomizeLotSizesValue = userInfo ? canCustomizeLotSizes(userInfo) : false;

  // Platform mapping function
  const getPlatformDisplayName = (platform: string): string => {
    const platformMap: Record<string, string> = {
      MT4: 'MetaTrader 4',
      MT5: 'MetaTrader 5',
      cTrader: 'cTrader',
      TradingView: 'TradingView',
      NinjaTrader: 'NinjaTrader',
      Other: 'Other Platform',
      mt4: 'MetaTrader 4',
      mt5: 'MetaTrader 5',
    };
    return platformMap[platform] || platform || 'Unknown';
  };

  // Real-time events system
  const { isConnected: isEventsConnected, refresh: refreshEvents } = useRealTimeEvents(event => {
    console.log('📨 Evento recibido:', event);

    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'account_converted':
      case 'account_created':
      case 'account_deleted':
      case 'trading_config_created':
        // Actualizar cuentas inmediatamente cuando hay cambios
        fetchAccounts(false);
        fetchPendingAccountsCount();
        loadCopierData();

        // Mostrar notificación
        if (event.type === 'account_converted') {
          toastUtil({
            title: 'Cuenta Convertida',
            description: `Cuenta ${event.data.accountId} convertida de ${event.data.fromType} a ${event.data.toType}`,
          });
        } else if (event.type === 'account_created') {
          toastUtil({
            title: 'Cuenta Creada',
            description: `Nueva cuenta ${event.data.accountType}: ${event.data.accountId}`,
          });
        } else if (event.type === 'trading_config_created') {
          toastUtil({
            title: 'Configuración Creada',
            description: `Configuración de trading creada para ${event.data.accountId}`,
          });
        }
        break;

      case 'account_status_changed':
      case 'copier_status_changed':
        // Actualizar datos de copier cuando cambie el estado
        loadCopierData();
        break;
    }
  });

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
    connectedToMaster: 'none',
  });

  const formRef = useRef<HTMLDivElement>(null);

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
  ];

  // Eliminado el useEffect que ocultaba la tarjeta automáticamente

  // Fetch accounts from API
  const fetchAccounts = async (showLoadingState = false) => {
    try {
      if (showLoadingState) {
        setIsLoading(true);
      }

      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';

      // Fetch both accounts data and connectivity stats
      const [accountsResponse, connectivityResponse] = await Promise.all([
        fetch(`http://localhost:${serverPort}/api/accounts/all`, {
          headers: {
            'x-api-key': secretKey || '',
          },
        }),
        fetch(`http://localhost:${serverPort}/api/accounts/connectivity`, {
          headers: {
            'x-api-key': secretKey || '',
          },
        }),
      ]);

      console.log('🔍 Response status:', {
        accounts: accountsResponse.status,
        connectivity: connectivityResponse.status,
      });

      if (!accountsResponse.ok) {
        throw new Error('Failed to fetch trading accounts');
      }

      if (!connectivityResponse.ok) {
        console.error(
          '❌ Connectivity endpoint failed:',
          connectivityResponse.status,
          connectivityResponse.statusText
        );
        throw new Error('Failed to fetch connectivity statistics');
      }

      const data: ApiResponse = await accountsResponse.json();
      const connectivityData = await connectivityResponse.json();

      // Store connectivity stats for use in status calculations
      setConnectivityStats(connectivityData.stats);

      // Debug logs
      console.log('🔍 Connectivity Data:', connectivityData);
      console.log('📊 Connectivity Stats:', connectivityData.stats);
      console.log('📈 Pending count from backend:', connectivityData.stats.pending);

      // Create a map of account statuses from connectivity data
      const accountStatusMap = new Map();
      connectivityData.stats.connectivityDetails.forEach((detail: any) => {
        accountStatusMap.set(detail.accountId, detail.status);
      });

      console.log('🗺️ Account Status Map:', Object.fromEntries(accountStatusMap));

      // Handle the actual format returned by the backend
      const allAccounts: TradingAccount[] = [];

      // Helper function to map backend status to frontend status
      const mapStatus = (
        accountId: string,
        backendStatus: string,
        accountType: string,
        connectedSlaves?: any[],
        connectedToMaster?: string
      ) => {
        // Use the status from connectivity data if available
        if (accountStatusMap.has(accountId)) {
          return accountStatusMap.get(accountId);
        }

        // Fallback to frontend calculation
        if (accountType === 'master') {
          if (connectedSlaves && connectedSlaves.length > 0) {
            return 'synchronized';
          } else if (backendStatus === 'active') {
            return 'pending';
          }
        } else if (accountType === 'slave') {
          if (connectedToMaster && connectedToMaster !== 'none') {
            return 'synchronized';
          } else if (backendStatus === 'active') {
            return 'pending';
          }
        }

        switch (backendStatus) {
          case 'pending':
            return 'pending';
          case 'offline':
            return 'offline';
          case 'error':
            return 'error';
          default:
            return 'pending';
        }
      };

      // Add master accounts
      if (data.masterAccounts) {
        Object.values(data.masterAccounts).forEach((master: ApiAccountData) => {
          allAccounts.push({
            id: master.id.toString(),
            accountNumber: master.id,
            platform: master.platform || 'MT4',
            server: master.broker || '',
            password: '••••••••',
            accountType: 'master',
            status: mapStatus(
              master.id,
              master.status || 'active',
              'master',
              master.connectedSlaves
            ),
            connectedSlaves: master.connectedSlaves || [],
            totalSlaves: master.totalSlaves || 0,
          });
        });
      }

      // Add connected slaves
      if (data.masterAccounts) {
        Object.values(data.masterAccounts).forEach((master: ApiAccountData) => {
          if (master.connectedSlaves && Array.isArray(master.connectedSlaves)) {
            master.connectedSlaves.forEach((slave: ApiAccountData) => {
              allAccounts.push({
                id: slave.id.toString(),
                accountNumber: slave.id,
                platform: slave.platform || 'MT4',
                server: slave.broker || '',
                password: '••••••••',
                accountType: 'slave',
                status: mapStatus(
                  slave.id,
                  slave.status || 'active',
                  'slave',
                  undefined,
                  master.id
                ),
                connectedToMaster: master.id,
              });
            });
          }
        });
      }

      // Add unconnected slaves
      if (data.unconnectedSlaves && Array.isArray(data.unconnectedSlaves)) {
        data.unconnectedSlaves.forEach((slave: ApiAccountData) => {
          allAccounts.push({
            id: slave.id.toString(),
            accountNumber: slave.id,
            platform: slave.platform || 'MT4',
            server: slave.broker || '',
            password: '••••••••',
            accountType: 'slave',
            status: mapStatus(slave.id, slave.status || 'active', 'slave', undefined, 'none'),
            connectedToMaster: 'none',
          });
        });
      }

      setAccounts(allAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      if (showLoadingState) {
        toastUtil({
          title: 'Error',
          description: 'Failed to load trading accounts. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
    }
  };

  // Fetch pending accounts count
  const fetchPendingAccountsCount = async () => {
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(`http://localhost:${serverPort}/api/accounts/pending`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingAccountsCount(data.totalPending || 0);
      } else {
        console.error('Failed to fetch pending accounts count');
      }
    } catch (error) {
      console.error('Error loading pending accounts count:', error);
    }
  };

  useEffect(() => {
    fetchAccounts(true);
    fetchPendingAccountsCount();
    loadCopierData();

    // Polling de respaldo cada 5 segundos cuando los eventos no están conectados
    // Los eventos en tiempo real manejan la mayoría de actualizaciones
    const interval = setInterval(() => {
      if (!isEventsConnected) {
        console.log('⚠️ Eventos desconectados, usando polling de respaldo');
        fetchAccounts(false);
        fetchPendingAccountsCount();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isEventsConnected]);

  // Polling adicional cada 3 segundos para asegurar actualizaciones rápidas
  useEffect(() => {
    const quickInterval = setInterval(() => {
      fetchAccounts(false);
      fetchPendingAccountsCount();
    }, 3000);

    return () => clearInterval(quickInterval);
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

  // Load copier status and slave configurations
  const loadCopierData = async () => {
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const baseUrl = `http://localhost:${serverPort}/api`;

      // Load copier status
      const copierResponse = await fetch(`${baseUrl}/copier/status`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (copierResponse.ok) {
        const copierData = await copierResponse.json();
        setCopierStatus(copierData);
      }

      // Load slave configurations for all slave accounts
      const slaveAccounts = accounts.filter(acc => acc.accountType === 'slave');
      const slaveConfigPromises = slaveAccounts.map(async slave => {
        try {
          const response = await fetch(`${baseUrl}/slave-config/${slave.accountNumber}`, {
            headers: {
              'x-api-key': secretKey || '',
            },
          });
          if (response.ok) {
            const config = await response.json();
            return { [slave.accountNumber]: config };
          }
        } catch (error) {
          console.error(`Failed to load config for slave ${slave.accountNumber}:`, error);
        }
        return {};
      });

      const slaveConfigResults = await Promise.all(slaveConfigPromises);
      const mergedSlaveConfigs = Object.assign({}, ...slaveConfigResults);
      setSlaveConfigs(mergedSlaveConfigs);
    } catch (error) {
      console.error('Error loading copier data:', error);
    }
  };

  // Toggle global copier status
  const toggleGlobalStatus = async (enabled: boolean) => {
    // If disabling, show confirmation buttons instead of switch
    if (!enabled) {
      setShowGlobalConfirm(true);
      return;
    }

    await performGlobalToggle(enabled);
  };

  // Perform the actual global toggle operation
  const performGlobalToggle = async (enabled: boolean) => {
    try {
      setUpdatingCopier('global');
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';

      // If disabling global copier, first disable all individual accounts
      if (!enabled) {
        // Get all master accounts that are currently enabled
        const enabledMasters = Object.entries(copierStatus?.masterAccounts || {})
          .filter(([, status]) => status.masterStatus)
          .map(([masterId]) => masterId);

        // Get all slave accounts that are currently enabled
        const enabledSlaves = Object.entries(slaveConfigs || {})
          .filter(([, config]) => config.config?.enabled !== false)
          .map(([slaveId]) => slaveId);

        // Disable all masters
        for (const masterId of enabledMasters) {
          await fetch(`http://localhost:${serverPort}/api/copier/master`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': secretKey || '',
            },
            body: JSON.stringify({ masterAccountId: masterId, enabled: false }),
          });
        }

        // Disable all slaves
        for (const slaveId of enabledSlaves) {
          await fetch(`http://localhost:${serverPort}/api/slave-config`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': secretKey || '',
            },
            body: JSON.stringify({ slaveAccountId: slaveId, enabled: false }),
          });
        }

        // Update local state to reflect all accounts are now disabled
        setCopierStatus(prev => {
          if (!prev) return null;

          const updatedMasters: Record<string, MasterAccountStatus> = {};
          Object.keys(prev.masterAccounts || {}).forEach(masterId => {
            updatedMasters[masterId] = {
              ...prev.masterAccounts[masterId],
              masterStatus: false,
              effectiveStatus: false,
              status: 'OFF',
            };
          });

          return {
            ...prev,
            globalStatus: false,
            globalStatusText: 'OFF',
            masterAccounts: updatedMasters,
          };
        });

        // Update slave configs to disabled
        setSlaveConfigs(prev => {
          const updatedConfigs: Record<string, SlaveConfig> = {};
          Object.entries(prev).forEach(([slaveId, config]) => {
            updatedConfigs[slaveId] = {
              ...config,
              config: {
                ...config.config,
                enabled: false,
              },
            };
          });
          return updatedConfigs;
        });
      }

      // Now update global status
      const response = await fetch(`http://localhost:${serverPort}/api/copier/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        const result = await response.json();

        // Immediately update local state for responsive UI
        setCopierStatus(prev => {
          if (!prev) return null;

          return {
            ...prev,
            globalStatus: enabled,
            globalStatusText: enabled ? 'ON' : 'OFF',
          };
        });

        toastUtil({
          title: 'Success',
          description: enabled
            ? result.message
            : 'Global copier and all individual accounts have been disabled',
        });

        // Reload copier data after a small delay to ensure server has updated
        setTimeout(() => {
          loadCopierData();
        }, 500);
      } else {
        throw new Error('Failed to update global copier status');
      }
    } catch (error) {
      console.error('Error updating global status:', error);
      toastUtil({
        title: 'Error',
        description: 'Failed to update global copier status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingCopier(null);
      setShowGlobalConfirm(false);
    }
  };

  // Cancel global copier disable confirmation
  const cancelGlobalDisable = () => {
    setShowGlobalConfirm(false);
  };

  // Toggle master account copier status
  const toggleMasterStatus = async (masterAccountId: string, enabled: boolean) => {
    try {
      setUpdatingCopier(`master-${masterAccountId}`);
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(`http://localhost:${serverPort}/api/copier/master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify({ masterAccountId, enabled }),
      });

      if (response.ok) {
        const result = await response.json();
        toastUtil({
          title: 'Success',
          description: result.message,
        });
        loadCopierData(); // Reload copier data
      } else {
        throw new Error('Failed to update master copier status');
      }
    } catch (error) {
      console.error('Error updating master status:', error);
      toastUtil({
        title: 'Error',
        description: 'Failed to update master copier status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingCopier(null);
    }
  };

  // Toggle slave account copier status
  const toggleSlaveStatus = async (slaveAccountId: string, enabled: boolean) => {
    try {
      setUpdatingCopier(`slave-${slaveAccountId}`);
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(`http://localhost:${serverPort}/api/slave-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify({ slaveAccountId, enabled }),
      });

      if (response.ok) {
        toastUtil({
          title: 'Success',
          description: `Slave ${slaveAccountId} ${enabled ? 'enabled' : 'disabled'}`,
        });
        loadCopierData(); // Reload copier data
      } else {
        throw new Error('Failed to update slave status');
      }
    } catch (error) {
      console.error('Error updating slave status:', error);
      toastUtil({
        title: 'Error',
        description: 'Failed to update slave status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingCopier(null);
    }
  };

  // Get effective copier status for master account
  const getMasterEffectiveStatus = (masterAccountId: string) => {
    if (!copierStatus) return false;
    const masterStatus = copierStatus.masterAccounts?.[masterAccountId];
    return copierStatus.globalStatus && masterStatus?.masterStatus !== false;
  };

  // Get effective copier status for slave account
  const getSlaveEffectiveStatus = (slaveAccountId: string, masterAccountId?: string) => {
    if (!copierStatus) return false;
    const slaveConfig = slaveConfigs[slaveAccountId];
    const slaveEnabled = slaveConfig?.config?.enabled !== false;
    // If slave is not connected to a master, it can never be active
    if (!masterAccountId || masterAccountId === '' || masterAccountId === 'none') {
      return false;
    }
    // If slave is connected to a master, check master status too
    const masterStatus = getMasterEffectiveStatus(masterAccountId);
    return copierStatus.globalStatus && masterStatus && slaveEnabled;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === 'accountType' && value === 'master') {
      setFormState({ ...formState, [name]: value, status: 'synchronized' });
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

    // Preparar el formulario con los datos de la cuenta
    setFormState({
      accountNumber: account.accountNumber,
      platform: account.platform.toLowerCase(),
      serverIp: account.server,
      password: '', // Password not needed for backend operations
      accountType: account.accountType,
      status: account.status,
      lotCoefficient: account.lotCoefficient || 1,
      forceLot: account.forceLot || 0,
      reverseTrade: account.reverseTrade || false,
      connectedToMaster: account.connectedToMaster || 'none',
    });

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeleteAccount = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmId) {
      try {
        setIsSubmitting(true);
        setIsDeletingAccount(deleteConfirmId);

        const serverPort = import.meta.env.VITE_SERVER_PORT || '30';

        // Find the account to determine if it's master or slave
        const accountToDelete = accounts.find(acc => acc.id === deleteConfirmId);
        if (!accountToDelete) {
          throw new Error('Account not found');
        }

        const endpoint =
          accountToDelete.accountType === 'master'
            ? `http://localhost:${serverPort}/api/accounts/master/${deleteConfirmId}`
            : `http://localhost:${serverPort}/api/accounts/slave/${deleteConfirmId}`;

        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'x-api-key': secretKey || '',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to delete trading account');
        }

        await fetchAccounts();
        await fetchPendingAccountsCount();

        toastUtil({
          title: 'Account Deleted',
          description: 'The account has been removed successfully.',
        });
      } catch (error) {
        console.error('Error deleting account:', error);
        toastUtil({
          title: 'Error',
          description: 'Failed to delete trading account. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
        setIsDeletingAccount(null);
        setDeleteConfirmId(null);
      }
    }
  };

  const cancelDeleteAccount = () => {
    setDeleteConfirmId(null);
  };

  const disconnectSlaveAccount = async (slaveAccountId: string) => {
    try {
      setIsDisconnecting(slaveAccountId);
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(
        `http://localhost:${serverPort}/api/accounts/disconnect/${slaveAccountId}`,
        {
          method: 'DELETE',
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
      console.error('Error disconnecting slave account:', error);
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
      const slaveIds = accounts
        .filter(acc => acc.accountType === 'slave' && acc.connectedToMaster === masterAccountId)
        .map(acc => acc.id);

      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const disconnectPromises = slaveIds.map(slaveId =>
        fetch(`http://localhost:${serverPort}/api/accounts/disconnect/${slaveId}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': secretKey || '',
          },
        })
      );

      await Promise.all(disconnectPromises);

      toastUtil({
        title: 'Success',
        description: `All ${slaveIds.length} slave accounts disconnected successfully`,
      });
      setDisconnectAllConfirmId(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error disconnecting all slaves:', error);
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

    // Validate lot size for free users
    if (userInfo && formState.accountType === 'slave') {
      if (formState.forceLot > 0) {
        const lotValidation = validateLotSize(userInfo, formState.forceLot);
        if (!lotValidation.valid) {
          toastUtil({
            title: 'Invalid Lot Size',
            description: lotValidation.error,
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
      }
    }

    // Check if user can add more accounts (only for new accounts)
    if (!editingAccount && !canAddMoreAccounts) {
      toastUtil({
        title: 'Account Limit Reached',
        description: `Your ${planDisplayName} plan has reached its account limit. Please upgrade to add more accounts.`,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    if (!formState.accountNumber || !formState.serverIp) {
      toastUtil({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      let response;
      let payload;

      if (formState.accountType === 'master') {
        payload = {
          masterAccountId: formState.accountNumber,
          name: formState.accountNumber,
          description: '',
          broker: formState.serverIp,
          platform: formState.platform.toUpperCase(),
        };

        // Si estamos editando una cuenta slave y la convertimos a master
        if (editingAccount && editingAccount.accountType === 'slave') {
          // Primero eliminamos la cuenta slave
          await fetch(`http://localhost:${serverPort}/api/accounts/slave/${editingAccount.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });

          // Luego creamos la cuenta master
          response = await fetch(`http://localhost:${serverPort}/api/accounts/master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else if (editingAccount) {
          response = await fetch(
            `http://localhost:${serverPort}/api/accounts/master/${editingAccount.id}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
        } else {
          response = await fetch(`http://localhost:${serverPort}/api/accounts/master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
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

        // Si estamos editando una cuenta master y la convertimos a slave
        if (editingAccount && editingAccount.accountType === 'master') {
          // Primero eliminamos la cuenta master
          await fetch(`http://localhost:${serverPort}/api/accounts/master/${editingAccount.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });

          // Luego creamos la cuenta slave
          response = await fetch(`http://localhost:${serverPort}/api/accounts/slave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else if (editingAccount && editingAccount.accountType === 'slave') {
          // Para edición de cuentas slave, solo enviamos los datos de conexión
          payload = {
            slaveAccountId: editingAccount.accountNumber,
            name: editingAccount.accountNumber,
            description: '',
            broker: editingAccount.server, // Mantenemos el valor original
            platform: editingAccount.platform, // Mantenemos el valor original
            ...(formState.connectedToMaster !== 'none' &&
              formState.connectedToMaster !== '' && {
                masterAccountId: formState.connectedToMaster,
              }),
          };

          response = await fetch(
            `http://localhost:${serverPort}/api/accounts/slave/${editingAccount.id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': secretKey || '',
              },
              body: JSON.stringify(payload),
            }
          );
        } else {
          response = await fetch(`http://localhost:${serverPort}/api/accounts/slave`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': secretKey || '',
            },
            body: JSON.stringify(payload),
          });
        }

        // If it's a slave account with specific configurations, set them after creating the account
        if (
          response.ok &&
          (formState.lotCoefficient !== 1 || formState.forceLot > 0 || formState.reverseTrade)
        ) {
          const slaveConfigPayload = {
            slaveAccountId: editingAccount ? editingAccount.accountNumber : formState.accountNumber,
            lotMultiplier: Number(formState.lotCoefficient),
            forceLot: Number(formState.forceLot) > 0 ? Number(formState.forceLot) : null,
            reverseTrading: formState.reverseTrade,
            enabled: true,
            description: 'Auto-configured from frontend',
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save trading account');
      }

      await fetchAccounts();
      await fetchPendingAccountsCount();

      toastUtil({
        title: editingAccount ? 'Account Updated' : 'Account Created',
        description: `Your trading account has been ${editingAccount ? 'updated' : 'created'} successfully.`,
      });

      handleCancel();
    } catch (error) {
      console.error('Error saving account:', error);
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
      const { slaves, masters, pending, offline } = connectivityStats;
      const relevantTotal = slaves.total + masters.total + pending + offline;

      if (relevantTotal === 0) return 'none';

      const offlinePercentage = (offline / relevantTotal) * 100;
      const pendingPercentage = (pending / relevantTotal) * 100;

      // Priority: offline > pending > mixed > optimal
      if (offlinePercentage > 50 || offline > slaves.total + masters.total) {
        return 'offline';
      }

      if (pendingPercentage > 40 || pending > slaves.total + masters.total) {
        return 'pending';
      }

      if (offline > 0 || pending > 0) {
        return 'mixed';
      }

      if (offline === 0 && pending === 0) {
        return 'optimal';
      }

      return 'warning';
    }

    // Fallback to frontend calculation
    const slavesCount = accounts.filter(acc => acc.accountType === 'slave').length;
    const mastersCount = accounts.filter(acc => acc.accountType === 'master').length;
    const offlineCount = accounts.filter(acc => acc.status === 'offline').length;
    const pendingCount = accounts.filter(acc => acc.status === 'pending').length;
    const relevantTotal = slavesCount + mastersCount + offlineCount + pendingCount;

    if (relevantTotal === 0) return 'none';

    const offlinePercentage = (offlineCount / relevantTotal) * 100;
    const pendingPercentage = (pendingCount / relevantTotal) * 100;

    // Priority: offline > pending > mixed > optimal
    if (offlinePercentage > 50 || offlineCount > slavesCount + mastersCount) {
      return 'offline';
    }

    if (pendingPercentage > 40 || pendingCount > slavesCount + mastersCount) {
      return 'pending';
    }

    if (offlineCount > 0 || pendingCount > 0) {
      return 'mixed';
    }

    if (offlineCount === 0 && pendingCount === 0) {
      return 'optimal';
    }

    return 'warning';
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
      const { slaves, masters, pending, offline } = connectivityStats;
      const relevantTotal = slaves.total + masters.total + pending + offline;

      if (relevantTotal === 0) {
        return {
          message: 'No relevant accounts found',
          recommendation: 'Add master or slave accounts to get started',
          severity: 'info',
        };
      }

      const slavesPercentage = Math.round((slaves.total / relevantTotal) * 100);
      const mastersPercentage = Math.round((masters.total / relevantTotal) * 100);
      const offlinePercentage = Math.round((offline / relevantTotal) * 100);
      const pendingPercentage = Math.round((pending / relevantTotal) * 100);

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
        case 'warning':
          return {
            message: 'Some accounts may need attention',
            recommendation: 'Review account connections and statuses',
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
    const slavesCount = accounts.filter(acc => acc.accountType === 'slave').length;
    const mastersCount = accounts.filter(acc => acc.accountType === 'master').length;
    const offlineCount = accounts.filter(acc => acc.status === 'offline').length;
    const pendingCount = accounts.filter(acc => acc.status === 'pending').length;
    const relevantTotal = slavesCount + mastersCount + offlineCount + pendingCount;

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
      case 'warning':
        return {
          message: 'Some accounts may need attention',
          recommendation: 'Review account connections and statuses',
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
    setCollapsedMasters(prev => ({
      ...prev,
      [masterId]: !prev[masterId],
    }));
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

  const fadeInDownAnimation = {
    opacity: 1,
    animation: 'fadeInDown 0.25s ease-out',
    transition: 'opacity 0.3s, transform 0.3s',
  };
  const fadeOutAnimation = {
    opacity: 0,
    transition: 'opacity 0.25s, transform 0.25s',
  };

  return (
    <div className="space-y-6">
      {/* Logs de depuración */}
      {userInfo &&
        (() => {
          console.log('🔍 TradingAccountsConfig - Render', {
            subscriptionType: userInfo.subscriptionType,
            isUnlimitedPlan: isUnlimitedPlan(userInfo),
            shouldShowSubscriptionLimitsCard: shouldShowSubscriptionLimitsCard(
              userInfo,
              accounts.length
            ),
            currentAccountCount: accounts.length,
          });
          return null;
        })()}

      {/* Subscription Info Card para planes con límites */}
      {userInfo && shouldShowSubscriptionLimitsCard(userInfo, accounts.length) && (
        <Card
          className="border-yellow-400 bg-yellow-50 flex items-center p-4 gap-3"
          style={isLeaving ? fadeOutAnimation : fadeInDownAnimation}
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
              <CardTitle>Trading Accounts Configuration</CardTitle>
              <CardDescription className="text-sm text-gray-400 mt-2">
                Manage your trading accounts and copy trading configuration
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Global Copier Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-900" />
                <div>
                  <h3 className="font-semibold text-blue-900">Global Copier Status</h3>
                  <p className="text-sm text-blue-900">Master control for all copying operations</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showGlobalConfirm && getStatusBadge(copierStatus?.globalStatus || false)}
                {showGlobalConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                      onClick={() => performGlobalToggle(false)}
                      disabled={updatingCopier === 'global'}
                    >
                      <Unplug className="h-4 w-4 mr-2" />
                      {updatingCopier === 'global' ? 'Stopping...' : 'Stop'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                      onClick={cancelGlobalDisable}
                      disabled={updatingCopier === 'global'}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Switch
                    checked={copierStatus?.globalStatus || false}
                    onCheckedChange={toggleGlobalStatus}
                    disabled={updatingCopier === 'global'}
                  />
                )}
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
                    ? 'bg-blue-50 border-blue-200'
                    : getServerStatus() === 'mixed'
                      ? 'bg-orange-50 border-orange-200'
                      : getServerStatus() === 'warning'
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
                      case 'warning':
                        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
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
                            : getServerStatus() === 'warning'
                              ? 'Some Issues'
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
            <div className="grid grid-cols-5 gap-4 p-4 px-6">
              {/* Slaves */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-green-200 shadow-sm">
                <div className="text-2xl font-bold text-green-700">
                  {connectivityStats
                    ? connectivityStats.slaves.total
                    : accounts.filter(acc => acc.accountType === 'slave').length}
                </div>
                <div className="text-xs text-green-700 text-center">Slaves</div>
              </div>

              {/* Masters */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="text-2xl font-bold text-blue-700">
                  {connectivityStats
                    ? connectivityStats.masters.total
                    : accounts.filter(acc => acc.accountType === 'master').length}
                </div>
                <div className="text-xs text-blue-700 text-center">Masters</div>
              </div>

              {/* Pending */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-orange-200 shadow-sm">
                <div className="text-2xl font-bold text-orange-700">
                  {(() => {
                    const pendingValue = connectivityStats
                      ? connectivityStats.pending
                      : accounts.filter(acc => acc.status === 'pending').length;
                    console.log(
                      'Pending value:',
                      pendingValue,
                      'connectivityStats:',
                      !!connectivityStats
                    );
                    return pendingValue;
                  })()}
                </div>
                <div className="text-xs text-orange-700 text-center">Pendings</div>
              </div>

              {/* Offline */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-red-200 shadow-sm">
                <div className="text-2xl font-bold text-red-700">
                  {connectivityStats ? connectivityStats.offline : 0}
                </div>
                <div className="text-xs text-red-700 text-center">Offline</div>
              </div>

              {/* Total */}
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="text-2xl font-bold text-gray-700">
                  {connectivityStats ? connectivityStats.total : accounts.length}
                </div>
                <div className="text-xs text-gray-700 text-center">Total</div>
              </div>
            </div>
          </div>

          {/* Add/Edit Account Form */}
          {(isAddingAccount || editingAccount) && (
            <Card
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
                      ) : (
                        <Unplug className="h-5 w-5" />
                      )}
                      <span>
                        {editingAccount.accountNumber}{' '}
                        {formState.accountType === 'master' ? 'Master' : 'Slave'} Configuration
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
                        // Si estamos editando y solo se muestra el selector de tipo, usar una columna
                        editingAccount &&
                        !(
                          !editingAccount ||
                          (editingAccount &&
                            editingAccount.accountType === 'master' &&
                            formState.accountType === 'master')
                        ) &&
                        !(
                          formState.accountType === 'slave' &&
                          (!editingAccount || editingAccount.accountType === 'slave')
                        )
                          ? 'grid-cols-1'
                          : 'grid-cols-1 md:grid-cols-2'
                      }`}
                    >
                      {/* Para cuentas nuevas o cuentas master existentes, mostrar todos los campos */}
                      {(!editingAccount ||
                        (editingAccount &&
                          editingAccount.accountType === 'master' &&
                          formState.accountType === 'master')) && (
                        <>
                          <div>
                            <Label htmlFor="accountNumber">Account Number</Label>
                            <Input
                              id="accountNumber"
                              name="accountNumber"
                              value={formState.accountNumber}
                              onChange={handleChange}
                              placeholder="12345678"
                              required
                              className="bg-white border border-gray-200"
                            />
                          </div>

                          <div>
                            <Label htmlFor="platform">Platform</Label>
                            <Select
                              name="platform"
                              value={formState.platform}
                              onValueChange={value => handlePlatformChange(value)}
                            >
                              <SelectTrigger className="bg-white border border-gray-200 shadow-sm cursor-pointer">
                                <SelectValue placeholder="Select Platform" className="bg-white" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border border-gray-200">
                                {platformOptions.map(option => (
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
                          </div>

                          <div>
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                              <Input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={formState.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required={!editingAccount}
                                className="bg-white pr-10 border border-gray-200 shadow-sm"
                              />
                              <button
                                type="button"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-gray-100 focus:outline-none rounded-r-md"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-500" />
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      <div
                        className={
                          // Si estamos editando y solo se muestra el selector de tipo, hacer que ocupe todo el ancho
                          editingAccount &&
                          !(
                            !editingAccount ||
                            (editingAccount &&
                              editingAccount.accountType === 'master' &&
                              formState.accountType === 'master')
                          ) &&
                          !(
                            formState.accountType === 'slave' &&
                            (!editingAccount || editingAccount.accountType === 'slave')
                          )
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
                      </div>

                      {formState.accountType === 'slave' &&
                        (!editingAccount || editingAccount.accountType === 'slave') && (
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
                                  <SelectItem
                                    value="none"
                                    className="cursor-pointer hover:bg-gray-50"
                                  >
                                    Not Connected
                                  </SelectItem>
                                  {accounts
                                    .filter(acc => acc.accountType === 'master')
                                    .map(masterAcc => (
                                      <SelectItem
                                        key={masterAcc.id}
                                        value={masterAcc.accountNumber}
                                        className="bg-white cursor-pointer hover:bg-gray-50"
                                      >
                                        {masterAcc.accountNumber} (
                                        {masterAcc.platform.toUpperCase()} - {masterAcc.server})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label htmlFor="lotCoefficient">
                                Lot Size Coefficient
                                {!canCustomizeLotSizesValue && ' (Fixed at 1.0 for Free plan)'}
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
                                    ? formState.lotCoefficient?.toString() || '1'
                                    : '1'
                                }
                                onChange={e =>
                                  setFormState({
                                    ...formState,
                                    lotCoefficient: canCustomizeLotSizesValue
                                      ? e.target.value === ''
                                        ? 1
                                        : parseFloat(e.target.value)
                                      : 1,
                                  })
                                }
                                disabled={!canCustomizeLotSizesValue}
                                className="bg-white border border-gray-200 shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {canCustomizeLotSizesValue
                                  ? 'Multiplies the lot size from the master account'
                                  : 'Free plan users cannot customize lot multipliers'}
                              </p>
                            </div>

                            <div>
                              <Label htmlFor="forceLot">
                                Force Fixed Lot Size
                                {!canCustomizeLotSizesValue && ' (Fixed at 0.01 for Free plan)'}
                              </Label>
                              <Input
                                id="forceLot"
                                name="forceLot"
                                type="number"
                                min="0"
                                max={canCustomizeLotSizesValue ? '100' : '0.01'}
                                step="0.01"
                                value={
                                  canCustomizeLotSizesValue
                                    ? formState.forceLot?.toString() || '0'
                                    : formState.forceLot > 0
                                      ? '0.01'
                                      : '0'
                                }
                                onChange={e => {
                                  const value =
                                    e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  setFormState({
                                    ...formState,
                                    forceLot: canCustomizeLotSizesValue
                                      ? value
                                      : value > 0
                                        ? 0.01
                                        : 0,
                                  });
                                }}
                                disabled={!canCustomizeLotSizesValue}
                                className="bg-white border border-gray-200 shadow-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {canCustomizeLotSizesValue
                                  ? 'If set above 0, uses this fixed lot size instead of copying'
                                  : 'Free plan users are limited to 0.01 lot size'}
                              </p>
                            </div>

                            <div className="flex items-center space-x-2 pt-1">
                              <Switch
                                id="reverseTrade"
                                checked={formState.reverseTrade}
                                onCheckedChange={checked =>
                                  setFormState({
                                    ...formState,
                                    reverseTrade: checked,
                                  })
                                }
                              />
                              <Label htmlFor="reverseTrade" className="font-medium cursor-pointer">
                                Reverse trades (Buy → Sell, Sell → Buy)
                              </Label>
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
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500"></div>
                  <p className="text-muted-foreground">Loading your trading accounts...</p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground">No trading accounts configured yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Accounts must be added through the pending accounts section first
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 border rounded-xl border-gray-200 shadow-sm relative overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-8 px-4 py-3 align-middle"></th>
                    <th className="w-20 px-4 py-3 text-center text-xs uppercase align-middle">
                      Status
                    </th>
                    <th className="w-32 px-4 py-3 text-center text-xs uppercase align-middle">
                      Copy Trading
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Account</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Type</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">Platform</th>
                    <th className="px-4 py-3 text-left text-xs uppercase align-middle">
                      Configuration
                    </th>
                    <th className="w-32 px-4 py-3 text-center text-xs uppercase align-middle">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {/* Master accounts */}
                  {accounts
                    .filter(account => account.accountType === 'master')
                    .map(masterAccount => {
                      const connectedSlaves = accounts.filter(
                        acc => acc.connectedToMaster === masterAccount.accountNumber
                      );
                      const hasSlaves = connectedSlaves.length > 0;
                      return (
                        <React.Fragment key={`master-group-${masterAccount.id}`}>
                          <tr
                            className="bg-blue-50 hover:bg-blue-100 cursor-pointer"
                            onClick={e => {
                              if (!(e.target as HTMLElement).closest('.actions-column')) {
                                toggleMasterCollapse(masterAccount.id);
                              }
                            }}
                          >
                            <td className="w-8 pl-6 py-2 align-middle">
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
                            <td className="w-20 py-2 align-middle">
                              <div className="flex items-center justify-center h-full w-full">
                                <Tooltip tip={getStatusDisplayText(masterAccount.status)}>
                                  <span className="flex items-center justify-center h-5 w-5">
                                    {getStatusIcon(masterAccount.status)}
                                  </span>
                                </Tooltip>
                              </div>
                            </td>
                            <td className="w-32 px-4 py-2 align-middle">
                              <div className="flex items-center justify-center">
                                <Switch
                                  checked={getMasterEffectiveStatus(masterAccount.accountNumber)}
                                  onCheckedChange={enabled =>
                                    toggleMasterStatus(masterAccount.accountNumber, enabled)
                                  }
                                  disabled={
                                    updatingCopier === `master-${masterAccount.accountNumber}` ||
                                    !copierStatus?.globalStatus ||
                                    masterAccount.status === 'offline'
                                  }
                                  title={
                                    masterAccount.status === 'offline'
                                      ? 'Account is offline - copy trading disabled'
                                      : !copierStatus?.globalStatus
                                        ? 'Global copier is OFF'
                                        : getMasterEffectiveStatus(masterAccount.accountNumber)
                                          ? 'Stop sending signals to slaves'
                                          : 'Start sending signals to slaves'
                                  }
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                              {masterAccount.accountNumber}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-yellow-700 align-middle">
                              Master
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                              {getPlatformDisplayName(masterAccount.platform)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs align-middle">
                              {accounts.filter(
                                acc => acc.connectedToMaster === masterAccount.accountNumber
                              ).length > 0 ? (
                                <div className="rounded-full px-2 py-0.5 text-xs bg-yellow-100 border border-yellow-400 text-yellow-800 inline-block">
                                  {
                                    accounts.filter(
                                      acc => acc.connectedToMaster === masterAccount.accountNumber
                                    ).length
                                  }{' '}
                                  slave
                                  {accounts.filter(
                                    acc => acc.connectedToMaster === masterAccount.accountNumber
                                  ).length > 1
                                    ? 's'
                                    : ''}{' '}
                                  connected
                                </div>
                              ) : (
                                <div className="rounded-full px-2 border border-gray-200 py-0.5 text-xs bg-white text-gray-800 inline-block">
                                  No slaves connected
                                </div>
                              )}
                            </td>
                            <td className="w-32 px-4 py-2 whitespace-nowrap align-middle actions-column">
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
                                      <>Disconnect all</>
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 ${
                                      !(masterAccount.totalSlaves && masterAccount.totalSlaves > 0)
                                        ? 'invisible'
                                        : ''
                                    }`}
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleDeleteAccount(masterAccount.id);
                                    }}
                                    title="Delete Account"
                                    disabled={isDeletingAccount === masterAccount.id}
                                  >
                                    <Trash className="h-4 w-4 text-red-600" />
                                  </Button>
                                  {/* Espacio invisible para mantener consistencia con slave accounts que tienen 3 botones */}
                                  <div className="h-9 w-9 invisible"></div>
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Slave accounts connected to this master */}
                          {!collapsedMasters[masterAccount.id] &&
                            connectedSlaves.map(slaveAccount => (
                              <tr key={slaveAccount.id} className="bg-white hover:bg-muted/50">
                                <td className="w-8 px-2 py-1.5 align-middle"></td>
                                <td className="w-20 px-4 py-1.5 align-middle">
                                  <div className="flex items-center justify-center h-full w-full">
                                    <Tooltip tip={getStatusDisplayText(slaveAccount.status)}>
                                      <span className="flex items-center justify-center h-5 w-5">
                                        {getStatusIcon(slaveAccount.status)}
                                      </span>
                                    </Tooltip>
                                  </div>
                                </td>
                                <td className="w-32 px-4 py-1.5 align-middle">
                                  <div className="flex items-center justify-center">
                                    <Switch
                                      checked={getSlaveEffectiveStatus(
                                        slaveAccount.accountNumber,
                                        masterAccount.accountNumber
                                      )}
                                      onCheckedChange={enabled =>
                                        toggleSlaveStatus(slaveAccount.accountNumber, enabled)
                                      }
                                      disabled={
                                        updatingCopier === `slave-${slaveAccount.accountNumber}` ||
                                        !copierStatus?.globalStatus ||
                                        !getMasterEffectiveStatus(masterAccount.accountNumber) ||
                                        slaveAccount.status === 'offline' ||
                                        !slaveAccount.masterOnline
                                      }
                                      title={
                                        slaveAccount.status === 'offline'
                                          ? 'Account is offline - copy trading disabled'
                                          : !slaveAccount.masterOnline
                                            ? 'Master account is offline - copy trading disabled'
                                            : !copierStatus?.globalStatus
                                              ? 'Global copier is OFF'
                                              : !getMasterEffectiveStatus(
                                                    masterAccount.accountNumber
                                                  )
                                                ? 'Master is not sending signals'
                                                : getSlaveEffectiveStatus(
                                                      slaveAccount.accountNumber,
                                                      masterAccount.accountNumber
                                                    )
                                                  ? 'Stop receiving signals from master'
                                                  : 'Start receiving signals from master'
                                      }
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 whitespace-nowrap text-sm align-middle">
                                  {slaveAccount.accountNumber}
                                </td>
                                <td className="px-4 py-1.5 whitespace-nowrap text-sm text-green-700 align-middle">
                                  Slave
                                </td>
                                <td className="px-4 py-1.5 whitespace-nowrap text-sm align-middle">
                                  {getPlatformDisplayName(slaveAccount.platform)}
                                </td>
                                <td className="px-4 py-1.5 whitespace-nowrap text-xs align-middle">
                                  <div className="flex gap-2">
                                    {slaveAccount.forceLot &&
                                    parseFloat(String(slaveAccount.forceLot)) > 0 ? (
                                      <div className="rounded-full px-2 py-0.5 text-xs bg-blue-100 text-blue-800 inline-block">
                                        Force lot {slaveAccount.forceLot}
                                      </div>
                                    ) : slaveAccount.lotCoefficient ? (
                                      <div className="rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-800 inline-block">
                                        Lot multiplier {slaveAccount.lotCoefficient}
                                      </div>
                                    ) : null}
                                    {slaveAccount.reverseTrade && (
                                      <div className="rounded-full px-2 py-0.5 text-xs bg-purple-100 text-purple-800 inline-block">
                                        Reverse trades
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="w-32 px-4 py-1.5 whitespace-nowrap align-middle actions-column">
                                  {deleteConfirmId === slaveAccount.id ? (
                                    <div className="flex space-x-2">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={confirmDeleteAccount}
                                        disabled={isDeletingAccount === slaveAccount.id}
                                        className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                                      >
                                        {isDeletingAccount === slaveAccount.id
                                          ? 'Deleting...'
                                          : 'Delete'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelDeleteAccount}
                                        disabled={isDeletingAccount === slaveAccount.id}
                                        className="bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : disconnectConfirmId === slaveAccount.id ? (
                                    <div className="flex space-x-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                                        onClick={e => {
                                          e.stopPropagation();
                                          disconnectSlaveAccount(slaveAccount.accountNumber);
                                        }}
                                        disabled={isDisconnecting === slaveAccount.id}
                                      >
                                        {isDisconnecting === slaveAccount.id ? (
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
                                        disabled={isDisconnecting === slaveAccount.id}
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
                                          handleEditAccount(slaveAccount);
                                        }}
                                        title="Edit Account"
                                        disabled={isDeletingAccount === slaveAccount.id}
                                      >
                                        <Pencil className="h-4 w-4 text-blue-600" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setDisconnectConfirmId(slaveAccount.id);
                                        }}
                                        title="Disconnect from Master"
                                        disabled={
                                          isDeletingAccount === slaveAccount.id ||
                                          isDisconnecting === slaveAccount.id
                                        }
                                      >
                                        <Unlink className="h-4 w-4 text-orange-600" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                        onClick={e => {
                                          e.stopPropagation();
                                          handleDeleteAccount(slaveAccount.id);
                                        }}
                                        title="Delete Account"
                                        disabled={isDeletingAccount === slaveAccount.id}
                                      >
                                        <Trash className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
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
                            <Tooltip tip={getStatusDisplayText(orphanSlave.status)}>
                              <span className="flex items-center justify-center h-5 w-5">
                                {getStatusIcon(orphanSlave.status)}
                              </span>
                            </Tooltip>
                          </div>
                        </td>
                        <td className="w-32 px-4 py-2 align-middle">
                          <div className="flex items-center justify-center">
                            <Tooltip tip="Connect this slave to a master to enable copy trading.">
                              <div className="flex items-center justify-center">
                                <Switch checked={false} disabled={true} />
                              </div>
                            </Tooltip>
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
                          <div className="rounded-full px-2 py-0.5 text-xs bg-orange-100 border border-orange-300 text-orange-800 inline-block">
                            Not connected
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
                                className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                              >
                                {isDeletingAccount === orphanSlave.id ? 'Deleting...' : 'Delete'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelDeleteAccount}
                                disabled={isDeletingAccount === orphanSlave.id}
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
                                  handleEditAccount(orphanSlave);
                                }}
                                title="Edit Account"
                                disabled={isDeletingAccount === orphanSlave.id}
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDeleteAccount(orphanSlave.id);
                                }}
                                title="Delete Account"
                                disabled={isDeletingAccount === orphanSlave.id}
                              >
                                <Trash className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
