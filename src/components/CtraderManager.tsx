import React, { useEffect, useState } from 'react';

import { CheckCircle, ExternalLink, Link, Settings, Users, Wifi, WifiOff } from 'lucide-react';

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
}

interface RegisterAccountForm {
  accountId: string;
  name: string;
  description: string;
  masterAccountId?: string;
}

export const CtraderManager: React.FC = () => {
  const [status, setStatus] = useState<CtraderStatus>({
    authenticated: false,
    connected: false,
    accounts: [],
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
  const [masterAccounts, setMasterAccounts] = useState<any[]>([]);

  const serverPort = import.meta.env.VITE_SERVER_PORT;
  const baseUrl = `http://localhost:${serverPort}/api`;
  const userId = 'user1'; // TODO: Get from actual auth context

  useEffect(() => {
    loadStatus();
    loadMasterAccounts();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/ctrader/auth/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus({
          authenticated: data.authenticated,
          connected: data.connection.connected,
          accounts: data.accounts,
          lastHeartbeat: data.connection.lastHeartbeat,
        });
      }
    } catch (error) {
      console.error('Error loading cTrader status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterAccounts = async () => {
    try {
      const response = await fetch(`${baseUrl}/accounts/all`);
      if (response.ok) {
        const data = await response.json();
        const masters = Object.values(data.masterAccounts || {});
        setMasterAccounts(masters);
      }
    } catch (error) {
      console.error('Error loading master accounts:', error);
    }
  };

  const initiateAuth = async () => {
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
        window.open(data.authUrl, 'ctrader-auth', 'width=600,height=700');

        // Listen for auth completion
        const checkAuth = setInterval(async () => {
          await loadStatus();
          if (status.authenticated) {
            clearInterval(checkAuth);
            toast({
              title: 'Éxito',
              description: 'Autenticación con cTrader completada',
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
        description: 'Error al iniciar autenticación con cTrader',
        variant: 'destructive',
      });
    }
  };

  const connectToApi = async () => {
    try {
      setConnecting(true);
      const response = await fetch(`${baseUrl}/ctrader/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast({
          title: 'Conectado',
          description: 'Conexión establecida con cTrader API',
        });
        await loadStatus();
      } else {
        throw new Error('Failed to connect');
      }
    } catch (error) {
      console.error('Error connecting to cTrader API:', error);
      toast({
        title: 'Error',
        description: 'Error al conectar con cTrader API',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      const response = await fetch(`${baseUrl}/ctrader/disconnect/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Desconectado',
          description: 'Desconectado de cTrader API',
        });
        await loadStatus();
      }
    } catch (error) {
      console.error('Error disconnecting from cTrader API:', error);
      toast({
        title: 'Error',
        description: 'Error al desconectar de cTrader API',
        variant: 'destructive',
      });
    }
  };

  const registerMasterAccount = async () => {
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
            title: 'Éxito',
            description: 'Cuenta master de cTrader registrada',
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
        description: 'Error al registrar cuenta master',
        variant: 'destructive',
      });
    }
  };

  const registerSlaveAccount = async () => {
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
            title: 'Éxito',
            description: 'Cuenta slave de cTrader registrada',
          });
          setShowSlaveDialog(false);
          setSlaveForm({ accountId: '', name: '', description: '', masterAccountId: '' });
        }
      }
    } catch (error) {
      console.error('Error registering cTrader slave:', error);
      toast({
        title: 'Error',
        description: 'Error al registrar cuenta slave',
        variant: 'destructive',
      });
    }
  };

  const revokeAuth = async () => {
    if (!confirm('¿Estás seguro de que quieres revocar la autenticación con cTrader?')) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/ctrader/auth/revoke/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Autenticación revocada',
          description: 'Se ha revocado el acceso a cTrader',
        });
        await loadStatus();
      }
    } catch (error) {
      console.error('Error revoking cTrader auth:', error);
      toast({
        title: 'Error',
        description: 'Error al revocar autenticación',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Gestión de cTrader
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Gestión de cTrader
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${status.authenticated ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <div>
              <p className="font-medium">Estado de autenticación</p>
              <p className="text-sm text-muted-foreground">
                {status.authenticated ? 'Autenticado con cTrader' : 'No autenticado'}
              </p>
            </div>
          </div>
          {!status.authenticated ? (
            <Button onClick={initiateAuth} size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Autenticar
            </Button>
          ) : (
            <Button onClick={revokeAuth} variant="outline" size="sm">
              Revocar acceso
            </Button>
          )}
        </div>

        {/* Connection Status */}
        {status.authenticated && (
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {status.connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="font-medium">Conexión API</p>
                <p className="text-sm text-muted-foreground">
                  {status.connected ? 'Conectado a cTrader API' : 'Desconectado'}
                </p>
                {status.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground">
                    Último heartbeat: {new Date(status.lastHeartbeat).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            {!status.connected ? (
              <Button onClick={connectToApi} disabled={connecting} size="sm">
                {connecting ? 'Conectando...' : 'Conectar'}
              </Button>
            ) : (
              <Button onClick={disconnect} variant="outline" size="sm">
                Desconectar
              </Button>
            )}
          </div>
        )}

        {/* Accounts List */}
        {status.accounts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cuentas de cTrader</h3>
              <div className="flex gap-2">
                <Dialog open={showMasterDialog} onOpenChange={setShowMasterDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Users className="h-4 w-4 mr-2" />
                      Registrar Master
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Cuenta Master</DialogTitle>
                      <DialogDescription>
                        Registra una cuenta de cTrader como cuenta master para copy trading
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="masterAccountSelect">Cuenta cTrader *</Label>
                        <Select
                          value={masterForm.accountId}
                          onValueChange={value =>
                            setMasterForm({ ...masterForm, accountId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una cuenta" />
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
                        <Label htmlFor="masterName">Nombre</Label>
                        <Input
                          id="masterName"
                          placeholder="Nombre descriptivo"
                          value={masterForm.name}
                          onChange={e => setMasterForm({ ...masterForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="masterDescription">Descripción</Label>
                        <Textarea
                          id="masterDescription"
                          placeholder="Descripción de la estrategia"
                          value={masterForm.description}
                          onChange={e =>
                            setMasterForm({ ...masterForm, description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowMasterDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={registerMasterAccount} disabled={!masterForm.accountId}>
                        Registrar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showSlaveDialog} onOpenChange={setShowSlaveDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Link className="h-4 w-4 mr-2" />
                      Registrar Slave
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Cuenta Slave</DialogTitle>
                      <DialogDescription>
                        Registra una cuenta de cTrader como cuenta slave (seguidora)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="slaveAccountSelect">Cuenta cTrader *</Label>
                        <Select
                          value={slaveForm.accountId}
                          onValueChange={value => setSlaveForm({ ...slaveForm, accountId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una cuenta" />
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
                        <Label htmlFor="slaveMasterSelect">Cuenta Master *</Label>
                        <Select
                          value={slaveForm.masterAccountId}
                          onValueChange={value =>
                            setSlaveForm({ ...slaveForm, masterAccountId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona cuenta master" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterAccounts.map((master: any) => (
                              <SelectItem key={master.id} value={master.id}>
                                {master.name} ({master.platform})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="slaveName">Nombre</Label>
                        <Input
                          id="slaveName"
                          placeholder="Nombre descriptivo"
                          value={slaveForm.name}
                          onChange={e => setSlaveForm({ ...slaveForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="slaveDescription">Descripción</Label>
                        <Textarea
                          id="slaveDescription"
                          placeholder="Descripción de la cuenta"
                          value={slaveForm.description}
                          onChange={e =>
                            setSlaveForm({ ...slaveForm, description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSlaveDialog(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={registerSlaveAccount}
                        disabled={!slaveForm.accountId || !slaveForm.masterAccountId}
                      >
                        Registrar
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
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">{account.brokerName}</p>
                      <p className="text-sm text-muted-foreground">
                        Cuenta: {account.accountNumber} • {account.tradingMode}
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
            <p className="text-muted-foreground">No se encontraron cuentas de cTrader</p>
            <Button onClick={loadStatus} variant="outline" size="sm" className="mt-2">
              Actualizar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
