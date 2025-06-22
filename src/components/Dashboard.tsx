import React, { useEffect, useState } from 'react';

import { Calendar, CheckCircle, CreditCard, HelpCircle, LogOut, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { UpdateTestProvider } from '../context/UpdateTestContext';
import { UpdateCard } from './UpdateCard';
import { VersionInfo } from './VersionInfo';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export const Dashboard: React.FC = () => {
  const { logout, userInfo } = useAuth();
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
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

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* User Info Card */}
            {userInfo && (
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    User Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
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
                        <label className="text-sm font-medium text-gray-500">Type</label>
                        <p className="text-gray-700 capitalize">{userInfo.subscriptionType}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Expiry</label>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <p className="text-gray-700">{formatDate(userInfo.expiryDate)}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Days Remaining</label>
                        <p
                          className={`text-lg font-semibold ${getDaysRemainingColor(userInfo.daysRemaining)}`}
                        >
                          {userInfo.daysRemaining} days
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
                <CardTitle className="text-xl text-gray-900">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 font-medium">Server Status:</span>
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
                    <span className="text-gray-700 font-medium">Subscription:</span>
                    {userInfo && getSubscriptionStatusBadge(userInfo.subscriptionStatus)}
                  </div>

                  {userInfo && userInfo.daysRemaining <= 7 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-yellow-600" />
                        <span className="font-medium text-yellow-800">
                          Your subscription expires in {userInfo.daysRemaining} days
                        </span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        Renew your subscription to continue using the application.
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
