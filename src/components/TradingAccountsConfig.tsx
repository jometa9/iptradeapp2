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
  Info,
  Pencil,
  Power,
  PowerOff,
  Shield,
  Trash,
  Unlink,
  WifiOff,
  XCircle,
} from 'lucide-react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Tooltip } from './ui/tooltip';
import { toast } from './ui/use-toast';

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

export function TradingAccountsConfig() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null);
  const [disconnectAllConfirmId, setDisconnectAllConfirmId] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [collapsedMasters, setCollapsedMasters] = useState<{ [key: string]: boolean }>({});

  // Copier status management
  const [copierStatus, setCopierStatus] = useState<any>(null);
  const [slaveConfigs, setSlaveConfigs] = useState<Record<string, any>>({});
  const [updatingCopier, setUpdatingCopier] = useState<string | null>(null);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [pendingAccountsCount, setPendingAccountsCount] = useState<number>(0);

  const [formState, setFormState] = useState({
    accountNumber: '',
    platform: 'mt4',
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
    { value: 'mt4', label: 'MetaTrader 4' },
    { value: 'mt5', label: 'MetaTrader 5' },
  ];

  // Account types
  const accountTypeOptions = [
    { value: 'master', label: 'Master Account (Signal Provider)' },
    { value: 'slave', label: 'Slave Account (Signal Follower)' },
  ];

  // Fetch accounts from API
  const fetchAccounts = async (showLoadingState = false) => {
    try {
      if (showLoadingState) {
        setIsLoading(true);
      }

      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
      const response = await fetch(`http://localhost:${serverPort}/api/accounts/admin/all`);

      if (!response.ok) {
        throw new Error('Failed to fetch trading accounts');
      }

      const data = await response.json();

      // Handle the actual format returned by the backend
      const allAccounts: TradingAccount[] = [];

      // Helper function to map backend status to frontend status
      const mapStatus = (backendStatus: string) => {
        switch (backendStatus) {
          case 'active':
            return 'synchronized';
          case 'pending':
            return 'pending';
          case 'offline':
            return 'offline';
          case 'error':
            return 'error';
          default:
            return 'synchronized'; // Default to synchronized for unknown statuses
        }
      };

      // Add master accounts
      if (data.masterAccounts) {
        Object.values(data.masterAccounts).forEach((master: any) => {
          allAccounts.push({
            id: master.id.toString(),
            accountNumber: master.id,
            platform: master.platform || 'MT4',
            server: master.broker || '',
            password: '••••••••',
            accountType: 'master',
            status: mapStatus(master.status || 'active'),
            connectedSlaves: (master as any).connectedSlaves || [],
            totalSlaves: master.totalSlaves || 0,
          });
        });
      }

      // Add connected slaves
      if (data.masterAccounts) {
        Object.values(data.masterAccounts).forEach((master: any) => {
          if (master.connectedSlaves && Array.isArray(master.connectedSlaves)) {
            master.connectedSlaves.forEach((slave: any) => {
              allAccounts.push({
                id: slave.id.toString(),
                accountNumber: slave.id,
                platform: slave.platform || 'MT4',
                server: slave.broker || '',
                password: '••••••••',
                accountType: 'slave',
                status: mapStatus(slave.status || 'active'),
                connectedToMaster: master.id,
              });
            });
          }
        });
      }

      // Add unconnected slaves
      if (data.unconnectedSlaves && Array.isArray(data.unconnectedSlaves)) {
        data.unconnectedSlaves.forEach((slave: any) => {
          allAccounts.push({
            id: slave.id.toString(),
            accountNumber: slave.id,
            platform: slave.platform || 'MT4',
            server: slave.broker || '',
            password: '••••••••',
            accountType: 'slave',
            status: mapStatus(slave.status || 'active'),
            connectedToMaster: 'none',
          });
        });
      }

      setAccounts(allAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      if (showLoadingState) {
        toast({
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
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
      const response = await fetch(`http://localhost:${serverPort}/api/accounts/pending`);

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

    // Auto-refresh every 10 seconds to catch new conversions
    const interval = setInterval(() => {
      fetchAccounts(false);
      fetchPendingAccountsCount();
    }, 10000);

    return () => clearInterval(interval);
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
  }, [accounts]);

  // Load copier status and slave configurations
  const loadCopierData = async () => {
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
      const baseUrl = `http://localhost:${serverPort}/api`;

      // Load copier status
      const copierResponse = await fetch(`${baseUrl}/copier/status`);
      if (copierResponse.ok) {
        const copierData = await copierResponse.json();
        setCopierStatus(copierData);
      }

      // Load slave configurations for all slave accounts
      const slaveAccounts = accounts.filter(acc => acc.accountType === 'slave');
      const slaveConfigPromises = slaveAccounts.map(async slave => {
        try {
          const response = await fetch(`${baseUrl}/slave-config/${slave.accountNumber}`);
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
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';

      // If disabling global copier, first disable all individual accounts
      if (!enabled) {
        // Get all master accounts that are currently enabled
        const enabledMasters = Object.entries(copierStatus?.masterAccounts || {})
          .filter(([_, status]: [string, any]) => status.masterStatus)
          .map(([masterId]) => masterId);

        // Get all slave accounts that are currently enabled
        const enabledSlaves = Object.entries(slaveConfigs || {})
          .filter(([_, config]) => config.config?.enabled !== false)
          .map(([slaveId]) => slaveId);

        // Disable all masters
        for (const masterId of enabledMasters) {
          await fetch(`http://localhost:${serverPort}/api/copier/master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ masterAccountId: masterId, enabled: false }),
          });
        }

        // Disable all slaves
        for (const slaveId of enabledSlaves) {
          await fetch(`http://localhost:${serverPort}/api/slave-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slaveAccountId: slaveId, enabled: false }),
          });
        }

        // Update local state to reflect all accounts are now disabled
        setCopierStatus((prev: any) => {
          const updatedMasters: Record<string, any> = {};
          Object.keys(prev?.masterAccounts || {}).forEach(masterId => {
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
          const updatedConfigs: Record<string, any> = {};
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        const result = await response.json();

        // Immediately update local state for responsive UI
        setCopierStatus((prev: any) => ({
          ...prev,
          globalStatus: enabled,
          globalStatusText: enabled ? 'ON' : 'OFF',
        }));

        toast({
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
      toast({
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
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
      const response = await fetch(`http://localhost:${serverPort}/api/copier/master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterAccountId, enabled }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message,
        });
        loadCopierData(); // Reload copier data
      } else {
        throw new Error('Failed to update master copier status');
      }
    } catch (error) {
      console.error('Error updating master status:', error);
      toast({
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
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
      const response = await fetch(`http://localhost:${serverPort}/api/slave-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slaveAccountId, enabled }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Slave ${slaveAccountId} ${enabled ? 'enabled' : 'disabled'}`,
        });
        loadCopierData(); // Reload copier data
      } else {
        throw new Error('Failed to update slave status');
      }
    } catch (error) {
      console.error('Error updating slave status:', error);
      toast({
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

        const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';

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
        });

        if (!response.ok) {
          throw new Error('Failed to delete trading account');
        }

        await fetchAccounts();

        toast({
          title: 'Account Deleted',
          description: 'The account has been removed successfully.',
        });
      } catch (error) {
        console.error('Error deleting account:', error);
        toast({
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
    setIsDisconnecting(slaveAccountId);
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
      const response = await fetch(
        `http://localhost:${serverPort}/api/accounts/disconnect/${slaveAccountId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        toast({
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
      toast({
        title: 'Error',
        description: 'Failed to disconnect slave account',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(null);
    }
  };

  const disconnectAllSlaves = async (masterAccountId: string) => {
    setIsDisconnecting(masterAccountId);
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';

      // Get all connected slaves for this master
      const masterAccount = accounts.find(acc => acc.accountNumber === masterAccountId);
      const connectedSlaves = masterAccount?.connectedSlaves || [];
      const slaveIds = connectedSlaves.map(slave => slave.id);

      // Disconnect each slave
      const disconnectPromises = slaveIds.map(slaveId =>
        fetch(`http://localhost:${serverPort}/api/accounts/disconnect/${slaveId}`, {
          method: 'DELETE',
        })
      );

      await Promise.all(disconnectPromises);

      toast({
        title: 'Success',
        description: `All ${slaveIds.length} slave accounts disconnected successfully`,
      });
      setDisconnectAllConfirmId(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error disconnecting all slaves:', error);
      toast({
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

    if (!formState.accountNumber || !formState.serverIp) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
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

        if (editingAccount) {
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

        if (editingAccount && editingAccount.accountType === 'slave') {
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
        }

        if (editingAccount) {
          response = await fetch(
            `http://localhost:${serverPort}/api/accounts/slave/${editingAccount.id}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
        } else {
          response = await fetch(`http://localhost:${serverPort}/api/accounts/slave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slaveConfigPayload),
          });
        }
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save trading account');
      }

      await fetchAccounts();

      toast({
        title: editingAccount ? 'Account Updated' : 'Account Created',
        description: `Your trading account has been ${editingAccount ? 'updated' : 'created'} successfully.`,
      });

      handleCancel();
    } catch (error: any) {
      console.error('Error saving account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save trading account. Please try again.',
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

    const syncedCount = accounts.filter(acc => acc.status === 'synchronized').length;
    const errorCount = accounts.filter(acc => acc.status === 'error').length;
    const offlineCount = accounts.filter(acc => acc.status === 'offline').length;
    const pendingCount = accounts.filter(acc => acc.status === 'pending').length;
    const totalAccounts = accounts.length;

    const errorPercentage = (errorCount / totalAccounts) * 100;
    const offlinePercentage = (offlineCount / totalAccounts) * 100;
    const pendingPercentage = (pendingCount / totalAccounts) * 100;

    if (errorPercentage > 30 || (errorCount > 0 && totalAccounts < 5)) {
      return 'error';
    }

    if (offlinePercentage > 50 || offlineCount > syncedCount) {
      return 'offline';
    }

    if (pendingPercentage > 40 || pendingCount > syncedCount) {
      return 'pending';
    }

    if (offlineCount > 0 || pendingCount > 0) {
      return 'mixed';
    }

    if (syncedCount === totalAccounts) {
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

    const syncedCount = accounts.filter(acc => acc.status === 'synchronized').length;
    const errorCount = accounts.filter(acc => acc.status === 'error').length;
    const offlineCount = accounts.filter(acc => acc.status === 'offline').length;
    const pendingCount = accounts.filter(acc => acc.status === 'pending').length;
    const totalAccounts = accounts.length;

    const syncedPercentage = Math.round((syncedCount / totalAccounts) * 100);
    const errorPercentage = Math.round((errorCount / totalAccounts) * 100);
    const offlinePercentage = Math.round((offlineCount / totalAccounts) * 100);
    const pendingPercentage = Math.round((pendingCount / totalAccounts) * 100);

    const status = getServerStatus();

    switch (status) {
      case 'optimal':
        return {
          message: `${syncedPercentage}% of accounts are synchronized`,
          recommendation: 'All systems operational',
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
          recommendation: 'Complete account configuration',
          severity: 'warning',
        };
      case 'error':
        return {
          message: `${errorPercentage}% of accounts have errors`,
          recommendation: 'Review account settings and resolve errors',
          severity: 'error',
        };
      case 'mixed':
        return {
          message: `Mixed status: ${syncedPercentage}% synced, ${offlinePercentage}% offline, ${pendingPercentage}% pending`,
          recommendation: 'Address offline and pending accounts',
          severity: 'warning',
        };
      case 'warning':
        return {
          message: 'Some accounts may need attention',
          recommendation: 'Review account statuses',
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
        return 'Synced';
      case 'pending':
        return 'Pending';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      default:
        return 'Synced'; // Default for active accounts
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synchronized':
        return <CheckCircle className="text-green-700" />;
      case 'pending':
        return <Clock className="text-yellow-500" />;
      case 'offline':
        return <XCircle className="text-red-700" />;
      case 'error':
        return <AlertTriangle className="text-red-700" />;
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

  return (
    <Card className="bg-white rounded-xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trading Accounts Configuration</CardTitle>
            <CardDescription>
              Manage your trading accounts and copy trading configuration (up to 50 accounts)
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
              {getStatusBadge(copierStatus?.globalStatus || false)}
              {showGlobalConfirm ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    onClick={() => performGlobalToggle(false)}
                    disabled={updatingCopier === 'global'}
                  >
                    {updatingCopier === 'global' ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-1" />
                        Stopping...
                      </>
                    ) : (
                      'Stop Copier'
                    )}
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
          {!copierStatus?.globalStatus && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center">
              <AlertTriangle className="w-4 h-4 inline mr-3 ml-1" />
              Global copier is OFF - No signals will be copied regardless of individual settings
            </div>
          )}
          {showGlobalConfirm && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center">
              <AlertTriangle className="w-4 h-4 inline mr-3" />
              <strong>Warning:</strong> This will turn OFF copy trading for ALL master and slave
              accounts. No signals will be copied until re-enabled.
            </div>
          )}
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
                  : getServerStatus() === 'error'
                    ? 'bg-red-50 border-red-200'
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
                      return <Clock className="h-4 w-4 text-blue-500" />;
                    case 'error':
                      return <XCircle className="h-4 w-4 text-red-500" />;
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
                    ? 'All Synchronized'
                    : getServerStatus() === 'offline'
                      ? 'Mostly Offline'
                      : getServerStatus() === 'pending'
                        ? 'Mostly Pending'
                        : getServerStatus() === 'error'
                          ? 'Critical Errors'
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 p-4 px-6">
            {/* Total Accounts */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-2xl font-bold text-gray-800">{accounts.length}</div>
              <div className="text-xs text-gray-600 text-center">Total</div>
            </div>

            {/* Master Accounts */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {accounts.filter(acc => acc.accountType === 'master').length}
              </div>
              <div className="text-xs text-gray-600 text-center">Masters</div>
            </div>

            {/* Slave Accounts */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-2xl font-bold text-green-600">
                {accounts.filter(acc => acc.accountType === 'slave').length}
              </div>
              <div className="text-xs text-gray-600 text-center">Slaves</div>
            </div>

            {/* Synchronized */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-green-200 shadow-sm">
              <div className="text-2xl font-bold text-green-600">
                {accounts.filter(acc => acc.status === 'synchronized').length}
              </div>
              <div className="text-xs text-green-600 text-center">Synced</div>
            </div>

            {/* Pending */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {accounts.filter(acc => acc.status === 'pending').length}
              </div>
              <div className="text-xs text-blue-600 text-center">Pending</div>
            </div>

            {/* Offline */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-orange-200 shadow-sm">
              <div className="text-2xl font-bold text-orange-600">
                {accounts.filter(acc => acc.status === 'offline').length}
              </div>
              <div className="text-xs text-orange-600 text-center">Offline</div>
            </div>

            {/* Error */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-red-200 shadow-sm">
              <div className="text-2xl font-bold text-red-600">
                {accounts.filter(acc => acc.status === 'error').length}
              </div>
              <div className="text-xs text-red-600 text-center">Error</div>
            </div>

            {/* Pending Accounts */}
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-orange-200 shadow-sm">
              <div className="text-2xl font-bold text-orange-600">{pendingAccountsCount}</div>
              <div className="text-xs text-orange-600 text-center">New Pending</div>
            </div>
          </div>
        </div>

        {/* Add/Edit Account Form */}
        {isAddingAccount && (
          <div
            ref={formRef}
            className={`mb-4 p-4 border shadow-sm rounded-xl ${
              formState.accountType === 'master'
                ? 'border-blue-300 bg-blue-50'
                : 'border-green-300 bg-green-50'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <h3
                className={`text-lg font-medium ${
                  formState.accountType === 'master' ? 'text-blue-700' : 'text-green-700'
                }`}
              >
                {editingAccount
                  ? editingAccount.accountType === 'slave'
                    ? `Edit Slave Configuration for account ${formState.accountNumber}`
                    : `Edit Trading Account ${formState.accountNumber}`
                  : 'Add New Trading Account'}
              </h3>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 w-8 p-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={
                    formState.accountType === 'master' ? 'text-blue-700' : 'text-green-700'
                  }
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Para cuentas nuevas o cuentas master, mostrar todos los campos */}
                {(!editingAccount || (editingAccount && formState.accountType === 'master')) && (
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
                        <SelectTrigger className="bg-white border border-gray-200 shadow-sm">
                          <SelectValue placeholder="Select Platform" className="bg-white" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          {platformOptions.map(option => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="bg-white"
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

                <div>
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select
                    name="accountType"
                    value={formState.accountType}
                    onValueChange={value => handleSelectChange('accountType', value)}
                  >
                    <SelectTrigger className="bg-white border border-gray-200 shadow-sm">
                      <SelectValue placeholder="Select Type" className="bg-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200">
                      {accountTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value} className="bg-white ">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formState.accountType === 'slave' && (
                  <>
                    <div>
                      <Label htmlFor="connectedToMaster">Connect to Master Account</Label>
                      <Select
                        name="connectedToMaster"
                        value={formState.connectedToMaster}
                        onValueChange={value => handleSelectChange('connectedToMaster', value)}
                      >
                        <SelectTrigger className="bg-white border border-gray-200 shadow-sm">
                          <SelectValue
                            placeholder="Select Master Account (Optional)"
                            className="bg-white"
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200">
                          <SelectItem value="none">Not Connected (Independent)</SelectItem>
                          {accounts
                            .filter(acc => acc.accountType === 'master')
                            .map(masterAcc => (
                              <SelectItem
                                key={masterAcc.id}
                                value={masterAcc.accountNumber}
                                className="bg-white"
                              >
                                {masterAcc.accountNumber} ({masterAcc.platform.toUpperCase()} -{' '}
                                {masterAcc.server})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="lotCoefficient">Lot Size Coefficient (0.01 - 100)</Label>
                      <Input
                        id="lotCoefficient"
                        name="lotCoefficient"
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={formState.lotCoefficient?.toString() || '1'}
                        onChange={e =>
                          setFormState({
                            ...formState,
                            lotCoefficient: e.target.value === '' ? 1 : parseFloat(e.target.value),
                          })
                        }
                        className="bg-white border border-gray-200 shadow-sm  "
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Multiplies the lot size from the master account
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="forceLot">Force Fixed Lot Size (0 to disable)</Label>
                      <Input
                        id="forceLot"
                        name="forceLot"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formState.forceLot?.toString() || '0'}
                        onChange={e =>
                          setFormState({
                            ...formState,
                            forceLot: e.target.value === '' ? 0 : parseFloat(e.target.value),
                          })
                        }
                        className="bg-white border border-gray-200 shadow-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        If set above 0, uses this fixed lot size instead of copying
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
                  className="bg-white border border-gray-200 shadow-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-white border border-gray-200 shadow-sm"
                >
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
          </div>
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
                  <th className="px-4 py-3 align-middle"></th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Status</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">
                    Copy Trading
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Account</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Type</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Platform</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">
                    Configuration
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Actions</th>
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
                          <td className="w-2 pl-6 py-2 align-middle">
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
                          <td className="py-2 align-middle">
                            <div className="flex items-center justify-center h-full w-full">
                              <Tooltip tip={getStatusDisplayText(masterAccount.status)}>
                                <span className="flex items-center justify-center h-5 w-5">
                                  {getStatusIcon(masterAccount.status)}
                                </span>
                              </Tooltip>
                            </div>
                          </td>
                          <td className="px-4 py-2 align-middle">
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
                            {masterAccount.platform === 'mt4' ? 'MetaTrader 4' : 'MetaTrader 5'}
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
                          <td className="px-4 py-2 whitespace-nowrap align-middle actions-column">
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
                                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
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
                                  className="bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
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
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Slave accounts connected to this master */}
                        {!collapsedMasters[masterAccount.id] &&
                          connectedSlaves.map(slaveAccount => (
                            <tr key={slaveAccount.id} className="bg-white hover:bg-muted/50">
                              <td className="w-8 px-2 py-1.5 align-middle"></td>
                              <td className="px-4 py-1.5 align-middle">
                                <div className="flex items-center justify-center h-full w-full">
                                  <Tooltip tip={getStatusDisplayText(slaveAccount.status)}>
                                    <span className="flex items-center justify-center h-5 w-5">
                                      {getStatusIcon(slaveAccount.status)}
                                    </span>
                                  </Tooltip>
                                </div>
                              </td>
                              <td className="px-4 py-1.5 align-middle">
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
                                      slaveAccount.status === 'offline'
                                    }
                                    title={
                                      slaveAccount.status === 'offline'
                                        ? 'Account is offline - copy trading disabled'
                                        : !copierStatus?.globalStatus
                                          ? 'Global copier is OFF'
                                          : !getMasterEffectiveStatus(masterAccount.accountNumber)
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
                                {slaveAccount.platform === 'mt4' ? 'MetaTrader 4' : 'MetaTrader 5'}
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
                              <td className="px-4 py-1.5 whitespace-nowrap align-middle actions-column">
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
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center justify-center h-full w-full">
                          <Tooltip tip={getStatusDisplayText(orphanSlave.status)}>
                            <span className="flex items-center justify-center h-5 w-5">
                              {getStatusIcon(orphanSlave.status)}
                            </span>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
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
                        <span className="text-orange-600">Slave (Unconnected)</span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                        {orphanSlave.platform === 'mt4' ? 'MetaTrader 4' : 'MetaTrader 5'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs align-middle">
                        <div className="rounded-full px-2 py-0.5 text-xs bg-orange-100 border border-orange-300 text-orange-800 inline-block">
                          Not connected
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap align-middle actions-column">
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
  );
}
