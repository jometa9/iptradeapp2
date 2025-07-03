import React, { useEffect, useState } from 'react';

import { Cable, Clock, UserCheck, Users, XCircle } from 'lucide-react';

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
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccountsData | null>(null);
  const [masterAccounts, setMasterAccounts] = useState<MasterAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [confirmingMasterId, setConfirmingMasterId] = useState<string | null>(null);
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

  const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
  const baseUrl = `http://localhost:${serverPort}/api`;

  // Load pending accounts
  const loadPendingAccounts = async () => {
    try {
      const response = await fetch(`${baseUrl}/accounts/pending`);
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
      const response = await fetch(`${baseUrl}/accounts/admin/all`);
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

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadPendingAccounts(), loadMasterAccounts()]);
      setLoading(false);
    };
    loadData();

    // Auto-refresh every 30 seconds to catch new pending accounts
    const interval = setInterval(loadPendingAccounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Open conversion form inline or master confirmation
  const openConversionForm = (account: PendingAccount, type: 'master' | 'slave') => {
    if (type === 'master') {
      // For master, just show confirmation and hide slave form if open
      setExpandedAccountId(null);
      setConfirmingMasterId(account.id);
    } else {
      // For slave, show simplified form and hide master confirmation if open
      setConfirmingMasterId(null);
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
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Account ${accountId} successfully converted to master`,
        });

        setConfirmingMasterId(null);
        loadPendingAccounts(); // Refresh the list
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

        setExpandedAccountId(null);
        loadPendingAccounts(); // Refresh the list
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
    if (!confirm(`Are you sure you want to delete the pending account ${accountId}?`)) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/accounts/pending/${accountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Pending account deleted successfully',
        });
        loadPendingAccounts();
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
    }
  };

  const getTimeSinceFirstSeen = (dateString: string) => {
    const now = new Date();
    const firstSeen = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
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
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {pendingCount}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {pendingCount === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-gray-400">No pending accounts</p>
              <p className="text-sm text-muted-foreground mt-2 text-gray-400">
                New accounts connected to the server will appear here automatically
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(accounts).map(([id, account]) => (
                <div
                  key={id}
                  className="border rounded-lg p-4 bg-orange-50 border-orange-200 shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-orange-900">Account {id}</h3>
                      <Badge
                        variant="outline"
                        className="bg-orange-100 text-orange-800 border-orange-300"
                      >
                        Pending
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {confirmingMasterId === id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
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
                                <UserCheck className="h-4 w-4 mr-1" />
                                Yes, make master
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={cancelConversion}
                            disabled={isConverting}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        // Normal buttons
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                            onClick={() => openConversionForm(account, 'master')}
                            disabled={isConverting}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Make Master
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            onClick={() => openConversionForm(account, 'slave')}
                            disabled={isConverting}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Make Slave
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                            onClick={() => deletePendingAccount(id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Platform:</strong> {account.platform || 'Unknown'}
                    </p>
                    <p className="text-orange-600">
                      <strong>Waiting since:</strong> {getTimeSinceFirstSeen(account.firstSeen)}
                    </p>
                  </div>

                  {/* Inline Conversion Form */}
                  {expandedAccountId === id && (
                    <div className="mt-4 p-4 border rounded-lg border-green-400 bg-green-50 shadow">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-green-700">
                          Convert {id} to Slave Account
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelConversion}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          disabled={isConverting}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>

                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          convertAccount();
                        }}
                        className="space-y-4"
                      >
                        {/* Trading Configuration */}
                        <div className="space-y-4">
                          {/* First Row: Master Connection + Lot Multiplier */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Master Connection Section */}
                            {masterAccounts.length > 0 && (
                              <div>
                                <Label htmlFor="convert-master">Connect to Master account</Label>
                                <Select
                                  value={conversionForm.masterAccountId}
                                  onValueChange={value =>
                                    setConversionForm(prev => ({ ...prev, masterAccountId: value }))
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
                              <p className="text-xs text-muted-foreground mt-1">
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
                              <p className="text-xs text-muted-foreground mt-1">
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
                              <Label htmlFor="reverseTrade" className="font-medium cursor-pointer">
                                Reverse trades (Buy → Sell, Sell → Buy)
                              </Label>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            onClick={cancelConversion}
                            variant="outline"
                            disabled={isConverting}
                            className="bg-white border border-gray-200 hover:bg-gray-50"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={isConverting}
                            className="bg-white border border-gray-200 hover:bg-gray-50"
                          >
                            {isConverting ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                                Converting...
                              </>
                            ) : (
                              'Convert to Slave'
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};
