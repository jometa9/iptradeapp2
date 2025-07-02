import React, { useEffect, useState } from 'react';

import { AlertTriangle, Power, PowerOff, RefreshCw, Shield, ShieldOff } from 'lucide-react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { toast } from './ui/use-toast';

interface CopierStatus {
  globalStatus: boolean;
  globalStatusText: string;
  masterAccounts: Record<
    string,
    {
      masterStatus: boolean;
      effectiveStatus: boolean;
      status: string;
    }
  >;
  totalMasterAccounts: number;
}

interface AccountsData {
  masterAccounts: Record<
    string,
    {
      id: string;
      name: string;
      platform: string;
      connectedSlaves: Array<{
        id: string;
        name: string;
        platform: string;
      }>;
      totalSlaves: number;
    }
  >;
  unconnectedSlaves: Array<{
    id: string;
    name: string;
    platform: string;
  }>;
}

interface SlaveConfig {
  slaveAccountId: string;
  config: {
    enabled: boolean;
    description: string;
    lastUpdated: string | null;
  };
}

export const CopierStatusControls: React.FC = () => {
  const [copierStatus, setCopierStatus] = useState<CopierStatus | null>(null);
  const [accounts, setAccounts] = useState<AccountsData | null>(null);
  const [slaveConfigs, setSlaveConfigs] = useState<Record<string, SlaveConfig>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
  const baseUrl = `http://localhost:${serverPort}/api`;

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);

      // Load copier status
      const copierResponse = await fetch(`${baseUrl}/copier/status`);
      if (copierResponse.ok) {
        const copierData = await copierResponse.json();
        setCopierStatus(copierData);
      }

      // Load accounts
      const accountsResponse = await fetch(`${baseUrl}/accounts/all`);
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);

        // Load slave configurations for all slaves
        const allSlaves = [
          ...Object.values(accountsData.masterAccounts || {}).flatMap(
            master => master.connectedSlaves || []
          ),
          ...(accountsData.unconnectedSlaves || []),
        ];

        const slaveConfigPromises = allSlaves.map(async slave => {
          try {
            const response = await fetch(`${baseUrl}/slave-config/${slave.id}`);
            if (response.ok) {
              const config = await response.json();
              return { [slave.id]: config };
            }
          } catch (error) {
            console.error(`Failed to load config for slave ${slave.id}:`, error);
          }
          return {};
        });

        const slaveConfigResults = await Promise.all(slaveConfigPromises);
        const mergedSlaveConfigs = Object.assign({}, ...slaveConfigResults);
        setSlaveConfigs(mergedSlaveConfigs);
      }
    } catch (error) {
      console.error('Error loading copier data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load copier status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle global copier status
  const toggleGlobalStatus = async (enabled: boolean) => {
    try {
      setUpdating('global');
      const response = await fetch(`${baseUrl}/copier/global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message,
        });
        loadData(); // Reload to get updated status
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
      setUpdating(null);
    }
  };

  // Toggle master account status
  const toggleMasterStatus = async (masterAccountId: string, enabled: boolean) => {
    try {
      setUpdating(`master-${masterAccountId}`);
      const response = await fetch(`${baseUrl}/copier/master`, {
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
        loadData();
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
      setUpdating(null);
    }
  };

  // Toggle slave account status
  const toggleSlaveStatus = async (slaveAccountId: string, enabled: boolean) => {
    try {
      setUpdating(`slave-${slaveAccountId}`);
      const response = await fetch(`${baseUrl}/slave-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slaveAccountId, enabled }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: `Slave ${slaveAccountId} ${enabled ? 'enabled' : 'disabled'}`,
        });
        loadData();
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
      setUpdating(null);
    }
  };

  // Emergency shutdown
  const emergencyShutdown = async () => {
    if (!confirm('⚠️ EMERGENCY SHUTDOWN: This will turn OFF all copiers immediately. Continue?')) {
      return;
    }

    try {
      setUpdating('emergency');
      const response = await fetch(`${baseUrl}/copier/emergency-shutdown`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Emergency Shutdown Executed',
          description: result.message,
          variant: 'destructive',
        });
        loadData();
      } else {
        throw new Error('Failed to execute emergency shutdown');
      }
    } catch (error) {
      console.error('Error executing emergency shutdown:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute emergency shutdown',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  // Reset all to ON
  const resetAllToOn = async () => {
    if (!confirm('Reset all copier statuses to ON?')) {
      return;
    }

    try {
      setUpdating('reset');
      const response = await fetch(`${baseUrl}/copier/reset-all-on`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message,
        });
        loadData();
      } else {
        throw new Error('Failed to reset all statuses');
      }
    } catch (error) {
      console.error('Error resetting statuses:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset all statuses',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: boolean) => {
    return status ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <Power className="w-3 h-3 mr-1" />
        ON
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <PowerOff className="w-3 h-3 mr-1" />
        OFF
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Copier Status Controls</CardTitle>
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
      {/* Global Controls */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Copier Status Controls
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={emergencyShutdown}
                disabled={updating === 'emergency'}
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Emergency Stop
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={resetAllToOn}
                disabled={updating === 'reset'}
              >
                <Power className="w-4 h-4 mr-2" />
                Reset All ON
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Global Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900">Global Copier Status</h3>
                  <p className="text-sm text-blue-700">Master control for all copying operations</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(copierStatus?.globalStatus || false)}
                <Switch
                  checked={copierStatus?.globalStatus || false}
                  onCheckedChange={toggleGlobalStatus}
                  disabled={updating === 'global'}
                />
              </div>
            </div>
            {!copierStatus?.globalStatus && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Global copier is OFF - No signals will be copied regardless of individual settings
              </div>
            )}
          </div>

          {/* Master Accounts */}
          {accounts && Object.keys(accounts.masterAccounts).length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Master Accounts</h4>
              {Object.entries(accounts.masterAccounts).map(([masterId, master]) => {
                const masterStatus = copierStatus?.masterAccounts[masterId];
                const isUpdating = updating === `master-${masterId}`;

                return (
                  <div key={masterId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{master.name || masterId}</h5>
                        <Badge variant="outline">{master.platform}</Badge>
                        <Badge variant="secondary">{master.totalSlaves} slaves</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(masterStatus?.effectiveStatus || false)}
                        <Switch
                          checked={masterStatus?.masterStatus || false}
                          onCheckedChange={enabled => toggleMasterStatus(masterId, enabled)}
                          disabled={isUpdating || !copierStatus?.globalStatus}
                        />
                      </div>
                    </div>

                    {/* Connected Slaves */}
                    {master.connectedSlaves && master.connectedSlaves.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium mb-2 text-gray-600">Connected slaves:</p>
                        <div className="space-y-2">
                          {master.connectedSlaves.map(slave => {
                            const slaveConfig = slaveConfigs[slave.id];
                            const slaveEnabled = slaveConfig?.config?.enabled !== false;
                            const isSlaveUpdating = updating === `slave-${slave.id}`;
                            const effectiveSlaveStatus =
                              copierStatus?.globalStatus &&
                              masterStatus?.masterStatus &&
                              slaveEnabled;

                            return (
                              <div
                                key={slave.id}
                                className="flex items-center justify-between bg-gray-50 rounded p-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{slave.name || slave.id}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {slave.platform}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(effectiveSlaveStatus || false)}
                                  <Switch
                                    checked={slaveEnabled}
                                    onCheckedChange={enabled =>
                                      toggleSlaveStatus(slave.id, enabled)
                                    }
                                    disabled={
                                      isSlaveUpdating ||
                                      !copierStatus?.globalStatus ||
                                      !masterStatus?.masterStatus
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Unconnected Slaves */}
          {accounts && accounts.unconnectedSlaves.length > 0 && (
            <div className="space-y-4 mt-6">
              <h4 className="font-semibold text-gray-900">Unconnected Slave Accounts</h4>
              <div className="space-y-2">
                {accounts.unconnectedSlaves.map(slave => {
                  const slaveConfig = slaveConfigs[slave.id];
                  const slaveEnabled = slaveConfig?.config?.enabled !== false;
                  const isSlaveUpdating = updating === `slave-${slave.id}`;

                  return (
                    <div
                      key={slave.id}
                      className="flex items-center justify-between border rounded p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{slave.name || slave.id}</span>
                        <Badge variant="outline">{slave.platform}</Badge>
                        <Badge variant="destructive">Not connected</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge((slaveEnabled && copierStatus?.globalStatus) || false)}
                        <Switch
                          checked={slaveEnabled}
                          onCheckedChange={enabled => toggleSlaveStatus(slave.id, enabled)}
                          disabled={isSlaveUpdating || !copierStatus?.globalStatus}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
