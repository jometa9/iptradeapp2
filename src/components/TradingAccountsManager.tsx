import React, { useEffect, useState } from 'react';

import { Plus, Trash2, Unlink, Users } from 'lucide-react';

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

interface TradingAccount {
  id: string;
  name: string;
  description: string;
  broker: string;
  platform: string;
  registeredAt: string;
  lastActivity: string | null;
  status: string;
}

interface MasterAccountWithSlaves extends TradingAccount {
  connectedSlaves: TradingAccount[];
  totalSlaves: number;
}

interface SlaveAccount extends TradingAccount {
  connectedTo: string | null;
  masterAccount: TradingAccount | null;
}

interface AccountsData {
  masterAccounts: Record<string, MasterAccountWithSlaves>;
  unconnectedSlaves: SlaveAccount[];
  totalMasterAccounts: number;
  totalSlaveAccounts: number;
  totalConnections: number;
}

const PLATFORMS = [
  { value: 'MT4', label: 'MetaTrader 4' },
  { value: 'MT5', label: 'MetaTrader 5' },
  { value: 'cTrader', label: 'cTrader' },
  { value: 'TradingView', label: 'TradingView' },
  { value: 'NinjaTrader', label: 'NinjaTrader' },
  { value: 'Other', label: 'Other Platform' },
];

export const TradingAccountsManager: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMasterDialog, setShowMasterDialog] = useState(false);
  const [showSlaveDialog, setShowSlaveDialog] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingDisconnectId, setConfirmingDisconnectId] = useState<string | null>(null);
  const [confirmingDisconnectAllId, setConfirmingDisconnectAllId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [masterForm, setMasterForm] = useState({
    masterAccountId: '',
    name: '',
    description: '',
    broker: '',
    platform: '',
  });
  const [slaveForm, setSlaveForm] = useState({
    slaveAccountId: '',
    name: '',
    description: '',
    broker: '',
    platform: '',
    masterAccountId: 'none',
  });

  const serverPort = import.meta.env.VITE_SERVER_PORT;
  const baseUrl = `http://localhost:${serverPort}/api`;

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/accounts/admin/all`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      } else {
        throw new Error('Failed to load accounts');
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trading accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const registerMasterAccount = async () => {
    try {
      const response = await fetch(`${baseUrl}/accounts/master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(masterForm),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Master account registered successfully',
        });
        setShowMasterDialog(false);
        setMasterForm({ masterAccountId: '', name: '', description: '', broker: '', platform: '' });
        loadAccounts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register master account');
      }
    } catch (error) {
      console.error('Error registering master account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error registering master account',
        variant: 'destructive',
      });
    }
  };

  const registerSlaveAccount = async () => {
    try {
      const response = await fetch(`${baseUrl}/accounts/slave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slaveForm),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Slave account registered successfully',
        });
        setShowSlaveDialog(false);
        setSlaveForm({
          slaveAccountId: '',
          name: '',
          description: '',
          broker: '',
          platform: '',
          masterAccountId: 'none',
        });
        loadAccounts();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register slave account');
      }
    } catch (error) {
      console.error('Error registering slave account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error registering slave account',
        variant: 'destructive',
      });
    }
  };

  const deleteMasterAccount = async (masterAccountId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${baseUrl}/accounts/master/${masterAccountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Master account deleted successfully',
        });
        setConfirmingDeleteId(null);
        loadAccounts();
      } else {
        throw new Error('Failed to delete master account');
      }
    } catch (error) {
      console.error('Error deleting master account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete master account',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteSlaveAccount = async (slaveAccountId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${baseUrl}/accounts/slave/${slaveAccountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Slave account deleted successfully',
        });
        setConfirmingDeleteId(null);
        loadAccounts();
      } else {
        throw new Error('Failed to delete slave account');
      }
    } catch (error) {
      console.error('Error deleting slave account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete slave account',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const disconnectSlaveAccount = async (slaveAccountId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${baseUrl}/accounts/disconnect/${slaveAccountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Slave account disconnected successfully',
        });
        setConfirmingDisconnectId(null);
        loadAccounts();
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
      setIsProcessing(false);
    }
  };

  const disconnectAllSlaves = async (masterAccountId: string) => {
    setIsProcessing(true);
    try {
      // Get all connected slaves for this master
      const connectedSlaves = accounts?.masterAccounts[masterAccountId]?.connectedSlaves || [];
      const slaveIds = connectedSlaves.map(slave => slave.id);

      // Disconnect each slave
      const disconnectPromises = slaveIds.map(slaveId =>
        fetch(`${baseUrl}/accounts/disconnect/${slaveId}`, { method: 'DELETE' })
      );

      await Promise.all(disconnectPromises);

      toast({
        title: 'Success',
        description: `All ${slaveIds.length} slave accounts disconnected successfully`,
      });
      setConfirmingDisconnectAllId(null);
      loadAccounts();
    } catch (error) {
      console.error('Error disconnecting all slaves:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect all slave accounts',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelAction = () => {
    setConfirmingDeleteId(null);
    setConfirmingDisconnectId(null);
    setConfirmingDisconnectAllId(null);
  };

  const getPlatformBadgeColor = (platform: string) => {
    switch (platform) {
      case 'MT4':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MT5':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cTrader':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'TradingView':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'NinjaTrader':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trading Accounts Management</CardTitle>
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
    <div className="space-y-6">
      {/* Header with stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Trading Accounts Management
            <div className="flex gap-2">
              <Dialog open={showMasterDialog} onOpenChange={setShowMasterDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Master Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register Master Account</DialogTitle>
                    <DialogDescription>
                      Master accounts send trading signals to connected slave accounts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="masterAccountId">Account ID *</Label>
                      <Input
                        id="masterAccountId"
                        placeholder="Ex: Main EURUSD Account"
                        value={masterForm.masterAccountId}
                        onChange={e =>
                          setMasterForm({ ...masterForm, masterAccountId: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterName">Name</Label>
                      <Input
                        id="masterName"
                        placeholder="Ex: Main EURUSD Account"
                        value={masterForm.name}
                        onChange={e => setMasterForm({ ...masterForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterPlatform">Platform *</Label>
                      <Select
                        value={masterForm.platform}
                        onValueChange={value => setMasterForm({ ...masterForm, platform: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map(platform => (
                            <SelectItem key={platform.value} value={platform.value}>
                              {platform.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="masterBroker">Broker</Label>
                      <Input
                        id="masterBroker"
                        placeholder="Ex: IC Markets"
                        value={masterForm.broker}
                        onChange={e => setMasterForm({ ...masterForm, broker: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterDescription">Description</Label>
                      <Textarea
                        id="masterDescription"
                        placeholder="Optional account description"
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
                    <Button
                      onClick={registerMasterAccount}
                      disabled={!masterForm.masterAccountId || !masterForm.platform}
                    >
                      Register
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showSlaveDialog} onOpenChange={setShowSlaveDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Slave Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register Slave Account</DialogTitle>
                    <DialogDescription>
                      Slave accounts receive and execute signals from a specific master account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="slaveAccountId">Account ID *</Label>
                      <Input
                        id="slaveAccountId"
                        placeholder="Ex: Follower Account 1"
                        value={slaveForm.slaveAccountId}
                        onChange={e =>
                          setSlaveForm({ ...slaveForm, slaveAccountId: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="slaveName">Name</Label>
                      <Input
                        id="slaveName"
                        placeholder="Ex: Follower Account 1"
                        value={slaveForm.name}
                        onChange={e => setSlaveForm({ ...slaveForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="slavePlatform">Platform *</Label>
                      <Select
                        value={slaveForm.platform}
                        onValueChange={value => setSlaveForm({ ...slaveForm, platform: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map(platform => (
                            <SelectItem key={platform.value} value={platform.value}>
                              {platform.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="slaveBroker">Broker</Label>
                      <Input
                        id="slaveBroker"
                        placeholder="Ex: IC Markets"
                        value={slaveForm.broker}
                        onChange={e => setSlaveForm({ ...slaveForm, broker: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterConnection">Connect to Master (optional)</Label>
                      <Select
                        value={slaveForm.masterAccountId}
                        onValueChange={value =>
                          setSlaveForm({ ...slaveForm, masterAccountId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a master" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not connected</SelectItem>
                          {accounts &&
                            Object.entries(accounts.masterAccounts).map(([id, master]) => (
                              <SelectItem key={id} value={id}>
                                {master.name || id} ({master.platform})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="slaveDescription">Description</Label>
                      <Textarea
                        id="slaveDescription"
                        placeholder="Optional account description"
                        value={slaveForm.description}
                        onChange={e => setSlaveForm({ ...slaveForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSlaveDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={registerSlaveAccount}
                      disabled={!slaveForm.slaveAccountId || !slaveForm.platform}
                    >
                      Register
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {accounts?.totalMasterAccounts || 0}
              </div>
              <div className="text-sm text-blue-700">Master Accounts</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {accounts?.totalSlaveAccounts || 0}
              </div>
              <div className="text-sm text-green-700">Slave Accounts</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {accounts?.totalConnections || 0}
              </div>
              <div className="text-sm text-purple-700">Active Connections</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {accounts?.unconnectedSlaves.length || 0}
              </div>
              <div className="text-sm text-gray-700">Unconnected Slaves</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Master Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Master Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts && Object.keys(accounts.masterAccounts).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(accounts.masterAccounts).map(([id, master]) => (
                <div key={id} className="border rounded-lg p-4 bg-blue-50 border-blue-200 shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-blue-900">{master.name || id}</h3>
                      <Badge className={getPlatformBadgeColor(master.platform)}>
                        {master.platform || 'N/A'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 border-blue-300"
                      >
                        {master.totalSlaves > 0 ? `${master.totalSlaves} slaves` : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-left lg:p-0 lg:m-0">
                      {confirmingDeleteId === id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                            onClick={() => deleteMasterAccount(id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-1" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={cancelAction}
                            disabled={isProcessing}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : confirmingDisconnectAllId === id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                            onClick={() => disconnectAllSlaves(id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent mr-1" />
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <Unlink className="h-4 w-4 mr-1" />
                                Disconnect all
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={cancelAction}
                            disabled={isProcessing}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                            onClick={() => setConfirmingDeleteId(id)}
                            disabled={isProcessing}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                          {master.totalSlaves > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                              onClick={() => setConfirmingDisconnectAllId(id)}
                              disabled={isProcessing}
                            >
                              <Unlink className="h-4 w-4 mr-1" />
                              Disconnect All
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>ID:</strong> {id}
                    </p>
                    {master.broker && (
                      <p>
                        <strong>Broker:</strong> {master.broker}
                      </p>
                    )}
                    {master.description && (
                      <p>
                        <strong>Description:</strong> {master.description}
                      </p>
                    )}
                    <p>
                      <strong>Registered:</strong>{' '}
                      {new Date(master.registeredAt).toLocaleDateString()}
                    </p>
                  </div>
                  {master.connectedSlaves.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium mb-2 text-blue-700">Connected slaves:</p>
                      <div className="space-y-2">
                        {master.connectedSlaves.map(slave => (
                          <div
                            key={slave.id}
                            className="flex items-center justify-between p-2 bg-blue-100 rounded border border-blue-300"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-xs bg-blue-200 text-blue-800"
                              >
                                {slave.name || slave.id}
                              </Badge>
                              <Badge className={`text-xs ${getPlatformBadgeColor(slave.platform)}`}>
                                {slave.platform}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {confirmingDisconnectId === slave.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 text-xs"
                                    onClick={() => disconnectSlaveAccount(slave.id)}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <>
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-600 border-t-transparent mr-1" />
                                        Disconnecting...
                                      </>
                                    ) : (
                                      <>
                                        <Unlink className="h-3 w-3 mr-1" />
                                        Disconnect
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 text-xs"
                                    onClick={cancelAction}
                                    disabled={isProcessing}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 text-xs"
                                  onClick={() => setConfirmingDisconnectId(slave.id)}
                                  disabled={isProcessing}
                                >
                                  <Unlink className="h-3 w-3 mr-1" />
                                  Disconnect
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No master accounts registered</div>
          )}
        </CardContent>
      </Card>

      {/* Unconnected Slaves */}
      {accounts && accounts.unconnectedSlaves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unconnected Slave Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accounts.unconnectedSlaves.map(slave => (
                <div
                  key={slave.id}
                  className="border rounded-lg p-4 bg-gray-50 border-gray-200 shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{slave.name || slave.id}</h3>
                      <Badge className={getPlatformBadgeColor(slave.platform)}>
                        {slave.platform || 'N/A'}
                      </Badge>
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                        Not connected
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-left lg:p-0 lg:m-0">
                      {confirmingDeleteId === slave.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                            onClick={() => deleteSlaveAccount(slave.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-1" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={cancelAction}
                            disabled={isProcessing}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          onClick={() => setConfirmingDeleteId(slave.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>ID:</strong> {slave.id}
                    </p>
                    {slave.broker && (
                      <p>
                        <strong>Broker:</strong> {slave.broker}
                      </p>
                    )}
                    {slave.description && (
                      <p>
                        <strong>Description:</strong> {slave.description}
                      </p>
                    )}
                    <p>
                      <strong>Registered:</strong>{' '}
                      {new Date(slave.registeredAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
