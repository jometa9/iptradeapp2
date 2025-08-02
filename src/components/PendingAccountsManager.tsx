import React, { useCallback, useEffect, useState } from 'react';

import { Cable, Clock, HousePlug, Trash, Unplug, XCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useCSVData } from '../hooks/useCSVData';
import {
  canCreateMoreAccounts,
  getAccountLimitMessage,
  getSubscriptionLimits,
} from '../lib/subscriptionUtils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { toast } from './ui/use-toast';

interface PendingAccount {
  id: string;
  platform: string | null;
  firstSeen: string;
  lastActivity: string;
  status: string;
}

// MasterAccount interface moved to useCSVData hook

interface PendingAccountsData {
  pendingAccounts: Record<string, PendingAccount>;
  totalPending: number;
  message: string;
}

interface ConversionForm {
  name: string;
  description: string;
  broker: string;
  platform: string;
  masterAccountId?: string;
  lotCoefficient: number;
  forceLot: number;
  reverseTrade: boolean;
}

export const PendingAccountsManager: React.FC = () => {
  const { secretKey, userInfo } = useAuth();
  const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:30';
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isRefreshingMasters, setIsRefreshingMasters] = useState(false);
  const [confirmingMasterId, setConfirmingMasterId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [conversionForm, setConversionForm] = useState<ConversionForm>({
    name: '',
    description: '',
    broker: 'MetaQuotes',
    platform: 'MT5',
    masterAccountId: 'none',
    lotCoefficient: 1,
    forceLot: 0,
    reverseTrade: false,
  });

  // Estados para manejar datos locales - using CSV data instead

  // Usar el hook unificado SSE
  const { accounts: csvAccounts, loading, error } = useCSVData();

  // Convertir datos CSV a formato esperado
  const pendingAccounts = React.useMemo(() => {
    if (!csvAccounts?.unconnectedSlaves) return null;

    const pendingData: PendingAccountsData = {
      pendingAccounts: {},
      totalPending: csvAccounts.unconnectedSlaves.length,
      message: `Found ${csvAccounts.unconnectedSlaves.length} pending accounts`,
    };

    csvAccounts.unconnectedSlaves.forEach((slave: any) => {
      pendingData.pendingAccounts[slave.id] = {
        id: slave.id,
        platform: slave.platform || null,
        firstSeen: slave.firstSeen || new Date().toISOString(),
        lastActivity: slave.lastActivity || new Date().toISOString(),
        status: slave.status || 'pending',
      };
    });

    return pendingData;
  }, [csvAccounts]);

  const masterAccounts = React.useMemo(() => {
    if (!csvAccounts?.masterAccounts) return [];

    return Object.entries(csvAccounts.masterAccounts).map(([id, master]: [string, any]) => ({
      id,
      name: master.name || id,
      broker: master.broker || 'Unknown',
      platform: master.platform || 'Unknown',
      registeredAt: master.registeredAt || new Date().toISOString(),
      status: master.status || 'offline',
    }));
  }, [csvAccounts]);

  // Obtener total de cuentas (masters + slaves) para el usuario
  const totalAccounts = React.useMemo(() => {
    if (!csvAccounts) return 0;
    return (
      Object.keys(csvAccounts.masterAccounts || {}).length +
      (csvAccounts.unconnectedSlaves || []).length
    );
  }, [csvAccounts]);

  const accountLimit = React.useMemo(() => {
    return userInfo ? getSubscriptionLimits(userInfo.subscriptionType).maxAccounts : null;
  }, [userInfo]);

  // Platform mapping function
  const getPlatformDisplayName = (platform: string | null | undefined): string => {
    if (!platform) {
      return 'Unknown Platform';
    }

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
    return platformMap[platform] || platform || 'Unknown Platform';
  };

  // Load pending accounts
  const loadPendingAccounts = useCallback(async () => {
    try {
      console.log('API KEY ENVIADO (pending):', secretKey);
      const response = await fetch(`${baseUrl}/accounts/pending`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (response.ok) {
        await response.json();
        // Data handled by CSV
      } else {
        console.error('Failed to fetch pending accounts');
      }
    } catch (error) {
      console.error('Error loading pending accounts:', error);
      toast({
        title: 'Error',
        description: 'Error loading pending accounts',
        variant: 'destructive',
      });
    }
  }, [secretKey, baseUrl]);

  // Load master accounts for slave connection
  const loadMasterAccounts = useCallback(async () => {
    try {
      setIsRefreshingMasters(true);
      const response = await fetch(`${baseUrl}/accounts/all`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (response.ok) {
        await response.json();
        // Data handled by CSV
      } else {
        console.error('Failed to fetch master accounts');
      }
    } catch (error) {
      console.error('Error loading master accounts:', error);
    } finally {
      setIsRefreshingMasters(false);
    }
  }, [secretKey, baseUrl]);

  // loadAccountStats not used - using CSV data instead

  // Real-time events handled by SSE in useCSVData hook

  // Los datos se cargan automáticamente via SSE
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error]);

  // Open conversion form inline or master confirmation
  const openConversionForm = async (account: PendingAccount, type: 'master' | 'slave') => {
    if (type === 'master') {
      // For master, just show confirmation and hide slave form if open
      setExpandedAccountId(null);
      setConfirmingDeleteId(null);
      setConfirmingMasterId(account.id);
    } else {
      // For slave, show form directly and hide master confirmation if open
      setConfirmingMasterId(null);
      setConfirmingDeleteId(null);
      setExpandedAccountId(account.id);

      // Refresh master accounts list to ensure we have the latest data
      await loadMasterAccounts();

      setConversionForm({
        name: `Account ${account.id}`,
        description: '',
        broker: 'MetaQuotes',
        platform: account.platform || 'Unknown',
        masterAccountId: 'none',
        lotCoefficient: 1,
        forceLot: 0,
        reverseTrade: false,
      });
    }
  };

  // Cancel conversion
  const cancelConversion = () => {
    setExpandedAccountId(null);
    setIsConverting(false);
    setConfirmingMasterId(null);
    setConfirmingDeleteId(null);
  };

  // Open delete confirmation
  const openDeleteConfirmation = (accountId: string) => {
    setExpandedAccountId(null);
    setConfirmingMasterId(null);
    setConfirmingDeleteId(accountId);
  };

  // Convert directly to master (no form needed)
  const convertToMaster = async (accountId: string, accountPlatform: string) => {
    setIsConverting(true);

    // Actualización optimista: remover inmediatamente de pending
    if (pendingAccounts && pendingAccounts.pendingAccounts) {
      const updatedPendingAccounts = { ...pendingAccounts.pendingAccounts };
      delete updatedPendingAccounts[accountId];
      // State updated via CSV data
    }

    try {
      const endpoint = `${baseUrl}/accounts/pending/${accountId}/to-master`;
      const payload = {
        name: `Account ${accountId}`,
        broker: 'MetaQuotes',
        platform: accountPlatform || 'Unknown',
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Conversión exitosa - solo cerrar el modal sin mostrar mensaje
        setConfirmingMasterId(null);
        // Refresh master accounts immediately to ensure the new master appears in dropdowns
        await loadMasterAccounts();
        // Los eventos en tiempo real se encargarán de actualizar automáticamente
      } else {
        // Si falla, revertir la actualización optimista
        if (pendingAccounts) {
          loadPendingAccounts();
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert account to master');
      }
    } catch (error) {
      // Si falla, revertir la actualización optimista
      if (pendingAccounts) {
        loadPendingAccounts();
      }
      console.error('Error converting account to master:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error converting account to master',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Convert pending account (slave only - master uses convertToMaster)
  const convertAccount = async () => {
    if (!expandedAccountId) return;

    setIsConverting(true);

    // Actualización optimista: remover inmediatamente de pending
    if (pendingAccounts && pendingAccounts.pendingAccounts) {
      // State updated via CSV data
    }

    try {
      const endpoint = `${baseUrl}/accounts/pending/${expandedAccountId}/to-slave`;
      const payload = {
        name: conversionForm.name,
        description: conversionForm.description,
        broker: conversionForm.broker,
        platform: conversionForm.platform,
        masterAccountId:
          conversionForm.masterAccountId === 'none' ? null : conversionForm.masterAccountId,
        lotCoefficient: conversionForm.lotCoefficient,
        forceLot: conversionForm.forceLot,
        reverseTrade: conversionForm.reverseTrade,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Conversión exitosa - mostrar mensaje de despliegue si está conectada a un master
        if (conversionForm.masterAccountId && conversionForm.masterAccountId !== 'none') {
          toast({
            title: 'Slave Account Deployed',
            description: `Pending account ${expandedAccountId} has been converted to slave and deployed under master ${conversionForm.masterAccountId}`,
          });
        } else {
          toast({
            title: 'Account Converted',
            description: `Pending account ${expandedAccountId} has been converted to slave successfully`,
          });
        }
        setExpandedAccountId(null);
        // Los eventos en tiempo real se encargarán de actualizar automáticamente
      } else {
        // Si falla, revertir la actualización optimista
        if (pendingAccounts) {
          loadPendingAccounts();
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert account');
      }
    } catch (error) {
      // Si falla, revertir la actualización optimista
      if (pendingAccounts) {
        loadPendingAccounts();
      }
      console.error('Error converting account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error converting account',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Delete pending account
  const deletePendingAccount = async (accountId: string) => {
    setIsConverting(true);

    // Actualización optimista: remover inmediatamente de pending
    if (pendingAccounts && pendingAccounts.pendingAccounts) {
      // State updated via CSV data
    }

    try {
      const response = await fetch(`${baseUrl}/accounts/pending/${accountId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': secretKey || '',
        },
      });

      if (response.ok) {
        // Eliminación exitosa - solo cerrar el modal sin mostrar mensaje
        setConfirmingDeleteId(null);
        // Los eventos en tiempo real se encargarán de actualizar automáticamente
      } else {
        // Si falla, revertir la actualización optimista
        if (pendingAccounts) {
          loadPendingAccounts();
        }
        throw new Error('Failed to delete pending account');
      }
    } catch (error) {
      // Si falla, revertir la actualización optimista
      if (pendingAccounts) {
        loadPendingAccounts();
      }
      console.error('Error deleting pending account:', error);
      toast({
        title: 'Error',
        description: 'Error deleting pending account',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = pendingAccounts?.totalPending || 0;
  const accounts = pendingAccounts?.pendingAccounts || {};

  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cable className="h-5 w-5" />
                Pending Accounts
                {pendingCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-orange-50 text-orange-800 border border-orange-300"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingCount === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-gray-600">No pending accounts</p>
              <p className="text-sm text-muted-foreground mt-2 text-gray-400">
                New accounts connected to the server will appear here automatically
              </p>
              <p className="text-sm text-muted-foreground mt-2 text-gray-400">
                See how to connect your accounts to the app{' '}
                <a
                  href="https://iptradecopier.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 "
                >
                  here
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(accounts).map(([id, account]) => {
                const isSuccessfullyConverted = false; // No longer tracking successful conversions
                const isMasterConversion = false; // No longer tracking conversion type

                return (
                  <div
                    key={id}
                    className={`border rounded-lg p-2 shadow ${
                      isSuccessfullyConverted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold ml-2 ${
                            isSuccessfullyConverted ? 'text-green-900' : 'text-orange-900'
                          }`}
                        >
                          {id}
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            isSuccessfullyConverted
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : account.status === 'offline'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-orange-100 text-orange-800 border-orange-300'
                          }
                        >
                          {isSuccessfullyConverted
                            ? isMasterConversion
                              ? 'Master Account'
                              : 'Slave Account'
                            : account.status === 'offline'
                              ? 'Pending Offline'
                              : 'Pending'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-gray-50 text-gray-800 border border-gray-300"
                        >
                          {getPlatformDisplayName(account.platform)}
                        </Badge>
                      </div>

                      {/* aca agregar otro badgegt para la plataforma */}

                      <div className="flex items-center gap-2 flex-wrap justify-left lg:p-0 lg:m-0">
                        {/* debo agregar botones de confirmacion para slave y master */}
                        {confirmingMasterId === id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-blue-50 h-9   rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100"
                              onClick={() => convertToMaster(id, account.platform || 'Unknown')}
                              disabled={isConverting}
                            >
                              {isConverting ? (
                                <>
                                  <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent mr-1" />
                                  Converting...
                                </>
                              ) : (
                                <>
                                  <HousePlug className="h-4 w-4 mr-2" />
                                  Convert to Master
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-gray-50 h-9  rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100"
                              onClick={cancelConversion}
                              disabled={isConverting}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : confirmingDeleteId === id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-50 h-9 rounded-lg border-red-200 text-red-700 hover:bg-red-100"
                              onClick={() => deletePendingAccount(id)}
                              disabled={isConverting}
                            >
                              {isConverting ? (
                                <>
                                  <div className="h-4 w-4 rounded-full border-2 border-red-600 border-t-transparent mr-1" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 p-0 mr-2" />
                                  Delete
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-gray-50 h-9 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100"
                              onClick={cancelConversion}
                              disabled={isConverting}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : expandedAccountId === id ? (
                          // Show conversion form buttons when form is open
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-50 h-9 rounded-lg border-green-200 text-green-700 hover:bg-green-100"
                              onClick={convertAccount}
                              disabled={isConverting}
                            >
                              {isConverting ? (
                                <>
                                  <div className="h-4 w-4 rounded-full border-2 border-green-600 border-t-transparent mr-1" />
                                  Converting...
                                </>
                              ) : (
                                <>
                                  <Unplug className="h-4 w-4 mr-2" />
                                  Convert to Slave
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-gray-50 h-9 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100"
                              onClick={cancelConversion}
                              disabled={isConverting}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          // Normal buttons - only show if account is online (status !== 'offline')
                          <>
                            {account.status === 'offline' ? (
                              // Show offline status and delete only
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 w-9 p-0 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                  onClick={() => openDeleteConfirmation(id)}
                                  disabled={isConverting}
                                  title="Delete Pending Offline Account"
                                >
                                  <Trash className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              // Show normal buttons for online accounts
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-blue-50 h-9 w-9 p-0 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100"
                                  onClick={async () => await openConversionForm(account, 'master')}
                                  title="Make Master"
                                  disabled={
                                    isConverting ||
                                    (userInfo && !canCreateMoreAccounts(userInfo, totalAccounts)) ||
                                    false
                                  }
                                >
                                  <HousePlug className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-green-50 h-9 w-9 p-0 rounded-lg border-green-200 text-green-700 hover:bg-green-100"
                                  onClick={async () => await openConversionForm(account, 'slave')}
                                  title="Make Slave"
                                  disabled={
                                    isConverting ||
                                    (userInfo && !canCreateMoreAccounts(userInfo, totalAccounts)) ||
                                    false
                                  }
                                >
                                  <Unplug className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-red-50 h-9 w-9 p-0 rounded-lg border-red-200 text-red-700 hover:bg-red-100"
                                  onClick={() => openDeleteConfirmation(id)}
                                  disabled={isConverting}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline Conversion Form */}
                    {expandedAccountId === id && (
                      <div className="p-2">
                        <h2 className="text-lg flex items-center font-medium ">
                          <Unplug className="h-4 w-4 mr-2" />
                          Convert to Slave
                        </h2>

                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            convertAccount();
                          }}
                          className="space-y-4 pt-2"
                        >
                          {/* Trading Configuration */}
                          <div className="space-y-4">
                            {/* First Row: Master Connection + Lot Multiplier */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Master Connection Section */}
                              <div>
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="convert-master">Connect to</Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={loadMasterAccounts}
                                    disabled={isRefreshingMasters}
                                    className="h-6 px-2 text-xs"
                                  >
                                    {isRefreshingMasters ? (
                                      <div className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                    ) : (
                                      '↻'
                                    )}
                                  </Button>
                                </div>
                                <Select
                                  value={conversionForm.masterAccountId}
                                  onValueChange={value =>
                                    setConversionForm(prev => ({
                                      ...prev,
                                      masterAccountId: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="bg-white border border-gray-200">
                                    <SelectValue placeholder="Select master..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border border-gray-200">
                                    <SelectItem value="none">
                                      Not connected (configure later)
                                    </SelectItem>
                                    {masterAccounts.length > 0 ? (
                                      masterAccounts.map(master => (
                                        <SelectItem
                                          key={master.id}
                                          value={master.id}
                                          className=" hover:bg-gray-50 cursor-pointer"
                                        >
                                          {master.name || master.id} ({master.platform})
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="none" disabled>
                                        No master accounts available
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                  {masterAccounts.length === 0
                                    ? 'No master accounts available. Convert a pending account to master first.'
                                    : 'Set the master account to convert to'}
                                </p>
                              </div>

                              <div>
                                <Label htmlFor="lotCoefficient">Lot Multiplier (0.01 - 100)</Label>
                                <Input
                                  id="lotCoefficient"
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={conversionForm.lotCoefficient.toFixed(2)}
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

                                    setConversionForm(prev => ({
                                      ...prev,
                                      lotCoefficient: value,
                                    }));
                                  }}
                                  className="bg-white border border-gray-200"
                                />
                                <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                  Multiplies the lot size from the master account
                                </p>
                              </div>
                            </div>

                            {/* Second Row: Fixed Lot + Reverse Trading */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                              <div>
                                <Label htmlFor="forceLot">Fixed Lot (0 to disable)</Label>
                                <Input
                                  id="forceLot"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={
                                    conversionForm.forceLot > 0
                                      ? conversionForm.forceLot.toFixed(2)
                                      : '0.00'
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
                                      }
                                    }

                                    setConversionForm(prev => ({
                                      ...prev,
                                      forceLot: value,
                                    }));
                                  }}
                                  className="bg-white border border-gray-200"
                                />
                                <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                  If greater than 0, uses this fixed lot instead of copying
                                </p>
                              </div>

                              <div className="flex items-center space-x-2 pt-1">
                                <Switch
                                  id="reverseTrade"
                                  checked={conversionForm.reverseTrade}
                                  onCheckedChange={checked =>
                                    setConversionForm(prev => ({
                                      ...prev,
                                      reverseTrade: checked,
                                    }))
                                  }
                                />
                                <Label
                                  htmlFor="reverseTrade"
                                  className="font-medium cursor-pointer"
                                >
                                  Reverse trades
                                </Label>
                                <p className="text-xs text-muted-foreground text-gray-500">
                                  Reverse the trade direction (buy/sell)
                                </p>
                              </div>
                            </div>
                          </div>
                        </form>
                      </div>
                    )}
                    {/* Show limit message if reached */}
                    {userInfo && accountLimit !== null && totalAccounts >= accountLimit && (
                      <div className="p-2 text-xs text-orange-800 font-semibold">
                        {getAccountLimitMessage(userInfo, totalAccounts)} Delete an account to add
                        another one.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};
