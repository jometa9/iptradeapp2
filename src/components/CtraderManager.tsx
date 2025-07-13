import React, { useCallback, useEffect, useState } from 'react';

import { CheckCircle, ExternalLink, Link, Users, Wifi, WifiOff } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useExternalLink } from '../hooks/useExternalLink';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from './ui/use-toast';

interface CtraderAccount {
  accountId: string;
  accountNumber: string;
  brokerName: string;
  depositAssetId: string;
  tradingMode: string;
  accountType: string;
  live: boolean;
}

interface CtraderStatus {
  authenticated: boolean;
  connected: boolean;
  accounts: CtraderAccount[];
  lastHeartbeat?: number;
  shouldReconnect?: boolean;
}

interface RegisterAccountForm {
  accountId: string;
  name: string;
  description: string;
  masterAccountId?: string;
}

interface MasterAccount {
  id: string;
  name: string;
  platform: string;
  description?: string;
}

export const CtraderManager: React.FC = () => {
  const { userInfo, isAuthenticated, secretKey } = useAuth();
  const { openExternalLink } = useExternalLink();
  const [status, setStatus] = useState<CtraderStatus>({
    authenticated: false,
    connected: false,
    accounts: [],
    shouldReconnect: false,
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showMasterDialog, setShowMasterDialog] = useState(false);
  const [showSlaveDialog, setShowSlaveDialog] = useState(false);
  const [masterForm, setMasterForm] = useState<RegisterAccountForm>({
    accountId: '',
    name: '',
    description: '',
  });
  const [slaveForm, setSlaveForm] = useState<RegisterAccountForm>({
    accountId: '',
    name: '',
    description: '',
    masterAccountId: '',
  });
  const [masterAccounts, setMasterAccounts] = useState<MasterAccount[]>([]);

  const serverPort = import.meta.env.VITE_SERVER_PORT;
  const baseUrl = `http://localhost:${serverPort}/api`;

  // Get userId from authenticated user context
  const userId = userInfo?.userId;

  const loadStatus = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/ctrader/auth/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 cTrader Status Update:', {
          authenticated: data.authenticated,
          connected: data.connection.connected,
          accountsCount: data.accounts.length,
          shouldReconnect: data.shouldReconnect,
          wsState: data.connection.wsState,
        });

        setStatus({
          authenticated: data.authenticated,
          connected: data.connection.connected,
          accounts: data.accounts,
          lastHeartbeat: data.connection.lastHeartbeat,
          shouldReconnect: data.shouldReconnect,
        });
      }
    } catch (error) {
      console.error('Error loading cTrader status:', error);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, userId]);

  const loadMasterAccounts = useCallback(async () => {
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
      }
    } catch (error) {
      console.error('Error loading master accounts:', error);
    }
  }, [baseUrl, secretKey]);

  useEffect(() => {
    if (userId) {
      loadStatus();
      loadMasterAccounts();
    } else {
      setLoading(false);
    }
  }, [userId, loadStatus, loadMasterAccounts]);

  const initiateAuth = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/ctrader/auth/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Open OAuth URL in new window
        openExternalLink(data.authUrl);

        // Listen for auth completion
        const checkAuth = setInterval(async () => {
          await loadStatus();
          if (status.authenticated) {
            clearInterval(checkAuth);
            toast({
              title: 'Success',
              description: 'Authentication with cTrader completed',
            });
          }
        }, 2000);

        // Stop checking after 5 minutes
        setTimeout(() => clearInterval(checkAuth), 300000);
      }
    } catch (error) {
      console.error('Error initiating cTrader auth:', error);
      toast({
        title: 'Error',
        description: 'Error initiating authentication with cTrader',
        variant: 'destructive',
      });
    }
  };

  const connectToApi = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      setConnecting(true);
      console.log('🚀 Getting cTrader accounts via REST API...');

      const response = await fetch(`${baseUrl}/ctrader/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎉 cTrader REST API Success:', {
          accountsFound: data.accountsFound,
          totalAccounts: data.accounts?.length,
          accounts: data.accounts,
        });

        toast({
          title: 'Success',
          description: `Found ${data.accountsFound} cTrader accounts via REST API`,
        });

        // Update status with new accounts
        setStatus(prev => ({
          ...prev,
          connected: true,
          accounts: data.accounts || [],
          lastHeartbeat: Date.now(),
        }));

        // Also reload status to get fresh data
        await loadStatus();
      } else {
        const error = await response.json();
        console.error('❌ REST API failed:', error);
        toast({
          title: 'Connection Failed',
          description: error.details || 'Failed to get accounts from cTrader',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ Error getting cTrader accounts:', error);
      toast({
        title: 'Error',
        description: 'Error connecting to cTrader API',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const refreshAccounts = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      setConnecting(true);
      console.log('🔄 Refreshing cTrader accounts via REST API...');

      const response = await fetch(`${baseUrl}/ctrader/accounts/refresh/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎉 Accounts refreshed successfully:', {
          accountsFound: data.accountsFound,
          totalAccounts: data.accounts?.length,
          refreshedAt: data.refreshedAt,
        });

        toast({
          title: 'Accounts Refreshed',
          description: `Found ${data.accountsFound} cTrader accounts`,
        });

        // Update status with refreshed accounts
        setStatus(prev => ({
          ...prev,
          connected: true,
          accounts: data.accounts || [],
          lastHeartbeat: Date.now(),
        }));

        // Also reload status to get fresh data
        await loadStatus();
      } else {
        const error = await response.json();
        console.error('❌ Failed to refresh accounts:', error);
        toast({
          title: 'Refresh Failed',
          description: error.details || 'Failed to refresh accounts from cTrader',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ Error refreshing cTrader accounts:', error);
      toast({
        title: 'Error',
        description: 'Error refreshing cTrader accounts',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/ctrader/disconnect/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: 'Disconnected from cTrader API',
        });
        await loadStatus();
      }
    } catch (error) {
      console.error('Error disconnecting from cTrader API:', error);
      toast({
        title: 'Error',
        description: 'Error disconnecting from cTrader API',
        variant: 'destructive',
      });
    }
  };

  const registerMasterAccount = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/ctrader/register/master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          accountId: masterForm.accountId,
          name: masterForm.name,
          description: masterForm.description,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Now register with your existing system
        const registerResponse = await fetch(`${baseUrl}/accounts/master`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data.masterAccount),
        });

        if (registerResponse.ok) {
          toast({
            title: 'Success',
            description: 'cTrader master account registered',
          });
          setShowMasterDialog(false);
          setMasterForm({ accountId: '', name: '', description: '' });
          loadMasterAccounts();
        }
      }
    } catch (error) {
      console.error('Error registering cTrader master:', error);
      toast({
        title: 'Error',
        description: 'Error registering master account',
        variant: 'destructive',
      });
    }
  };

  const registerSlaveAccount = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/ctrader/register/slave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          accountId: slaveForm.accountId,
          name: slaveForm.name,
          description: slaveForm.description,
          masterAccountId: slaveForm.masterAccountId,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Now register with your existing system
        const registerResponse = await fetch(`${baseUrl}/accounts/slave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data.slaveAccount),
        });

        if (registerResponse.ok) {
          toast({
            title: 'Success',
            description: 'cTrader slave account registered',
          });
          setShowSlaveDialog(false);
          setSlaveForm({ accountId: '', name: '', description: '', masterAccountId: '' });
        }
      }
    } catch (error) {
      console.error('Error registering cTrader slave:', error);
      toast({
        title: 'Error',
        description: 'Error registering slave account',
        variant: 'destructive',
      });
    }
  };

  const revokeAuth = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to revoke the authentication with cTrader?')) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/ctrader/auth/revoke/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Authentication revoked',
          description: 'Access to cTrader revoked',
        });
        await loadStatus();
      }
    } catch (error) {
      console.error('Error revoking cTrader auth:', error);
      toast({
        title: 'Error',
        description: 'Error revoking authentication',
        variant: 'destructive',
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">cTrader Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">
              Please authenticate to access cTrader integration
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">cTrader Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">cTrader Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Status */}
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${status.authenticated ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <div>
              <p className="font-medium">Authentication Status</p>
              <p className="text-sm text-muted-foreground">
                {status.authenticated ? 'Authenticated with cTrader' : 'Not authenticated'}
              </p>
            </div>
          </div>
          {!status.authenticated ? (
            <Button onClick={initiateAuth} size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Authenticate
            </Button>
          ) : (
            <Button onClick={revokeAuth} variant="outline" size="sm">
              Revoke access
            </Button>
          )}
        </div>

        {/* Connection Status */}
        {status.authenticated && (
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              {status.connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="font-medium">API Connection</p>
                <p className="text-sm text-muted-foreground">
                  {status.connected ? 'Connected to cTrader API' : 'Disconnected'}
                </p>
                {status.shouldReconnect && (
                  <p className="text-xs text-amber-600 font-medium">
                    ⚠️ Connection lost - Click reconnect to restore access to your accounts
                  </p>
                )}
                {status.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground">
                    Último heartbeat: {new Date(status.lastHeartbeat).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {!status.connected ? (
                <Button
                  onClick={connectToApi}
                  disabled={connecting}
                  size="sm"
                  variant={status.shouldReconnect ? 'default' : 'outline'}
                >
                  {connecting ? 'Connecting...' : status.shouldReconnect ? 'Reconnect' : 'Connect'}
                </Button>
              ) : (
                <Button onClick={disconnect} variant="outline" size="sm">
                  Disconnect
                </Button>
              )}
              {status.authenticated && (
                <Button onClick={refreshAccounts} variant="ghost" size="sm">
                  Refresh Accounts
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Accounts List */}
        {status.accounts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">cTrader Accounts</h3>
              <div className="flex gap-2">
                <Dialog open={showMasterDialog} onOpenChange={setShowMasterDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Users className="h-4 w-4 mr-2" />
                      Register Master
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register Master Account</DialogTitle>
                      <DialogDescription>
                        Register a cTrader account as a master account for copy trading
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="masterAccountSelect">cTrader Account *</Label>
                        <Select
                          value={masterForm.accountId}
                          onValueChange={value =>
                            setMasterForm({ ...masterForm, accountId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an account" />
                          </SelectTrigger>
                          <SelectContent>
                            {status.accounts.map(account => (
                              <SelectItem key={account.accountId} value={account.accountId}>
                                {account.brokerName} - {account.accountNumber}
                                {account.live ? ' (Live)' : ' (Demo)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="masterName">Name</Label>
                        <Input
                          id="masterName"
                          placeholder="Descriptive name"
                          value={masterForm.name}
                          onChange={e => setMasterForm({ ...masterForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="masterDescription">Description</Label>
                        <Textarea
                          id="masterDescription"
                          placeholder="Description of the strategy"
                          value={masterForm.description}
                          onChange={e =>
                            setMasterForm({ ...masterForm, description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowMasterDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={registerMasterAccount} disabled={!masterForm.accountId}>
                        Register
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showSlaveDialog} onOpenChange={setShowSlaveDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Link className="h-4 w-4 mr-2" />
                      Register Slave
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register Slave Account</DialogTitle>
                      <DialogDescription>
                        Register a cTrader account as a slave account (follower)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="slaveAccountSelect">cTrader Account *</Label>
                        <Select
                          value={slaveForm.accountId}
                          onValueChange={value => setSlaveForm({ ...slaveForm, accountId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an account" />
                          </SelectTrigger>
                          <SelectContent>
                            {status.accounts.map(account => (
                              <SelectItem key={account.accountId} value={account.accountId}>
                                {account.brokerName} - {account.accountNumber}
                                {account.live ? ' (Live)' : ' (Demo)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="slaveMasterSelect">Master Account *</Label>
                        <Select
                          value={slaveForm.masterAccountId}
                          onValueChange={value =>
                            setSlaveForm({ ...slaveForm, masterAccountId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a master account" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterAccounts.map(master => (
                              <SelectItem key={master.id} value={master.id}>
                                {master.name} ({master.platform})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="slaveName">Name</Label>
                        <Input
                          id="slaveName"
                          placeholder="Descriptive name"
                          value={slaveForm.name}
                          onChange={e => setSlaveForm({ ...slaveForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="slaveDescription">Description</Label>
                        <Textarea
                          id="slaveDescription"
                          placeholder="Description of the account"
                          value={slaveForm.description}
                          onChange={e =>
                            setSlaveForm({ ...slaveForm, description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSlaveDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={registerSlaveAccount}
                        disabled={!slaveForm.accountId || !slaveForm.masterAccountId}
                      >
                        Register
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-4">
              {status.accounts.map(account => (
                <div
                  key={account.accountId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">{account.brokerName}</p>
                      <p className="text-sm text-muted-foreground">
                        Account: {account.accountNumber} • {account.tradingMode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={account.live ? 'default' : 'secondary'}>
                      {account.live ? 'Live' : 'Demo'}
                    </Badge>
                    <Badge variant="outline">{account.accountType}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status.authenticated && status.accounts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              {status.connected
                ? 'No cTrader accounts found'
                : 'Connect to cTrader API to see your accounts'}
            </p>
            {status.shouldReconnect && (
              <div className="text-sm text-amber-600 mb-3">
                <p>🔄 Your accounts were connected before but are not visible now.</p>
                <p>This usually means the connection was lost. Try reconnecting.</p>
              </div>
            )}
            <div className="flex gap-2 justify-center">
              {!status.connected && (
                <Button onClick={connectToApi} disabled={connecting} size="sm">
                  {connecting ? 'Connecting...' : 'Connect to cTrader'}
                </Button>
              )}
              <Button onClick={loadStatus} variant="outline" size="sm">
                Refresh Status
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
