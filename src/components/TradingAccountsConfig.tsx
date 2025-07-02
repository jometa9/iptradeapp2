import React, { useEffect, useRef, useState } from 'react';

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Info,
  Pencil,
  RefreshCw,
  Trash,
  XCircle,
} from 'lucide-react';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
}

export function TradingAccountsConfig() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [collapsedMasters, setCollapsedMasters] = useState<{ [key: string]: boolean }>({});

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
      const response = await fetch(`http://localhost:${serverPort}/api/accounts/all`);

      if (!response.ok) {
        throw new Error('Failed to fetch trading accounts');
      }

      const data = await response.json();

      // Handle the actual format returned by the backend
      const allAccounts = [];

      // Helper function to map backend status to frontend status
      const mapStatus = backendStatus => {
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
            connectedSlaves: master.connectedSlaves || [],
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

  useEffect(() => {
    fetchAccounts(true);
  }, []);

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

  const handleAddAccount = () => {
    setIsAddingAccount(true);
    setEditingAccount(null);
    setShowPassword(false);
    setFormState({
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
  };

  const handleEditAccount = async (account: TradingAccount) => {
    setIsAddingAccount(true);
    setEditingAccount(account);

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
            slaveAccountId: formState.accountNumber,
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

  const handleRefreshAccounts = async () => {
    setIsRefreshing(true);
    await fetchAccounts();
    setIsRefreshing(false);
    toast({
      title: 'Accounts Refreshed',
      description: 'Trading accounts have been updated successfully.',
    });
  };

  const getServerStatus = () => {
    if (accounts.length === 0) return 'none';

    const syncedCount = accounts.filter(acc => acc.status === 'synchronized').length;
    const errorCount = accounts.filter(acc => acc.status === 'error').length;
    const offlineCount = accounts.filter(acc => acc.status === 'offline').length;
    const pendingCount = accounts.filter(acc => acc.status === 'pending').length;

    if (syncedCount === accounts.length) return 'optimal';
    if (errorCount > 0) return 'error';
    if (offlineCount > syncedCount) return 'warning';
    if (pendingCount > syncedCount) return 'pending';
    return 'warning';
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

  // Helper function to get status display color class
  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'synchronized':
        return 'text-green-600 text-sm';
      case 'pending':
        return 'text-blue-600 text-sm';
      case 'offline':
        return 'text-orange-600 text-sm';
      case 'error':
        return 'text-red-600 text-sm';
      default:
        return 'text-green-600 text-sm'; // Default for active accounts
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trading Accounts Configuration</CardTitle>
            <CardDescription>
              Manage your trading accounts and copy trading configuration (up to 50 accounts)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              onClick={handleRefreshAccounts}
              variant="ghost"
              disabled={isRefreshing || isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleAddAccount} disabled={accounts.length >= 50}>
              Add Trading Account
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Server Status Bar */}
        <div
          className={`mb-4 border border-gray-200 rounded-xl overflow-hidden
          ${
            getServerStatus() === 'optimal'
              ? 'bg-green-50 border-green-200'
              : getServerStatus() === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : getServerStatus() === 'pending'
                  ? 'bg-blue-50 border-blue-200'
                  : getServerStatus() === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between p-4 px-6">
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Server Status:</div>
              {(() => {
                switch (getServerStatus()) {
                  case 'optimal':
                    return <CheckCircle className="h-4 w-4 text-green-500" />;
                  case 'warning':
                    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
                  case 'pending':
                    return <Clock className="h-4 w-4 text-blue-500" />;
                  case 'error':
                    return <XCircle className="h-4 w-4 text-red-500" />;
                  default:
                    return <Info className="h-4 w-4 text-gray-500" />;
                }
              })()}
              <div className="text-sm font-medium">
                {getServerStatus() === 'optimal'
                  ? 'All Synchronized'
                  : getServerStatus() === 'warning'
                    ? 'Mostly Synchronized'
                    : getServerStatus() === 'pending'
                      ? 'Mostly Pending'
                      : getServerStatus() === 'error'
                        ? 'Mostly Error'
                        : 'No Accounts'}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="border-b border-gray-200 mx-4"></div>
          <div className="flex flex-row items-center justify-between flex-wrap gap-4 p-4 px-6">
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Total Accounts:</div>
              <div className="font-medium">{accounts.length}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Master Accounts:</div>
              <div className="font-medium">
                {accounts.filter(acc => acc.accountType === 'master').length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Slave Accounts:</div>
              <div className="font-medium">
                {accounts.filter(acc => acc.accountType === 'slave').length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Synchronized:</div>
              <div className="font-medium text-green-600">
                {accounts.filter(acc => acc.status === 'synchronized').length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Pending:</div>
              <div className="font-medium text-blue-600">
                {accounts.filter(acc => acc.status === 'pending').length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Offline:</div>
              <div className="font-medium text-orange-600">
                {accounts.filter(acc => acc.status === 'offline').length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Error:</div>
              <div className="font-medium text-red-600">
                {accounts.filter(acc => acc.status === 'error').length}
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Account Form */}
        {isAddingAccount && (
          <div
            ref={formRef}
            className={`mb-4 p-4 border rounded-xl ${
              formState.accountType === 'master'
                ? 'border-blue-200 bg-blue-50'
                : 'border-green-200 bg-green-50'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <h3
                className={`text-lg font-medium ${
                  formState.accountType === 'master' ? 'text-blue-700' : 'text-green-700'
                }`}
              >
                {editingAccount ? 'Edit Trading Account' : 'Add New Trading Account'}
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
                        <SelectItem key={option.value} value={option.value} className="bg-white">
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

                    <div className="flex items-center space-x-2 h-full ">
                      <Checkbox
                        id="reverseTrade"
                        checked={formState.reverseTrade}
                        onCheckedChange={checked =>
                          setFormState({
                            ...formState,
                            reverseTrade: checked as boolean,
                          })
                        }
                        className="bg-white border border-gray-200 shadow-sm cursor-pointer"
                      />
                      <Label htmlFor="reverseTrade" className="font-medium cursor-pointer">
                        Reverse Trades (Buy → Sell, Sell → Buy)
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
                    'Update Account'
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
              <>
                <p className="text-muted-foreground">No trading accounts configured yet.</p>
                <Button onClick={handleAddAccount} className="mt-4">
                  Add your first trading account
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-gray-200 shadow-sm relative overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Status</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Account</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Type</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Platform</th>
                  <th className="px-4 py-3 text-left text-xs uppercase align-middle">Server</th>
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
                  .map(masterAccount => (
                    <React.Fragment key={`master-group-${masterAccount.id}`}>
                      <tr
                        className="bg-blue-50 hover:bg-blue-100 cursor-pointer"
                        onClick={e => {
                          if (!(e.target as HTMLElement).closest('.actions-column')) {
                            toggleMasterCollapse(masterAccount.id);
                          }
                        }}
                      >
                        <td className="px-4 py-2 whitespace-nowrap align-middle">
                          <span className={getStatusColorClass(masterAccount.status)}>
                            {getStatusDisplayText(masterAccount.status)}
                          </span>
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
                        <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                          {masterAccount.server}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap align-middle">
                          {accounts.filter(
                            acc => acc.connectedToMaster === masterAccount.accountNumber
                          ).length > 0 ? (
                            <div className="rounded-full px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 inline-block">
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
                            <div className="rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-600 inline-block">
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
                              >
                                {isDeletingAccount === masterAccount.id ? 'Deleting...' : 'Confirm'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={e => {
                                  e.stopPropagation();
                                  cancelDeleteAccount();
                                }}
                                disabled={isDeletingAccount === masterAccount.id}
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
                                  handleEditAccount(masterAccount);
                                }}
                                title="Edit Account"
                                disabled={isDeletingAccount === masterAccount.id}
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
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
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Slave accounts connected to this master */}
                      {!collapsedMasters[masterAccount.id] &&
                        accounts
                          .filter(
                            account =>
                              account.accountType === 'slave' &&
                              account.connectedToMaster === masterAccount.accountNumber
                          )
                          .map(slaveAccount => (
                            <tr key={slaveAccount.id} className="bg-white hover:bg-muted/50">
                              <td className="px-4 py-1.5 whitespace-nowrap align-middle">
                                <span className={getStatusColorClass(slaveAccount.status)}>
                                  {getStatusDisplayText(slaveAccount.status)}
                                </span>
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
                              <td className="px-4 py-1.5 whitespace-nowrap text-sm align-middle">
                                {slaveAccount.server}
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
                                    >
                                      {isDeletingAccount === slaveAccount.id
                                        ? 'Deleting...'
                                        : 'Confirm'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelDeleteAccount}
                                      disabled={isDeletingAccount === slaveAccount.id}
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
                  ))}

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
                      <td className="px-4 py-2 whitespace-nowrap align-middle">
                        <span className={getStatusColorClass(orphanSlave.status)}>
                          {getStatusDisplayText(orphanSlave.status)}
                        </span>
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
                      <td className="px-4 py-2 whitespace-nowrap text-sm align-middle">
                        {orphanSlave.server}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs align-middle">
                        <div className="rounded-full px-2 py-0.5 text-xs bg-orange-100 text-orange-800 inline-block">
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
                            >
                              {isDeletingAccount === orphanSlave.id ? 'Deleting...' : 'Confirm'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelDeleteAccount}
                              disabled={isDeletingAccount === orphanSlave.id}
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
