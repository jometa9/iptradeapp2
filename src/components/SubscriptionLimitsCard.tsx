import React, { useEffect, useState } from 'react';

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

// Estilos para la animación
const fadeInDownAnimation = {
  opacity: 1,
  animation: 'fadeInDown 0.5s ease-out',
  transition: 'opacity 0.3s, transform 0.3s'
};

// Estilo para cuando desaparece
const fadeOutAnimation = {
  opacity: 0,
  transform: 'translateY(-10px)',
  transition: 'opacity 0.5s, transform 0.5s'
};

interface SubscriptionLimitsCardProps {
  currentAccountCount: number;
  showDetailedLimits?: boolean;
  className?: string;
  temporaryDuration?: number; // Duración en ms para la tarjeta temporal
}

// Componente principal de tarjeta de límites de suscripción
export const SubscriptionLimitsCard: React.FC<SubscriptionLimitsCardProps> = ({
  currentAccountCount,
  showDetailedLimits = true,
  className = '',
}) => {
  const { userInfo } = useAuth();

  if (!userInfo) {
    return null;
  }

  // Don't show the card for plans that don't need to show limits
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

          {remainingSlots !== null && (
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

// Componente de tarjeta temporal que solo se muestra por un tiempo limitado
export const TemporarySubscriptionLimitsCard: React.FC<{
  className?: string;
  temporaryDuration?: number;
}> = ({
  className = '',
  temporaryDuration = 10000, // 10 segundos por defecto
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const { userInfo } = useAuth();

  // Ocultar la tarjeta después del tiempo especificado
  useEffect(() => {
    if (!isVisible) return;
    
    // Iniciar desvanecimiento medio segundo antes
    const fadeTimer = setTimeout(() => {
      setIsLeaving(true);
    }, temporaryDuration - 500);
    
    // Ocultar completamente
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, temporaryDuration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [temporaryDuration, isVisible]);

  // No mostrar si no es visible o si no hay información de usuario
  if (!isVisible || !userInfo) {
    return null;
  }

  // Solo mostrar para planes gratuitos y Premium
  if (!shouldShowSubscriptionLimitsCard(userInfo.planName)) {
    return null;
  }

  return (
    <Card 
      className={`${className} bg-white`}
      style={isLeaving ? fadeOutAnimation : fadeInDownAnimation}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {userInfo.planName === 'IPTRADE Premium' ? (
              <Crown className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            Subscription Limits
          </CardTitle>
          <Badge
            className={
              userInfo.planName === 'IPTRADE Premium'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-gray-100 text-gray-800 border-gray-200'
            }
          >
            {userInfo.planName === null ? 'Free' : userInfo.planName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simplified content for temporary card */}
        <div className="space-y-2">
          <p className="text-sm">
            {userInfo.planName === null
              ? 'Your Free plan allows 3 accounts with 0.01 lot size.'
              : 'Your Premium plan allows 5 accounts with unlimited lot size.'}
          </p>
          
          {userInfo.planName === null && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 font-medium">Upgrade to unlock more features</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
