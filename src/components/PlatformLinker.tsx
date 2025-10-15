import React, { useState } from 'react';

import { Download, Link, Monitor, Play, Settings } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from './ui/use-toast';

interface Platform {
  id: string;
  name: string;
  description: string;
  status: 'not-installed' | 'installed' | 'running' | 'error';
  accounts: number;
}

const SUPPORTED_PLATFORMS: Platform[] = [
  {
    id: 'mt4',
    name: 'MetaTrader 4',
    description: 'Install bot for MT4 accounts',
    status: 'not-installed',
    accounts: 0,
  },
  {
    id: 'mt5',
    name: 'MetaTrader 5',
    description: 'Install bot for MT5 accounts',
    status: 'not-installed',
    accounts: 0,
  },
  {
    id: 'ctrader',
    name: 'cTrader',
    description: 'Install bot for cTrader accounts',
    status: 'not-installed',
    accounts: 0,
  },
  {
    id: 'tradingview',
    name: 'TradingView',
    description: 'Install bot for TradingView accounts',
    status: 'not-installed',
    accounts: 0,
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    description: 'Install bot for NinjaTrader accounts (Windows only)',
    status: 'not-installed',
    accounts: 0,
  },
];

export const PlatformLinker: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>(SUPPORTED_PLATFORMS);
  const [installing, setInstalling] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const { secretKey } = useAuth();

  const serverPort = import.meta.env.VITE_SERVER_PORT || '3000';
  const baseUrl = `http://localhost:${serverPort}/api`;

  // Instalar bot en una plataforma
  const installBot = async (platformId: string) => {
    try {
      setInstalling(platformId);

      const response = await fetch(`${baseUrl}/csv/install-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify({ platform: platformId }),
      });

      if (response.ok) {
        const result = await response.json();

        // Actualizar estado de la plataforma
        setPlatforms(prev =>
          prev.map(platform =>
            platform.id === platformId ? { ...platform, status: 'installed' as const } : platform
          )
        );

        toast({
          title: 'Bot Installed',
          description: result.message,
        });
      } else {
        throw new Error('Failed to install bot');
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setInstalling(null);
    }
  };

  // Ejecutar script de instalación
  const runInstallScript = async (platformId: string) => {
    try {
      setInstalling(platformId);

      const response = await fetch(`${baseUrl}/csv/run-install-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify({ platform: platformId }),
      });

      if (response.ok) {
        const result = await response.json();

        toast({
          title: 'Install Script Executed',
          description: result.message,
        });
      } else {
        throw new Error('Failed to run install script');
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setInstalling(null);
    }
  };

  // Escanear cuentas en plataformas
  const scanPlatformAccounts = async () => {
    try {
      setScanning(true);

      const response = await fetch(`${baseUrl}/csv/scan-platform-accounts`, {
        method: 'POST',
        headers: {
          'x-api-key': secretKey || '',
        },
      });

      if (response.ok) {
        const result = await response.json();

        // Actualizar plataformas con información de cuentas
        setPlatforms(prev =>
          prev.map(platform => ({
            ...platform,
            accounts: result.accounts[platform.id] || 0,
            status: result.accounts[platform.id] > 0 ? ('running' as const) : platform.status,
          }))
        );

        toast({
          title: 'Platform Scan Complete',
          description: `Found ${Object.values(result.accounts).length} total accounts`,
        });
      } else {
        throw new Error('Failed to scan platform accounts');
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setScanning(false);
    }
  };

  // Obtener badge de estado
  const getStatusBadge = (status: Platform['status']) => {
    switch (status) {
      case 'not-installed':
        return <Badge variant="secondary">Not Installed</Badge>;
      case 'installed':
        return <Badge className="bg-blue-100 text-blue-800">Installed</Badge>;
      case 'running':
        return <Badge className="bg-green-100 text-green-800">Running</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Obtener icono de acción
  const getActionIcon = (status: Platform['status']) => {
    switch (status) {
      case 'not-installed':
        return <Download className="w-4 h-4" />;
      case 'installed':
        return <Play className="w-4 h-4" />;
      case 'running':
        return <Settings className="w-4 h-4" />;
      case 'error':
        return <Download className="w-4 h-4" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  // Obtener texto de acción
  const getActionText = (status: Platform['status']) => {
    switch (status) {
      case 'not-installed':
        return 'Install Bot';
      case 'installed':
        return 'Start Bot';
      case 'running':
        return 'Configure';
      case 'error':
        return 'Reinstall';
      default:
        return 'Install';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="w-5 h-5" />
              Platform Linker
            </div>
            <Button variant="outline" onClick={scanPlatformAccounts} disabled={scanning}>
              <Monitor className="w-4 h-4 mr-2" />
              {scanning ? 'Scanning...' : 'Scan Platforms'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Install and link trading bots to your platforms. Each bot will create an
              IPTRADECSV2.csv file to communicate with the main application.
            </p>
          </div>

          <div className="space-y-4">
            {platforms.map(platform => (
              <div key={platform.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <h3 className="font-medium">{platform.name}</h3>
                      <p className="text-sm text-gray-600">{platform.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {getStatusBadge(platform.status)}
                        {platform.accounts > 0 && (
                          <Badge variant="outline">
                            {platform.accounts} account{platform.accounts !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runInstallScript(platform.id)}
                      disabled={installing === platform.id}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Run Script
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => installBot(platform.id)}
                      disabled={installing === platform.id}
                    >
                      {getActionIcon(platform.status)}
                      <span className="ml-2">{getActionText(platform.status)}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Click "Run Script" to execute the installation script for each platform</li>
              <li>2. Click "Install Bot" to install the trading bot on the platform</li>
              <li>3. The bot will create an IPTRADECSV2.csv file in the platform directory</li>
              <li>4. Use "Scan Platforms" to detect installed bots and their accounts</li>
              <li>5. The main application will monitor these CSV files for real-time updates</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
