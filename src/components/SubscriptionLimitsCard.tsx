import React from 'react';

import { AlertCircle, CheckCircle, Crown, Zap } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import {
  canCreateMoreAccounts,
  canSetCustomLotSizes,
  getPlanBadgeColor,
  getPlanDisplayName,
  getRemainingAccountSlots,
  getSubscriptionLimits,
  shouldShowSubscriptionLimitsCard,
} from '../lib/subscriptionUtils';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface SubscriptionLimitsCardProps {
  currentAccountCount: number;
  showDetailedLimits?: boolean;
  className?: string;
}

export const SubscriptionLimitsCard: React.FC<SubscriptionLimitsCardProps> = ({
  currentAccountCount,
  showDetailedLimits = true,
  className = '',
}) => {
  const { userInfo } = useAuth();

  if (!userInfo) {
    return null;
  }

  // Don't show the card for premium plans that don't need to show limits
  if (!shouldShowSubscriptionLimitsCard(userInfo.planName)) {
    return null;
  }

  const limits = getSubscriptionLimits(userInfo.planName);
  const planDisplayName = getPlanDisplayName(userInfo.planName);
  const badgeColor = getPlanBadgeColor(userInfo.planName);
  const canAddAccounts = canCreateMoreAccounts(userInfo, currentAccountCount);
  const canCustomizeLots = canSetCustomLotSizes(userInfo);
  const remainingSlots = getRemainingAccountSlots(userInfo, currentAccountCount);

  const getPlanIcon = () => {
    switch (userInfo.planName) {
      case 'IPTRADE Premium':
        return <Crown className="w-4 h-4" />;
      case 'IPTRADE Unlimited':
      case 'IPTRADE Managed VPS':
        return <Zap className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card className={` ${className} bg-white`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getPlanIcon()}
            Subscription Limits
          </CardTitle>
          <Badge className={badgeColor}>{planDisplayName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Limits */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Trading Accounts</span>
            <div className="flex items-center gap-2">
              {canAddAccounts ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                {currentAccountCount}/{limits.maxAccounts || '∞'}
              </span>
            </div>
          </div>

          {limits.maxAccounts !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${canAddAccounts ? 'bg-green-500' : 'bg-red-500'}`}
                style={{
                  width: `${Math.min(100, (currentAccountCount / limits.maxAccounts) * 100)}%`,
                }}
              />
            </div>
          )}

          {!canAddAccounts && limits.maxAccounts !== null && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                Account limit reached. Upgrade to add more accounts.
              </p>
            </div>
          )}

          {canAddAccounts && remainingSlots !== null && (
            <p className="text-sm text-muted-foreground">
              {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>

        {/* Lot Size Limits */}
        {showDetailedLimits && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lot Size</span>
              <div className="flex items-center gap-2">
                {canCustomizeLots ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span className="text-sm">{limits.maxLotSize || 'Unlimited'}</span>
              </div>
            </div>

            {!canCustomizeLots && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  Free plan users are limited to 0.01 lot size
                </p>
              </div>
            )}
          </div>
        )}

        {/* Features */}
        {showDetailedLimits && limits.features && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Features</span>
            <div className="flex flex-wrap gap-1">
              {limits.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {feature.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade CTA for free users */}
        {userInfo.planName === null && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-medium">Upgrade to unlock more features</p>
            <p className="text-xs text-blue-600 mt-1">
              Get unlimited accounts and custom lot sizes with our premium plans
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
