import React, { useState } from 'react';

import { AlertCircle, Loader2, Shield } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

export const LoginScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const { login, isLoading, error, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      return;
    }

    clearError();
    await login(apiKey.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    if (error) {
      clearError();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <Card className="border-gray-200">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">IPTrade App</CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                Ingrese su API Key para acceder a la aplicación
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="apikey" className="text-sm font-medium text-gray-700">
                  API Key
                </label>
                <Input
                  id="apikey"
                  type="password"
                  placeholder="Ingrese su API Key"
                  value={apiKey}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="transition-colors focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || !apiKey.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando API Key...
                  </>
                ) : (
                  'Acceder'
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-xs text-gray-500">¿Necesita ayuda? Contacte al soporte técnico</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            © 2024 IPTrade App. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};
