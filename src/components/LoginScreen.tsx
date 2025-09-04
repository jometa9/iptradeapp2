import React, { useState } from 'react';

import { AlertCircle, Loader2, Eye, EyeOff, Clipboard } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useExternalLink } from '../hooks/useExternalLink';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

export const LoginScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuth();
  const { openExternalLink } = useExternalLink();

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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text);
      if (error) {
        clearError();
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4 flex flex-col items-center">
          <img src="/iconShadow025.png" alt="IPTRADE" className="w-16 h-16 text-blue-600" />
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Welcome to IPTRADE</CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Enter your license key to log in
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 max-w-sm mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="apikey"
                  type={showPassword ? "text" : "password"}
                  placeholder="Insert your license here"
                  value={apiKey}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="transition-colors border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white pr-20"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    className="h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    {showPassword ? (
                      <EyeOff className="h-3 w-3 text-gray-500" />
                    ) : (
                      <Eye className="h-3 w-3 text-gray-500" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePaste}
                    disabled={isLoading}
                    className="h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    <Clipboard className="h-3 w-3 text-gray-500" />
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <Alert className="border-red-400 bg-red-50 flex items-center [&>svg]:relative [&>svg]:left-0 [&>svg]:top-0 [&>svg+div]:translate-y-0">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-200"
              disabled={isLoading || !apiKey.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating license...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </form>
          <CardDescription className="text-gray-400 text-sm text-center hover:text-gray-600 transition-colors duration-100">
            <a
              href="https://iptradecopier.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => {
                e.preventDefault();
                openExternalLink('https://iptradecopier.com/dashboard');
              }}
            >
              Find my license key
            </a>
          </CardDescription>
        </CardContent>
      </div>
    </div>
  );
};
