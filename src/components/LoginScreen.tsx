import React, { useState } from 'react';

import { AlertCircle, Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <CardHeader className="text-center space-y-4 flex flex-col items-center">
          <img src="/iconShadow025.png" alt="IPTRADE" className="w-16 h-16 text-blue-600" />
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">IPTRADE APP</CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Insert your API Key to access the application
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 max-w-sm mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                id="apikey"
                type="password"
                placeholder="Insert your API Key"
                value={apiKey}
                onChange={handleInputChange}
                disabled={isLoading}
                className="transition-colors border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white"
              />
            </div>

            {error && (
              <Alert className="border-red-400 bg-red-50 flex items-center [&>svg]:relative [&>svg]:left-0 [&>svg]:top-0 [&>svg+div]:translate-y-0">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white "
              disabled={isLoading || !apiKey.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating API Key...
                </>
              ) : (
                'Access'
              )}
            </Button>
          </form>
          <CardDescription className="text-gray-400 text-sm text-center hover:text-gray-600">
            <a href="https://iptradecopier.com/pricing" target="_blank" rel="noopener noreferrer">
              Manage your subscription here
            </a>
          </CardDescription>
        </CardContent>
      </div>
    </div>
  );
};
