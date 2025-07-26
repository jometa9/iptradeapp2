import React, { useEffect, useState } from 'react';

import { Cable, Clock, HousePlug, Trash, Unplug, XCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
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
  platform: string;
  firstSeen: string;
  lastActivity: string;
  status: string;
}

interface MasterAccount {
  id: string;
  name: string;
  broker: string;
  platform: string;
  registeredAt: string;
  status: string;
}

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
  const [loading, setLoading] = useState(false);
  const { secretKey, userInfo, isAuthenticated } = useAuth();
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccountsData | null>(null);
  const [masterAccounts, setMasterAccounts] = useState<MasterAccount[]>([]);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
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

  // Estados para confirmaciones visuales
  const [successfulConversions, setSuccessfulConversions] = useState<Set<string>>(new Set());
  const [conversionType, setConversionType] = useState<'master' | 'slave' | null>(null);

  // Obtener total de cuentas (masters + slaves) para el usuario
  const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [accountLimit, setAccountLimit] = useState<number | null>(null);

  const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
  const baseUrl = `http://localhost:${serverPort}/api`;

  // Load pending accounts
  const loadPendingAccounts = async () => {
    try {
      console.log('API KEY ENVIADO (pending):', secretKey);
      const response = await fetch(`${baseUrl}/accounts/pending`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingAccounts(data);
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
  };

  // Load master accounts for slave connection
  const loadMasterAccounts = async () => {
    try {
      const response = await fetch(`${baseUrl}/accounts/all`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const masters = Object.values(data.masterAccounts || {}) as MasterAccount[];
        setMasterAccounts(masters);
      } else {
        console.error('Failed to fetch master accounts');
      }
    } catch (error) {
      console.error('Error loading master accounts:', error);
    }
  };

  // Cargar cuentas totales y límite
  const loadAccountStats = async () => {
    try {
      const response = await fetch(`${baseUrl}/accounts/all`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const masters = data.totalMasterAccounts || 0;
        const slaves = data.totalSlaveAccounts || 0;
        setTotalAccounts(masters + slaves);
        if (userInfo) {
          const limits = getSubscriptionLimits(userInfo.subscriptionType);
          setAccountLimit(limits.maxAccounts);
        }
      }
    } catch (error) {
      console.error('Error loading account stats:', error);
      setTotalAccounts(0);
      setAccountLimit(null);
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadPendingAccounts(), loadMasterAccounts(), loadAccountStats()]);
      setLoading(false);
    };
    if (isAuthenticated && secretKey) {
      loadData();
    }
    // Auto-refresh every 1 second to catch new pending accounts AND account changes
    const interval = setInterval(() => {
      if (isAuthenticated && secretKey) {
        loadPendingAccounts();
        loadAccountStats(); // También actualizar el conteo de cuentas
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [secretKey, isAuthenticated]); // Add secretKey and isAuthenticated as dependencies

  // Open conversion form inline or master confirmation
  const openConversionForm = (account: PendingAccount, type: 'master' | 'slave') => {
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
      setConversionForm({
        name: `Account ${account.id}`,
        description: '',
        broker: 'MetaQuotes',
        platform: account.platform || 'MT5',
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
    try {
      const endpoint = `${baseUrl}/accounts/pending/${accountId}/to-master`;
      const payload = {
        name: `Account ${accountId}`,
        broker: 'MetaQuotes',
        platform: accountPlatform || 'MT5',
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
        toast({
          title: 'Success',
          description: `Account ${accountId} successfully converted to master`,
        });

        // Agregar confirmación visual
        setSuccessfulConversions(prev => new Set([...prev, accountId]));
        setConversionType('master');
        setConfirmingMasterId(null);

        // Remover la confirmación después de 2 segundos
        setTimeout(() => {
          setSuccessfulConversions(prev => {
            const newSet = new Set(prev);
            newSet.delete(accountId);
            return newSet;
          });
          setConversionType(null);
        }, 2000);

        // Actualizar estado local eliminando la cuenta convertida
        if (pendingAccounts) {
          const updatedPendingAccounts = { ...pendingAccounts.pendingAccounts };
          delete updatedPendingAccounts[accountId];
          setPendingAccounts({
            ...pendingAccounts,
            pendingAccounts: updatedPendingAccounts,
            totalPending: pendingAccounts.totalPending - 1,
          });
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert account to master');
      }
    } catch (error) {
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

    const pendingAccount = pendingAccounts?.pendingAccounts[expandedAccountId];
    if (!pendingAccount) return;

    setIsConverting(true);
    try {
      const endpoint = `${baseUrl}/accounts/pending/${expandedAccountId}/to-slave`;

      const payload = {
        name: `Account ${expandedAccountId}`,
        broker: 'MetaQuotes',
        platform: pendingAccount.platform || 'MT5',
        ...(conversionForm.masterAccountId &&
          conversionForm.masterAccountId !== 'none' && {
            masterAccountId: conversionForm.masterAccountId,
          }),
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
        toast({
          title: 'Success',
          description: `Account successfully converted to slave${
            conversionForm.masterAccountId && conversionForm.masterAccountId !== 'none'
              ? ` and connected to master ${conversionForm.masterAccountId}`
              : ''
          }`,
        });

        // Agregar confirmación visual
        setSuccessfulConversions(prev => new Set([...prev, expandedAccountId]));
        setConversionType('slave');
        setExpandedAccountId(null);

        // Remover la confirmación después de 2 segundos
        setTimeout(() => {
          setSuccessfulConversions(prev => {
            const newSet = new Set(prev);
            newSet.delete(expandedAccountId);
            return newSet;
          });
          setConversionType(null);
        }, 2000);

        // Actualizar estado local eliminando la cuenta convertida
        if (pendingAccounts) {
          const updatedPendingAccounts = { ...pendingAccounts.pendingAccounts };
          delete updatedPendingAccounts[expandedAccountId];
          setPendingAccounts({
            ...pendingAccounts,
            pendingAccounts: updatedPendingAccounts,
            totalPending: pendingAccounts.totalPending - 1,
          });
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert account');
      }
    } catch (error) {
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
    try {
      const response = await fetch(`${baseUrl}/accounts/pending/${accountId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': secretKey || '',
        },
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Pending account deleted successfully',
        });
        setConfirmingDeleteId(null);

        // Actualizar estado local eliminando la cuenta borrada
        if (pendingAccounts) {
          const updatedPendingAccounts = { ...pendingAccounts.pendingAccounts };
          delete updatedPendingAccounts[accountId];
          setPendingAccounts({
            ...pendingAccounts,
            pendingAccounts: updatedPendingAccounts,
            totalPending: pendingAccounts.totalPending - 1,
          });
        }
      } else {
        throw new Error('Failed to delete pending account');
      }
    } catch (error) {
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
                const isSuccessfullyConverted = successfulConversions.has(id);
                const isMasterConversion = conversionType === 'master' && isSuccessfullyConverted;

                return (
                  <div
                    key={id}
                    className={`border rounded-lg p-2 shadow transition-all duration-500 ${
                      isSuccessfullyConverted
                        ? 'bg-green-50 border-green-200 scale-105'
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
                          {account.platform || 'Unknown'}
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
                              onClick={() => convertToMaster(id, account.platform)}
                              disabled={isConverting}
                            >
                              {isConverting ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-1" />
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
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-1" />
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
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent mr-1" />
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
                                  onClick={() => openConversionForm(account, 'master')}
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
                                  onClick={() => openConversionForm(account, 'slave')}
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

                    {isSuccessfullyConverted && (
                      <div className="mt-2 p-3 bg-green-100 border border-green-300 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                          <p className="text-green-800 font-medium">
                            Successfully converted to {isMasterConversion ? 'Master' : 'Slave'}{' '}
                            Account
                          </p>
                        </div>
                      </div>
                    )}

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
                              {masterAccounts.length > 0 && (
                                <div>
                                  <Label htmlFor="convert-master">Connect to</Label>
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
                                      {masterAccounts.map(master => (
                                        <SelectItem
                                          key={master.id}
                                          value={master.id}
                                          className=" hover:bg-gray-50 cursor-pointer"
                                        >
                                          {master.name || master.id} ({master.platform})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                    Set the master account to convert to
                                  </p>
                                </div>
                              )}

                              <div>
                                <Label htmlFor="lotCoefficient">Lot Multiplier (0.01 - 100)</Label>
                                <Input
                                  id="lotCoefficient"
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={conversionForm.lotCoefficient.toString()}
                                  onChange={e =>
                                    setConversionForm(prev => ({
                                      ...prev,
                                      lotCoefficient:
                                        e.target.value === '' ? 1 : parseFloat(e.target.value),
                                    }))
                                  }
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
                                  value={conversionForm.forceLot.toString()}
                                  onChange={e =>
                                    setConversionForm(prev => ({
                                      ...prev,
                                      forceLot:
                                        e.target.value === '' ? 0 : parseFloat(e.target.value),
                                    }))
                                  }
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
