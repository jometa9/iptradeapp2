import React from 'react';

import { CheckCircle, HelpCircle, LogOut } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { UpdateTestProvider } from '../context/UpdateTestContext';
import { PendingAccountsManager } from './PendingAccountsManager';
import { TradingAccountsConfig } from './TradingAccountsConfig';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export const Dashboard: React.FC = () => {
  const { logout, userInfo } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'trialing':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Trial
          </Badge>
        );
      case 'admin_assigned':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Admin Assigned
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <UpdateTestProvider>
      <div className="min-h-screen bg-gray-50">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <h1 className=" text-xl font-semibold text-gray-900">IPTRADE APP</h1>
                </div>
                {userInfo && getSubscriptionStatusBadge(userInfo.subscriptionStatus)}
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

        <main className="max-w-7xl mx-auto px-8 gap-8 flex flex-col">
          {/* Pending Accounts - Always visible at top for admin management */}
          <div className="mt-6">
            <PendingAccountsManager />
          </div>

          {/* Main Trading Configuration */}
          <div>
            <TradingAccountsConfig />
          </div>
        </main>
      </div>
    </UpdateTestProvider>
  );
};
