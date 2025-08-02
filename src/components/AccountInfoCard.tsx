'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useExternalLink } from '@/hooks/useExternalLink';

import { useEffect, useState } from 'react';

import { CreditCard, ExternalLink } from 'lucide-react';

interface UserInfo {
  userId: string;
  email: string;
  name: string;
  subscriptionStatus: string;
  planName: string;
  isActive: boolean;
  expiryDate: string;
  daysRemaining: number;
  statusChanged: boolean;
  subscriptionType: string;
}

interface AccountInfoCardProps {
  user: UserInfo | null;
  onManageSubscription?: () => void;
  onGoToPricing?: () => void;
  className?: string;
  title?: string;
  subscriptionButtonText?: string;
}

export function AccountInfoCard({
  user,
  onGoToPricing,
  className = '',
  title = 'Account Information',
  subscriptionButtonText = 'Subscribe Now',
}: AccountInfoCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [userData, setUserData] = useState<UserInfo | null>(null);
  const { openExternalLink } = useExternalLink();

  useEffect(() => {
    if (user && Object.keys(user).length > 0) {
      setUserData(user);
    }
  }, [user]);

  const getUserDisplayName = (user: UserInfo) => {
    return user.name || user.email || 'Unknown User';
  };

  const getAvatarBgColor = (name: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getAvatarTextColor = (_bgColor: string) => {
    return 'text-white';
  };

  const handleStripePortalRedirect = async () => {
    try {
      setIsPortalLoading(true);

      // In this project, redirect to an external management page
      toast({
        title: 'Redirecting...',
        description: 'Opening subscription management portal',
      });

      // Simular redirección externa
      openExternalLink('https://iptradecopier.com/pricing');

      setIsPortalLoading(false);
    } catch (error) {
      setIsPortalLoading(false);

      toast({
        title: 'Error',
        description: 'Could not access subscription management portal',
        variant: 'destructive',
      });
    }
  };

  const handleDirectSubscription = async () => {
    try {
      setIsLoading(true);

      // Check if user is authenticated
      if (!userData || !userData.userId) {
        setIsLoading(false);
        toast({
          title: 'Authentication Required',
          description: 'Please log in to manage your subscription',
          variant: 'destructive',
        });
        return;
      }

      // Open pricing page
      if (onGoToPricing) {
        onGoToPricing();
      } else {
        openExternalLink('https://iptradecopier.com/pricing');
      }

      setIsLoading(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again later.',
        variant: 'destructive',
      });

      setIsLoading(false);
    }
  };

  if (!userData) {
    return (
      <Card className={`${className}`}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-4 px-4">
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage alt={getUserDisplayName(userData)} />
            <AvatarFallback
              className={`${getAvatarBgColor(getUserDisplayName(userData))} ${getAvatarTextColor(getAvatarBgColor(getUserDisplayName(userData)))}`}
            >
              {userData.email ? userData.email[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-md">{getUserDisplayName(userData)}</p>
            {userData.email && <p className="text-sm text-muted-foreground">{userData.email}</p>}
            <p className="text-sm text-muted-foreground">
              Current Plan: {userData.planName || 'Free'}
            </p>
            {userData.subscriptionType === 'admin_assigned' && (
              <p className="text-sm text-blue-600 font-medium">Admin Account</p>
            )}
            {userData.expiryDate && userData.daysRemaining > 0 && (
              <p className="text-sm text-muted-foreground">
                Expires in {userData.daysRemaining} days
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto cursor-pointer">
          {userData.subscriptionStatus === 'active' ||
          userData.subscriptionStatus === 'trialing' ||
          userData.subscriptionStatus === 'admin_assigned' ? (
            <>
              <Button
                variant="outline"
                className="border-gray-300 text-black hover:bg-gray-100 w-full md:w-auto cursor-pointer"
                onClick={handleDirectSubscription}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent shadow-lg"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Change Subscription
                  </>
                )}
              </Button>
              {(userData.subscriptionStatus === 'active' ||
                userData.subscriptionStatus === 'trialing') && (
                <Button
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50 w-full md:w-auto cursor-pointer"
                  onClick={handleStripePortalRedirect}
                  disabled={isPortalLoading}
                >
                  {isPortalLoading ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Manage Subscription
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button
              className="bg-black hover:bg-gray-800 text-white w-full md:w-auto cursor-pointer"
              onClick={handleDirectSubscription}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {subscriptionButtonText}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
