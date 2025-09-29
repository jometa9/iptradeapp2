import React, { useEffect, useState } from 'react';

import { AlertCircle, Clipboard, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useExternalLink } from '../hooks/useExternalLink';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

export const LoginScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [webLoginStatus, setWebLoginStatus] = useState<'idle' | 'authenticating' | 'redirecting'>(
    'idle'
  );
  const { login, loginWithToken, isLoading, error, clearError } = useAuth();
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

  // Handle web login
  const handleWebLogin = async () => {
    clearError();
    setWebLoginStatus('authenticating');

    // Open browser to your website login page
    const loginUrl = 'https://iptradecopier.com/sign-in?redirect=iptradeapp://login&source=app';
    openExternalLink(loginUrl);

    // Show "Authenticating in browser..." message
    setTimeout(() => {
      if (webLoginStatus === 'authenticating') {
        setWebLoginStatus('redirecting');
      }
    }, 3000);
  };

  // Handle URL scheme callback (iptradeapp://login?token=XXX)
  useEffect(() => {
    const handleAuthCallback = (event: any) => {
      const url = event.detail?.url || event.url;

      if (url && url.startsWith('iptradeapp://login')) {
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('token');

        if (token) {
          setWebLoginStatus('idle');
          loginWithToken(token);
        } else {
          setWebLoginStatus('idle');
          clearError();
        }
      }
    };

    // Listen for deep link events (Electron)
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('deep-link', handleAuthCallback);
    }

    // Listen for custom events (fallback)
    window.addEventListener('auth-callback', handleAuthCallback);

    return () => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('deep-link');
      }
      window.removeEventListener('auth-callback', handleAuthCallback);
    };
  }, [loginWithToken, clearError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4 flex flex-col items-center">
          <img src="./iconShadow025.png" alt="IPTRADE" className="w-16 h-16 text-blue-600" />
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Welcome to IPTRADE</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 max-w-sm mx-auto">
          <CardDescription className="text-gray-600 text-sm text-center">
            We'll take you to your web browser <br /> to sign in and then you can come back here.
          </CardDescription>
          <Button
            onClick={handleWebLogin}
            type="button"
            variant="ghost"
            className="w-full bg-black hover:bg-black-700 text-white border border-gray-200"
            disabled={isLoading || webLoginStatus !== 'idle'}
          >
            {webLoginStatus === 'authenticating' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating in browser...
              </>
            ) : webLoginStatus === 'redirecting' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting back to application...
              </>
            ) : isLoading && webLoginStatus !== 'idle' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating token...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Sing in to IPTRADE
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative mx-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-4 bg-gray-50 text-gray-600">Or</span>
            </div>
          </div>

          {/* Web Login Button */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <CardDescription className="text-gray-600 text-center mb-4">
                Enter your license key to log in
              </CardDescription>
              <div className="relative">
                <Input
                  id="apikey"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Insert your license here"
                  value={apiKey}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="transition-colors border-gray-200 focus:border-gray-500 focus:ring-gray-500 bg-white pr-20 text-gray-400 font-mono"
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
              className="w-full bg-black hover:bg-black-700 text-white border border-gray-200"
              disabled={isLoading || !apiKey.trim()}
            >
              {isLoading && webLoginStatus === 'idle' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating license...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </form>

          <div className="relative mx-1 my-4 mt-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
          </div>

          <CardDescription className="text-gray-400 text-sm text-center pt-4 underline">
            Don't have a account?
          </CardDescription>
        </CardContent>
      </div>
    </div>
  );
};
