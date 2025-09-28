import React, { useEffect, useState } from 'react';

import {
  Bot,
  Eye,
  EyeOff,
  HardDriveDownload,
  HelpCircle,
  Inbox,
  Link,
  LogOut,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useUnifiedAccountDataContext } from '../context/UnifiedAccountDataContext';
import { UpdateTestProvider } from '../context/UpdateTestContext';
import { useAutoLinkPlatforms } from '../hooks/useAutoLinkPlatforms';
import { useExternalLink } from '../hooks/useExternalLink';
// Removed useHiddenPendingAccounts - functionality moved to useUnifiedAccountData
import { useLinkPlatforms } from '../hooks/useLinkPlatforms';
import { PendingAccountsManager } from './PendingAccountsManager';
import { TradingAccountsConfig } from './TradingAccountsConfig';
import { UpdateCard } from './UpdateCard';
import { VersionInfo } from './VersionInfo';
import { Button } from './ui/button';

export const Dashboard: React.FC = () => {
  const { logout, userInfo, secretKey } = useAuth();
  const { openExternalLink } = useExternalLink();
  // Get refresh function from UnifiedAccountDataContext
  const { isHidden, isBlinking, toggleHidden, refresh: refreshUnifiedData } = useUnifiedAccountDataContext();
  
  
  const { linkPlatforms, findBots, isLinking, linkingSource, progress } = useLinkPlatforms(refreshUnifiedData);

  // Visibility state is now handled above with refresh function

  // Hook para ejecutar Link Platforms automáticamente cuando cambien las cuentas
  useAutoLinkPlatforms();

  const [userIP, setUserIP] = useState<string>('Loading...');
  // Inicializar showIP desde localStorage
  const [showIP, setShowIP] = useState<boolean>(() => {
    const saved = localStorage.getItem('showIP');
    return saved ? JSON.parse(saved) : true;
  });
  const [loginTimerStarted, setLoginTimerStarted] = useState<boolean>(false);

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

    // Log de información de plan para depuración
    // Recent login state removed

    // Timer cleanup removed
  }, [userInfo]);

  // Guardar showIP en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('showIP', JSON.stringify(showIP));
  }, [showIP]);

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
    } catch {
      // Silent error handling
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
    }
  };

  const handleLinkPlatforms = async () => {
    try {
      await linkPlatforms('link');
      // Silent processing
    } catch {
      // Silent error handling
    }
  };

  const handleFindBots = async () => {
    try {
      await findBots();
      // Silent processing
    } catch {
      // Silent error handling
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
                  title="Install bots"
                  onClick={handleLinkPlatforms}
                  disabled={isLinking}
                >
                  {isLinking && linkingSource === 'link' ? (
                    <div className="flex items-center space-x-1">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <HardDriveDownload className="w-4 h-4" />
                    </div>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  title="Link Bots"
                  onClick={handleFindBots}
                  disabled={isLinking}
                >
                  {isLinking && linkingSource === 'bot' ? (
                    <div className="flex items-center space-x-1">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`font-bold text-md transition-all duration-50 ease-in-out ${
                    isHidden ? (isBlinking ? 'text-orange-400' : 'text-gray-400') : 'text-gray-600'
                  }`}
                  title={isHidden ? 'Show Pending Accounts Inbox' : 'Hide Pending Accounts Inbox'}
                  onClick={toggleHidden}
                >
                  <Inbox className="w-4 h-4" />
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

          {/* Pending Accounts - Hidden when isHidden is true */}
          {!isHidden && (
            <PendingAccountsManager
              isLinking={isLinking}
              linkPlatforms={async (source: 'link' | 'bot') => {
                if (source === 'bot') {
                  await findBots();
                } else {
                  await linkPlatforms('link');
                }
              }}
              linkingSource={linkingSource}
              progress={progress}
            />
          )}

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
