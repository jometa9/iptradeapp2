import React, { useEffect, useState } from 'react';

import { Eye, EyeOff, HelpCircle, Link, LogOut, MessageCircle, RefreshCw, Zap } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { UpdateTestProvider } from '../context/UpdateTestContext';
import { useAutoLinkPlatforms } from '../hooks/useAutoLinkPlatforms';
import { useExternalLink } from '../hooks/useExternalLink';
import { useLinkPlatforms } from '../hooks/useLinkPlatforms';
import { PendingAccountsManager } from './PendingAccountsManager';
import { TradingAccountsConfig } from './TradingAccountsConfig';
import { UpdateCard } from './UpdateCard';
import { VersionInfo } from './VersionInfo';
import { Button } from './ui/button';

export const Dashboard: React.FC = () => {
  const { logout, userInfo, secretKey } = useAuth();
  const { openExternalLink } = useExternalLink();
  const { linkPlatforms, isLinking } = useLinkPlatforms();
  
  // Hook para ejecutar Link Platforms automáticamente cuando cambien las cuentas
  useAutoLinkPlatforms();
  
  console.log('🎯 Dashboard rendered - Link Platforms button should be visible');
  console.log('🔗 isLinking state:', isLinking);
  
  const [userIP, setUserIP] = useState<string>('Loading...');
  const [showIP, setShowIP] = useState<boolean>(true);
  const [isConnectingPlatforms, setIsConnectingPlatforms] = useState<boolean>(false);
  // Estado para controlar si se acaba de iniciar sesión
  // isRecentLogin not used
  // Estado para saber si ya se disparó el temporizador
  const [loginTimerStarted, setLoginTimerStarted] = useState<boolean>(false);

  const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:30';

  // Fetch user IP on component mount
  const fetchUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setUserIP(data.ip);
    } catch {
      setUserIP('Unknown');
    }
  };

  // Efecto para realizar acciones al montar el componente
  useEffect(() => {
    fetchUserIP();

    // Link Platforms se ejecuta automáticamente con useAutoLinkPlatforms
    // No es necesario ejecutarlo manualmente aquí

    // Log de información de plan para depuración
    // Recent login state removed

    // Timer cleanup removed
  }, [userInfo]);

  // Efecto para controlar la visibilidad de la tarjeta solo una vez por sesión
  useEffect(() => {
    if (!userInfo) return;

    // Solo iniciar el temporizador si no se ha iniciado antes
    if (!loginTimerStarted) {
      setLoginTimerStarted(true);
    }
  }, [userInfo, loginTimerStarted]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails, we still want to redirect the user
    }
  };

  const handleHelp = () => {
    const urlHelp = import.meta.env.VITE_HELP_URL;
    openExternalLink(urlHelp);
  };

  const handleCopyIP = async () => {
    try {
      await navigator.clipboard.writeText(userIP || 'Unknown');
    } catch {
      // Silent fail - no notification to user
      console.log('Failed to copy IP to clipboard');
    }
  };

  const handleCommunity = () => {
    const urlCommunity = 'https://t.me/iptradecopier';
    openExternalLink(urlCommunity);
  };

  const handleLinkPlatforms = async () => {
    console.log('🔗 Link Platforms button clicked!');
    console.log('📊 Current isLinking state:', isLinking);
    try {
      console.log('🔄 Starting Link Platforms process...');
      const result = await linkPlatforms();
      console.log('✅ Link Platforms completed successfully:', result);
      console.log('📊 Final isLinking state:', isLinking);
    } catch (error) {
      console.error('❌ Link Platforms failed:', error);
      console.log('📊 Error isLinking state:', isLinking);
    }
  };

  const handleConnectPlatforms = async () => {
    if (!secretKey) {
      console.error('❌ Authentication required');
      return;
    }

    setIsConnectingPlatforms(true);

    try {
      console.log('🔍 Starting platform connection...');

      const response = await fetch(`${baseUrl}/api/csv/scan-pending`, {
        method: 'GET',
        headers: {
          'x-api-key': secretKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Platform connection result:', data);

        const platformsList = data.platforms.length > 0 ? data.platforms.join(', ') : 'None';
        const summary = data.summary;

        console.log(
          `🚀 Pending Accounts Scan Complete: Found ${summary.totalAccounts} accounts (${summary.onlineAccounts} online, ${summary.offlineAccounts} offline). Platforms: ${platformsList}`
        );

        if (summary.totalAccounts > 0) {
          console.log(`✅ ${summary.totalAccounts} pending accounts detected from CSV files`);
          console.log('📊 Platform breakdown:', summary.platformStats);
        } else {
          console.log('📭 No pending accounts found in CSV files');
        }
      } else {
        const error = await response.json();
        console.error('❌ Platform connection failed:', error);
      }
    } catch (error) {
      console.error('❌ Platform connection error:', error);
    } finally {
      setIsConnectingPlatforms(false);
    }
  };

  return (
    <UpdateTestProvider>
      <div className="min-h-screen bg-gray-100">
        <header>
          <div className="mx-auto px-4">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <h1 className=" text-xl font-semibold text-gray-900 ">IPTRADE</h1>
                </div>
              </div>

              {/* User IP in the center */}
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>IP</span>
                <span className="select-none" onClick={handleCopyIP} title="Click to copy IP">
                  {showIP ? userIP || 'Unknown' : '••••••••'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowIP(!showIP)}
                  className="text-gray-400 p-1 h-auto"
                  title={showIP ? 'Hide IP' : 'Show IP'}
                >
                  {showIP ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>

              <div className="flex items-center">
                <div className="hidden sm:flex items-center">
                  <div className="flex items-center text-sm text-gray-600 px-3">
                    {userInfo?.name || 'User'}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  title="Link Platforms (Sync MQL4/MQL5 bots)"
                  onClick={handleLinkPlatforms}
                  disabled={isLinking}
                >
                  {isLinking ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  title="Connect Trading Accounts"
                  onClick={handleConnectPlatforms}
                  disabled={isConnectingPlatforms}
                >
                  {isConnectingPlatforms ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  title="Help"
                  onClick={handleHelp}
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  title="Community"
                  onClick={handleCommunity}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-900 mr-0 pr-0"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto px-4 gap-4 flex flex-col">
          {/* Update notification appears here when available */}
          <UpdateCard />

          {/* Pending Accounts - Always visible at top for admin management */}
          <PendingAccountsManager />

          {/* Main Trading Configuration */}
          <TradingAccountsConfig />

          {/* footer */}
          <div className="flex justify-center items-center pb-4">
            <VersionInfo />
          </div>
        </main>

        {/* Update tester for development (fixed position) */}

        {/*<UpdateTester />*/}
      </div>
    </UpdateTestProvider>
  );
};
