import React, { useEffect, useState } from 'react';

import { Calendar, CheckCircle, CreditCard, LogOut, Shield, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { UpdateTestProvider } from '../context/UpdateTestContext';
import { UpdateCard } from './UpdateCard';
import { VersionInfo } from './VersionInfo';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export const Dashboard: React.FC = () => {
  const { logout, secretKey, userInfo } = useAuth();
  const [serverStatus, setServerStatus] = useState<string>('checking...');

  useEffect(() => {
    const serverPort = import.meta.env.VITE_SERVER_PORT;
    const serverUrl = `http://localhost:${serverPort}/api/status`;

    fetch(serverUrl)
      .then(res => res.json())
      .then(data => setServerStatus(`${data.status} (port ${serverPort})`))
      .catch(err => setServerStatus('error: ' + err.message));
  }, []);

  const handleLogout = () => {
    logout();
  };

  const maskedKey = secretKey
    ? `${'*'.repeat(Math.max(0, secretKey.length - 4))}${secretKey.slice(-4)}`
    : '';

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Activa
          </Badge>
        );
      case 'trialing':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            En Prueba
          </Badge>
        );
      case 'admin_assigned':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Asignada por Admin
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getDaysRemainingColor = (days: number) => {
    if (days > 30) return 'text-green-600';
    if (days > 7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <UpdateTestProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-6 h-6 text-blue-600" />
                  <h1 className="text-xl font-semibold text-gray-900">IPTrade App</h1>
                </div>
                {userInfo && getSubscriptionStatusBadge(userInfo.subscriptionStatus)}
              </div>

              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span>{userInfo?.name || 'Usuario'}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="text-sm text-gray-500">API: {maskedKey}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* User Info Card */}
            {userInfo && (
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Información de Usuario
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Nombre</label>
                        <p className="text-lg font-semibold text-gray-900">{userInfo.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-700">{userInfo.email}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Plan</label>
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <p className="text-lg font-semibold text-gray-900">{userInfo.planName}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tipo</label>
                        <p className="text-gray-700 capitalize">{userInfo.subscriptionType}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Vencimiento</label>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <p className="text-gray-700">{formatDate(userInfo.expiryDate)}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Días Restantes</label>
                        <p
                          className={`text-lg font-semibold ${getDaysRemainingColor(userInfo.daysRemaining)}`}
                        >
                          {userInfo.daysRemaining} días
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <UpdateCard />

            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900">Estado del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 font-medium">Estado del Servidor:</span>
                    <Badge
                      variant={serverStatus.includes('error') ? 'destructive' : 'default'}
                      className={
                        serverStatus.includes('error')
                          ? ''
                          : 'bg-green-100 text-green-800 border-green-200'
                      }
                    >
                      {serverStatus}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 font-medium">Suscripción:</span>
                    {userInfo && getSubscriptionStatusBadge(userInfo.subscriptionStatus)}
                  </div>

                  {userInfo && userInfo.daysRemaining <= 7 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-yellow-600" />
                        <span className="font-medium text-yellow-800">
                          Su suscripción vence en {userInfo.daysRemaining} días
                        </span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        Renueve su suscripción para continuar usando la aplicación.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <VersionInfo />
          </div>
        </main>
      </div>
    </UpdateTestProvider>
  );
};
