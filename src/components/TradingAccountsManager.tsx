import React, { useEffect, useState } from 'react';

import { Plus, Trash2, Users } from 'lucide-react';

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
  { value: 'Other', label: 'Otra plataforma' },
];

export const TradingAccountsManager: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMasterDialog, setShowMasterDialog] = useState(false);
  const [showSlaveDialog, setShowSlaveDialog] = useState(false);
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
      const response = await fetch(`${baseUrl}/accounts/all`);
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
        description: 'No se pudieron cargar las cuentas de trading',
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
          title: 'Éxito',
          description: 'Cuenta master registrada correctamente',
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
        description: error instanceof Error ? error.message : 'Error al registrar cuenta master',
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
          title: 'Éxito',
          description: 'Cuenta slave registrada correctamente',
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
        description: error instanceof Error ? error.message : 'Error al registrar cuenta slave',
        variant: 'destructive',
      });
    }
  };

  const deleteMasterAccount = async (masterAccountId: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la cuenta master ${masterAccountId}?`)) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/accounts/master/${masterAccountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Cuenta master eliminada correctamente',
        });
        loadAccounts();
      } else {
        throw new Error('Failed to delete master account');
      }
    } catch (error) {
      console.error('Error deleting master account:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar cuenta master',
        variant: 'destructive',
      });
    }
  };

  const deleteSlaveAccount = async (slaveAccountId: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la cuenta slave ${slaveAccountId}?`)) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/accounts/slave/${slaveAccountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Cuenta slave eliminada correctamente',
        });
        loadAccounts();
      } else {
        throw new Error('Failed to delete slave account');
      }
    } catch (error) {
      console.error('Error deleting slave account:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar cuenta slave',
        variant: 'destructive',
      });
    }
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
          <CardTitle>Gestión de Cuentas de Trading</CardTitle>
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
            Gestión de Cuentas de Trading
            <div className="flex gap-2">
              <Dialog open={showMasterDialog} onOpenChange={setShowMasterDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Cuenta Master
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Cuenta Master</DialogTitle>
                    <DialogDescription>
                      Las cuentas master envían señales de trading a las cuentas slave conectadas.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="masterAccountId">ID de Cuenta *</Label>
                      <Input
                        id="masterAccountId"
                        placeholder="Ej: 12345678"
                        value={masterForm.masterAccountId}
                        onChange={e =>
                          setMasterForm({ ...masterForm, masterAccountId: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterName">Nombre</Label>
                      <Input
                        id="masterName"
                        placeholder="Ej: Cuenta Principal EURUSD"
                        value={masterForm.name}
                        onChange={e => setMasterForm({ ...masterForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterPlatform">Plataforma *</Label>
                      <Select
                        value={masterForm.platform}
                        onValueChange={value => setMasterForm({ ...masterForm, platform: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una plataforma" />
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
                        placeholder="Ej: IC Markets"
                        value={masterForm.broker}
                        onChange={e => setMasterForm({ ...masterForm, broker: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterDescription">Descripción</Label>
                      <Textarea
                        id="masterDescription"
                        placeholder="Descripción opcional de la cuenta"
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
                    <Button
                      onClick={registerMasterAccount}
                      disabled={!masterForm.masterAccountId || !masterForm.platform}
                    >
                      Registrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showSlaveDialog} onOpenChange={setShowSlaveDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Cuenta Slave
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Cuenta Slave</DialogTitle>
                    <DialogDescription>
                      Las cuentas slave reciben y ejecutan las señales de una cuenta master
                      específica.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="slaveAccountId">ID de Cuenta *</Label>
                      <Input
                        id="slaveAccountId"
                        placeholder="Ej: 87654321"
                        value={slaveForm.slaveAccountId}
                        onChange={e =>
                          setSlaveForm({ ...slaveForm, slaveAccountId: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="slaveName">Nombre</Label>
                      <Input
                        id="slaveName"
                        placeholder="Ej: Cuenta Seguidor 1"
                        value={slaveForm.name}
                        onChange={e => setSlaveForm({ ...slaveForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="slavePlatform">Plataforma *</Label>
                      <Select
                        value={slaveForm.platform}
                        onValueChange={value => setSlaveForm({ ...slaveForm, platform: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una plataforma" />
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
                        placeholder="Ej: IC Markets"
                        value={slaveForm.broker}
                        onChange={e => setSlaveForm({ ...slaveForm, broker: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="masterConnection">Conectar a Master (opcional)</Label>
                      <Select
                        value={slaveForm.masterAccountId}
                        onValueChange={value =>
                          setSlaveForm({ ...slaveForm, masterAccountId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un master" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin conectar</SelectItem>
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
                      <Label htmlFor="slaveDescription">Descripción</Label>
                      <Textarea
                        id="slaveDescription"
                        placeholder="Descripción opcional de la cuenta"
                        value={slaveForm.description}
                        onChange={e => setSlaveForm({ ...slaveForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSlaveDialog(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={registerSlaveAccount}
                      disabled={!slaveForm.slaveAccountId || !slaveForm.platform}
                    >
                      Registrar
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
              <div className="text-sm text-blue-700">Cuentas Master</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {accounts?.totalSlaveAccounts || 0}
              </div>
              <div className="text-sm text-green-700">Cuentas Slave</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {accounts?.totalConnections || 0}
              </div>
              <div className="text-sm text-purple-700">Conexiones Activas</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {accounts?.unconnectedSlaves.length || 0}
              </div>
              <div className="text-sm text-gray-700">Slaves Sin Conectar</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Master Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Cuentas Master</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts && Object.keys(accounts.masterAccounts).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(accounts.masterAccounts).map(([id, master]) => (
                <div key={id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{master.name || id}</h3>
                      <Badge className={getPlatformBadgeColor(master.platform)}>
                        {master.platform || 'N/A'}
                      </Badge>
                      <Badge variant="outline">{master.totalSlaves} slaves</Badge>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => deleteMasterAccount(id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
                        <strong>Descripción:</strong> {master.description}
                      </p>
                    )}
                    <p>
                      <strong>Registrado:</strong>{' '}
                      {new Date(master.registeredAt).toLocaleDateString()}
                    </p>
                  </div>
                  {master.connectedSlaves.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Slaves conectados:</p>
                      <div className="flex flex-wrap gap-2">
                        {master.connectedSlaves.map(slave => (
                          <div key={slave.id} className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {slave.name || slave.id}
                            </Badge>
                            <Badge className={`text-xs ${getPlatformBadgeColor(slave.platform)}`}>
                              {slave.platform}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No hay cuentas master registradas</div>
          )}
        </CardContent>
      </Card>

      {/* Unconnected Slaves */}
      {accounts && accounts.unconnectedSlaves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas Slave Sin Conectar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accounts.unconnectedSlaves.map(slave => (
                <div key={slave.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{slave.name || slave.id}</h3>
                      <Badge className={getPlatformBadgeColor(slave.platform)}>
                        {slave.platform || 'N/A'}
                      </Badge>
                      <Badge variant="destructive">Sin conectar</Badge>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteSlaveAccount(slave.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
                        <strong>Descripción:</strong> {slave.description}
                      </p>
                    )}
                    <p>
                      <strong>Registrado:</strong>{' '}
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
