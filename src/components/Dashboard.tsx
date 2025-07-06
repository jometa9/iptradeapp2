import React, { useEffect, useState } from 'react';

import { CheckCircle, Eye, EyeOff, HelpCircle, LogOut } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { UpdateTestProvider } from '../context/UpdateTestContext';
import { PendingAccountsManager } from './PendingAccountsManager';
import { TradingAccountsConfig } from './TradingAccountsConfig';
import { UpdateCard } from './UpdateCard';
import { VersionInfo } from './VersionInfo';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export const Dashboard: React.FC = () => {
  const { logout, userInfo } = useAuth();
  const [userIP, setUserIP] = useState<string>('Loading...');
  const [showIP, setShowIP] = useState<boolean>(false);

  // Fetch user IP on component mount
  const fetchUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setUserIP(data.ip);
      console.log('🌐 User IP detected:', data.ip);
    } catch (error) {
      console.log('⚠️ Could not get user IP, using default');
      setUserIP('Unknown');
    }
  };

  useEffect(() => {
    fetchUserIP();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleHelp = () => {
    const urlHelp = import.meta.env.VITE_HELP_URL;
    window.open(urlHelp, '_blank');
  };

  const handleCopyIP = async () => {
    try {
      await navigator.clipboard.writeText(userIP || 'Unknown');
    } catch (error) {
      // Silent fail - no notification to user
      console.log('Failed to copy IP to clipboard');
    }
  };

  const getSubscriptionStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border border-green-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'trialing':
        return (
          <Badge className="bg-blue-100 text-blue-800 border border-blue-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            Trial
          </Badge>
        );
      case 'admin_assigned':
        return (
          <Badge className="bg-purple-100 text-purple-800 border border-purple-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            Admin Assigned
          </Badge>
        );
      case null:
        return <Badge className="bg-gray-100 text-gray-700 border border-gray-300">Free</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <UpdateTestProvider>
      <div className="min-h-screen bg-gray-50">
        <header>
          <div className="mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <h1 className=" text-xl font-semibold text-gray-900">IPTRADE APP</h1>
                </div>
                {userInfo && getSubscriptionStatusBadge(userInfo.subscriptionStatus)}
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
                  title="Help"
                  // que este boton lo lleve a la pagina de ayuda
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

        <main className="mx-auto px-4 gap-6 flex flex-col pb-6">
          {/* Update notification appears here when available */}
          <UpdateCard />

          {/* Pending Accounts - Always visible at top for admin management */}
          <PendingAccountsManager />

          {/* Main Trading Configuration */}
          <TradingAccountsConfig />

          {/* footer */}
          <div className="flex justify-center items-center">
            <VersionInfo />
          </div>
        </main>

        {/* Update tester for development (fixed position) */}

        {/*<UpdateTester />*/}
      </div>
    </UpdateTestProvider>
  );
};
