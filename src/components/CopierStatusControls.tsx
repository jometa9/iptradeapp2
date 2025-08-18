import React, { useEffect, useState } from 'react';

import { AlertTriangle, Power, PowerOff, RefreshCw, Shield, ShieldOff } from 'lucide-react';

// useAuth not used in this component
import { useCSVData } from '../hooks/useCSVData';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { toast } from './ui/use-toast';

// Types moved to useCSVData hook

export const CopierStatusControls: React.FC = () => {
  const [updating, setUpdating] = useState<string | null>(null);
  // secretKey not used in this component

  // Usar el hook unificado que maneja todo con SSE
  const {
    copierStatus,
    accounts,
    slaveConfigs,
    loading,
    error,
    updateGlobalStatus,
    updateMasterStatus,
    updateSlaveConfig,
    emergencyShutdown,
    resetAllToOn,
    scanCSVFiles,
    refresh,
  } = useCSVData();

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error]);

  // Toggle global copier status using SSE
  const toggleGlobalStatus = async (enabled: boolean) => {
    try {
      console.log('🔄 Toggling global copier status to:', enabled);
      setUpdating('global');
      await updateGlobalStatus(enabled);
      console.log('✅ Global copier status updated successfully');
      toast({
        title: 'Success',
        description: `Global copier ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('❌ Error updating global status:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update global copier status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  // Toggle master account status using SSE
  const toggleMasterStatus = async (masterAccountId: string, enabled: boolean) => {
    try {
      setUpdating(`master-${masterAccountId}`);
      await updateMasterStatus(masterAccountId, enabled);
      toast({
        title: 'Success',
        description: `Master ${masterAccountId} ${enabled ? 'enabled' : 'disabled'}`,
      });
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

  // Toggle slave account status using SSE
  const toggleSlaveStatus = async (slaveAccountId: string, enabled: boolean) => {
    try {
      setUpdating(`slave-${slaveAccountId}`);
      await updateSlaveConfig(slaveAccountId, enabled);
      toast({
        title: 'Success',
        description: `Slave ${slaveAccountId} ${enabled ? 'enabled' : 'disabled'}`,
      });
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

  // Emergency shutdown using SSE
  const handleEmergencyShutdown = async () => {
    if (!confirm('⚠️ EMERGENCY SHUTDOWN: This will turn OFF all copiers immediately. Continue?')) {
      return;
    }

    try {
      setUpdating('emergency');
      await emergencyShutdown();
      toast({
        title: 'Emergency Shutdown Executed',
        description: 'All copiers disabled',
        variant: 'destructive',
      });
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

  // Reset all to ON using SSE
  const handleResetAllToOn = async () => {
    if (!confirm('Reset all copier statuses to ON?')) {
      return;
    }

    try {
      setUpdating('reset');
      await resetAllToOn();
      toast({
        title: 'Success',
        description: 'All copier statuses reset to ON',
      });
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

  // Scan CSV files using SSE
  const handleScanCSVFiles = async () => {
    try {
      await scanCSVFiles();
      toast({
        title: 'CSV Scan Complete',
        description: 'CSV files scanned successfully',
      });
    } catch (error) {
      console.error('Error scanning CSV files:', error);
      toast({
        title: 'Error',
        description: 'Failed to scan CSV files',
        variant: 'destructive',
      });
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
          <CardTitle>Copier Status Controls (CSV Mode)</CardTitle>
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
              Copier Status Controls (CSV Mode)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleScanCSVFiles}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Scan CSV
              </Button>
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmergencyShutdown}
                disabled={updating === 'emergency'}
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Emergency Stop
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleResetAllToOn}
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
                  <h3 className="font-semibold text-blue-900">Global Copier Status (CSV)</h3>
                  <p className="text-sm text-blue-700">
                    Master control for all copying operations via CSV
                  </p>
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
              <h4 className="font-semibold text-gray-900">Master Accounts (from CSV)</h4>
              {Object.entries(accounts.masterAccounts).map(([masterId, master]: [string, any]) => {
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
                          checked={masterStatus?.masterStatus === true}
                          onCheckedChange={enabled => toggleMasterStatus(masterId, enabled)}
                          disabled={
                            isUpdating ||
                            !copierStatus?.globalStatus || // Global copier off
                            masterStatus?.status === 'offline' // Master offline
                          }
                          aria-disabled={!copierStatus?.globalStatus} // For better accessibility
                          title={
                            masterStatus?.status === 'offline'
                              ? 'Account is offline - copy trading disabled'
                              : !copierStatus?.globalStatus
                                ? 'Global copier is OFF'
                                : masterStatus?.effectiveStatus
                                  ? 'Stop sending signals to slaves'
                                  : 'Start sending signals to slaves'
                          }
                        />
                      </div>
                    </div>

                    {/* Connected Slaves */}
                    {master.connectedSlaves && master.connectedSlaves.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium mb-2 text-gray-600">Connected slaves:</p>
                        <div className="space-y-2">
                          {master.connectedSlaves.map((slave: any) => {
                            const slaveConfig = slaveConfigs[slave.id];
                            const slaveEnabled = slaveConfig?.config?.enabled === true;
                            const isSlaveUpdating = updating === `slave-${slave.id}`;
                            const effectiveSlaveStatus =
                              copierStatus?.globalStatus &&
                              masterStatus?.masterStatus === true &&
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
                                      !copierStatus?.globalStatus || // Global copier off
                                      masterStatus?.masterStatus !== true || // Master disabled
                                      !slave.masterOnline || // Master offline
                                      slave.status === 'offline' // Slave offline
                                    }
                                    aria-disabled={!copierStatus?.globalStatus} // For better accessibility
                                    title={
                                      slave.status === 'offline'
                                        ? 'Account is offline - copy trading disabled'
                                        : !slave.masterOnline
                                          ? 'Master account is offline - copy trading disabled'
                                          : !copierStatus?.globalStatus
                                            ? 'Global copier is OFF'
                                            : masterStatus?.masterStatus !== true
                                              ? 'Master is not sending signals'
                                              : effectiveSlaveStatus
                                                ? 'Stop following master signals'
                                                : 'Start following master signals'
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
              <h4 className="font-semibold text-gray-900">Unconnected Slave Accounts (from CSV)</h4>
              <div className="space-y-2">
                {accounts.unconnectedSlaves.map((slave: any) => {
                  const slaveConfig = slaveConfigs[slave.id];
                  const slaveEnabled = slaveConfig?.config?.enabled === true;
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
                          disabled={
                            isSlaveUpdating ||
                            !copierStatus?.globalStatus || // Global copier off
                            slave.status === 'offline' // Slave offline
                          }
                          aria-disabled={!copierStatus?.globalStatus} // For better accessibility
                          title={
                            slave.status === 'offline'
                              ? 'Account is offline - copy trading disabled'
                              : !copierStatus?.globalStatus
                                ? 'Global copier is OFF'
                                : slaveEnabled
                                  ? 'Disable copy trading'
                                  : 'Enable copy trading (no master connected)'
                          }
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
