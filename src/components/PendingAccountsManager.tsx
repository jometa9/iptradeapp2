import React, { useCallback, useEffect, useState } from 'react';

import { Cable, HousePlug, PartyPopper, Smile, TrafficCone, Unplug } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useCSVData } from '../hooks/useCSVData';
import { useLinkPlatforms } from '../hooks/useLinkPlatforms';
import { usePendingAccounts } from '../hooks/usePendingAccounts';
import {
  canCreateMoreAccounts,
  getAccountLimitMessage,
  getSubscriptionLimits,
} from '../lib/subscriptionUtils';
import { SSEService } from '../services/sseService';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { toast } from './ui/use-toast';

interface ConversionForm {
  name: string;
  description: string;
  broker: string;
  platform: string;
  masterAccountId?: string;
  lotCoefficient: number;
  forceLot: number;
  reverseTrade: boolean;
}

type LinkingStep = 'idle' | 'starting' | 'finding' | 'syncing' | 'completed' | 'error';

interface LinkingStatus {
  step: LinkingStep;
  message: string;
  isActive: boolean;
}

export const PendingAccountsManager: React.FC = () => {
  const { secretKey, userInfo } = useAuth();
  const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:30';
  const { isLinking } = useLinkPlatforms();
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isRefreshingMasters, setIsRefreshingMasters] = useState(false);
  const [confirmingMasterId, setConfirmingMasterId] = useState<string | null>(null);

  // Inicializar isCollapsed desde localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('pendingAccountsCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  const [linkingStatus, setLinkingStatus] = useState<LinkingStatus>({
    step: 'idle',
    message: '',
    isActive: false,
  });
  const [conversionForm, setConversionForm] = useState<ConversionForm>({
    name: '',
    description: '',
    broker: 'MetaQuotes',
    platform: 'MT5',
    masterAccountId: 'none',
    lotCoefficient: 1,
    forceLot: 0,
    reverseTrade: false,
  });

  // Función para mapear códigos de plataforma a nombres amigables
  const getPlatformDisplayName = (platformCode: string): string => {
    const platformMap: Record<string, string> = {
      MT4: 'MetaTrader 4',
      MT5: 'MetaTrader 5',
      CT: 'cTrader',
      CTRADER: 'cTrader',
      TRADINGVIEW: 'TradingView',
    };

    return platformMap[platformCode?.toUpperCase()] || platformCode || 'Unknown';
  };

  const scanningMessages = [
    'Searching for new MetaTrader platforms...',
    'Your pending accounts are being processed...',
    'Checking Expert Advisor installation...',
    'Linking new platforms...',
    'Verifying new platform connections...',
    'Scanning for new trading terminals...',
    'The good traders have strong patience...',
    'Establishing new secure connections...',
    'Please be patient...',
    'Configuring new platform integration...',
    'To be continued...',
    'Finalizing new platform setup...',
    'Almost there...',
    'A lot of work to do...',
    'Too much files in the way...',
    'Yes, I know it takes time...',
  ];

  // State for rotating message
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  // Guardar isCollapsed en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('pendingAccountsCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Effect for rotating messages when in starting step
  useEffect(() => {
    if (linkingStatus.step === 'starting' && linkingStatus.isActive) {
      setIsRotating(true);
      setCurrentMessageIndex(0);

      const interval = setInterval(() => {
        setCurrentMessageIndex(prevIndex => (prevIndex + 1) % scanningMessages.length);
      }, 5000);

      return () => {
        clearInterval(interval);
        setIsRotating(false);
      };
    } else {
      setIsRotating(false);
    }
  }, [linkingStatus.step, linkingStatus.isActive, scanningMessages.length]);

  // Debug initial state
  console.log('🔍 PendingAccountsManager mounted - Initial state:', {
    isLinking,
    linkingStep: linkingStatus.step,
    linkingActive: linkingStatus.isActive,
  });

  // Usar el hook para pending accounts
  const { pendingData, loading: loadingPending, error: pendingError } = usePendingAccounts();

  // Usar el hook CSV solo para master accounts
  const { accounts: csvAccounts } = useCSVData();

  const masterAccounts = React.useMemo(() => {
    if (!csvAccounts?.masterAccounts) return [];

    return Object.entries(csvAccounts.masterAccounts).map(([id, master]) => {
      const masterData = master as Record<string, unknown>;
      return {
        id,
        name: masterData.name || id,
        broker: masterData.broker || 'Unknown',
        platform: masterData.platform || 'Unknown',
        registeredAt: masterData.registeredAt || new Date().toISOString(),
        status: masterData.status || 'offline',
      };
    });
  }, [csvAccounts]);

  // Obtener total de cuentas (masters + slaves) para el usuario
  const totalAccounts = React.useMemo(() => {
    if (!csvAccounts) return 0;
    return (
      Object.keys(csvAccounts.masterAccounts || {}).length +
      (csvAccounts.unconnectedSlaves || []).length
    );
  }, [csvAccounts]);

  const accountLimit = React.useMemo(() => {
    return userInfo ? getSubscriptionLimits(userInfo.subscriptionType).maxAccounts : null;
  }, [userInfo]);

  // Helper function to get linking status message and icon
  const getLinkingStatusDisplay = (status: LinkingStatus) => {
    const statusMap = {
      idle: { message: '', isLoading: false },
      starting: {
        message: isRotating
          ? scanningMessages[currentMessageIndex]
          : 'Scanning for link platforms process...',
        isLoading: true,
      },
      finding: {
        message: 'Scanning for MetaTrader installations...',
        isLoading: true,
      },
      syncing: { message: 'Syncing trading platforms...', isLoading: true },
      completed: {
        message: 'Success! Platforms linked successfully',
        isLoading: false,
      },
      error: { message: 'Error linking accounts. Please try again.', isLoading: false },
    };

    return statusMap[status.step];
  };

  // Load master accounts for slave connection
  const loadMasterAccounts = useCallback(async () => {
    try {
      setIsRefreshingMasters(true);
      const response = await fetch(`${baseUrl}/api/accounts/all`, {
        headers: {
          'x-api-key': secretKey || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Update the CSV data with the fresh master accounts data
        if (data.masterAccounts) {
          // Force a refresh of the CSV data to include the new master accounts
          console.log('🔄 Refreshing master accounts data:', data.masterAccounts);
        }
      } else {
        console.error('Failed to fetch master accounts');
      }
    } catch (error) {
      console.error('Error loading master accounts:', error);
    } finally {
      setIsRefreshingMasters(false);
    }
  }, [secretKey, baseUrl]);

  // loadAccountStats not used - using CSV data instead

  // Real-time events handled by SSE in useCSVData hook

  // Mostrar errores de pending accounts
  useEffect(() => {
    if (pendingError) {
      toast({
        title: 'Error',
        description: pendingError,
        variant: 'destructive',
      });
    }
  }, [pendingError]);

  // Listen to SSE events for real-time Link Platforms progress
  useEffect(() => {
    if (!secretKey) return;

    console.log('🔗 PendingAccountsManager: Setting up SSE listener for Link Platforms...');

    // Connect to SSE
    SSEService.connect(secretKey);

    const handleSSEMessage = (data: { type: string; [key: string]: unknown }) => {
      console.log('📨 PendingAccountsManager SSE message received:', data);

      // Listen for Link Platforms events
      if (data.type === 'linkPlatformsEvent') {
        console.log('🔗 Link Platforms SSE event detected:', data);

        switch (data.eventType) {
          case 'started':
            console.log('🚀 Link Platforms started - showing initial status');
            setLinkingStatus({
              step: 'starting',
              message: 'Starting link platforms process...',
              isActive: true,
            });
            break;

          case 'scanning':
            console.log('🔍 Platform scanning started');
            setLinkingStatus({
              step: 'finding',
              message: 'Scanning for MetaTrader installations...',
              isActive: true,
            });
            break;

          case 'syncing':
            console.log('⚙️ Syncing process started');
            setLinkingStatus({
              step: 'syncing',
              message: 'Syncing Expert Advisors to platforms...',
              isActive: true,
            });
            break;

          case 'completed':
            console.log('✅ Link Platforms completed - showing success');
            console.log('📋 Result data:', data.result);
            setLinkingStatus({
              step: 'completed',
              message: 'Success! Platforms linked successfully',
              isActive: true,
            });

            // Hide the status after 3 seconds
            setTimeout(() => {
              console.log('⏰ Hiding linking status after 3 seconds');
              setLinkingStatus({
                step: 'idle',
                message: '',
                isActive: false,
              });
            }, 5000);
            break;

          case 'idle':
            console.log('💤 Link Platforms is idle - stopping status display');
            setLinkingStatus({
              step: 'idle',
              message: '',
              isActive: false,
            });
            break;

          case 'error':
            console.log('❌ Link Platforms failed');
            setLinkingStatus({
              step: 'error',
              message: 'Error linking platforms. Please try again.',
              isActive: true,
            });

            // Hide the error after 5 seconds
            setTimeout(() => {
              setLinkingStatus({
                step: 'idle',
                message: '',
                isActive: false,
              });
            }, 5000);
            break;
        }
      }

      // Listen for command execution events to show detailed progress
      if (data.type === 'commandExecution') {
        const command = data.command as string;

        if (
          command &&
          command.includes('find') &&
          (command.includes('MQL4') || command.includes('MQL5'))
        ) {
          console.log('🔍 MetaTrader scan command detected');
          setLinkingStatus({
            step: 'finding',
            message: 'Scanning for MetaTrader installations...',
            isActive: true,
          });
        }
      }

      // Listen for sync events
      if (
        data.type === 'syncProgress' ||
        (typeof data.message === 'string' && data.message.includes('Synced'))
      ) {
        console.log('⚙️ Sync operation detected');
        setLinkingStatus({
          step: 'syncing',
          message: 'Syncing Expert Advisors to platforms...',
          isActive: true,
        });
      }
    };

    // Add listener
    const listenerId = SSEService.addListener(handleSSEMessage);

    return () => {
      console.log('🔌 PendingAccountsManager: Removing SSE listener');
      SSEService.removeListener(listenerId);
    };
  }, [secretKey]);

  // Also watch for isLinking changes (fallback in case SSE events are missed)
  useEffect(() => {
    console.log('🔗 isLinking state changed:', isLinking, 'Current step:', linkingStatus.step);

    if (isLinking && linkingStatus.step === 'idle') {
      console.log('🚀 Fallback: Link Platforms started via isLinking state');
      setLinkingStatus({
        step: 'starting',
        message: 'Starting link platforms process...',
        isActive: true,
      });
    }

    if (
      !isLinking &&
      linkingStatus.isActive &&
      linkingStatus.step !== 'completed' &&
      linkingStatus.step !== 'error'
    ) {
      console.log('✅ Fallback: Link Platforms completed via isLinking state');
      setLinkingStatus({
        step: 'completed',
        message: 'Success! Platforms linked successfully',
        isActive: true,
      });

      // Hide the status after 3 seconds
      setTimeout(() => {
        setLinkingStatus({
          step: 'idle',
          message: '',
          isActive: false,
        });
      }, 3000);
    }
  }, [isLinking, linkingStatus.step, linkingStatus.isActive]);

  // Open conversion form inline or master confirmation
  const openConversionForm = async (
    account: { account_id: string; platform?: string | null },
    type: 'master' | 'slave'
  ) => {
    console.log('🔍 openConversionForm called:', { account, type });

    if (type === 'master') {
      // For master, just show confirmation and hide slave form if open
      setExpandedAccountId(null);
      setConfirmingMasterId(account.account_id);
    } else {
      // For slave, show form directly and hide master confirmation if open
      console.log('🔄 Setting up slave conversion form for account:', account.account_id);
      setConfirmingMasterId(null);
      setExpandedAccountId(account.account_id);

      // Refresh master accounts list to ensure we have the latest data
      await loadMasterAccounts();

      setConversionForm({
        name: `Account ${account.account_id}`,
        description: '',
        broker: 'MetaQuotes',
        platform: account.platform || 'Unknown',
        masterAccountId: 'none',
        lotCoefficient: 1,
        forceLot: 0,
        reverseTrade: false,
      });
      console.log('✅ Conversion form set:', conversionForm);
    }
  };

  // Cancel conversion
  const cancelConversion = () => {
    setExpandedAccountId(null);
    setIsConverting(false);
    setConfirmingMasterId(null);
  };

  // Convert directly to master (no form needed)
  const convertToMaster = async (accountId: string, accountPlatform: string) => {
    setIsConverting(true);

    try {
      // Actualizar el CSV de pending a master
      console.log(`📝 Updating CSV account ${accountId} from pending to master...`);
      const csvUpdateResponse = await fetch(`${baseUrl}/api/csv/pending/${accountId}/update-type`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey || '',
        },
        body: JSON.stringify({
          newType: 'master',
        }),
      });

      if (!csvUpdateResponse.ok) {
        const error = await csvUpdateResponse.json();
        throw new Error(error.message || 'Failed to update CSV account type');
      }

      console.log('✅ CSV updated successfully');

      // Cerrar el modal
      setConfirmingMasterId(null);

      // Mostrar mensaje de éxito
      toast({
        title: 'Success',
        description: `Account ${accountId} converted to master successfully`,
      });

      // Refrescar la lista de master accounts
      await loadMasterAccounts();
    } catch (error) {
      console.error('Error converting account to master:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error converting account to master',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Convert pending account (slave only - master uses convertToMaster)
  const convertAccount = async () => {
    console.log('🚀 convertAccount called, expandedAccountId:', expandedAccountId);
    console.log('🔧 Current conversionForm:', conversionForm);

    if (!expandedAccountId) {
      console.log('❌ No expandedAccountId, returning early');
      return;
    }

    setIsConverting(true);

    try {
      // Actualizar el CSV de pending a slave
      console.log(`📝 Updating CSV account ${expandedAccountId} from pending to slave...`);
      const csvUpdateResponse = await fetch(
        `${baseUrl}/api/csv/pending/${expandedAccountId}/update-type`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': secretKey || '',
          },
          body: JSON.stringify({
            newType: 'slave',
          }),
        }
      );

      if (!csvUpdateResponse.ok) {
        const error = await csvUpdateResponse.json();
        throw new Error(error.message || 'Failed to update CSV account type');
      }

      console.log('✅ CSV updated successfully');

      // Si hay un masterAccountId, también podríamos necesitar registrar la conexión
      // Por ahora solo actualizamos el CSV

      // Mostrar mensaje de éxito
      if (conversionForm.masterAccountId && conversionForm.masterAccountId !== 'none') {
        toast({
          title: 'Slave Account Created',
          description: `Account ${expandedAccountId} has been converted to slave. You may need to configure the connection separately.`,
        });
      } else {
        toast({
          title: 'Account Converted',
          description: `Account ${expandedAccountId} has been converted to slave successfully`,
        });
      }

      // Cerrar el formulario
      setExpandedAccountId(null);
    } catch (error) {
      console.error('Error converting account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error converting account',
        variant: 'destructive',
      });
    } finally {
      setIsConverting(false);
    }
  };

  const pendingCount = pendingData?.summary?.totalAccounts || 0;
  const accounts = pendingData?.accounts || [];

  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cable className="h-5 w-5" />
                Pending Accounts
                {pendingCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="bg-orange-50 text-orange-800 border border-orange-300 mt-0.5"
                  >
                    {pendingCount}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-gray-50 text-gray-600 border border-gray-300 mt-0.5"
                  >
                    No pending accounts
                  </Badge>
                )}
                {linkingStatus.isActive &&
                  linkingStatus.step !== 'idle' &&
                  (isCollapsed || pendingCount > 0) && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-50  mt-0.5 link-platforms-gradient-text"
                    >
                      {getLinkingStatusDisplay(linkingStatus).message}
                    </Badge>
                  )}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 px-2 text-[12px] text-gray-400"
            >
              {isCollapsed ? <>Show</> : <>Hide</>}
            </Button>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            {pendingCount === 0 ? (
              <div className="text-center py-4">
                {/* Solo mostrar el mensaje de linking si realmente no hay cuentas Y no estamos cargando */}
                {linkingStatus.isActive &&
                  linkingStatus.step !== 'idle' &&
                  linkingStatus.step !== 'completed' && (
                    <>
                      <TrafficCone className="h-5 w-5 mx-auto mb-3 text-gray-500" />
                      <p className="text-muted-foreground text-gray-600 link-platforms-gradient-text">
                        {getLinkingStatusDisplay(linkingStatus).message}
                      </p>
                    </>
                  )}
                {!linkingStatus.isActive && linkingStatus.step === 'idle' && (
                  <>
                    <Smile className="h-5 w-5 mx-auto mb-3 text-gray-500" />
                    <p className="text-muted-foreground text-gray-600">No pending accounts</p>
                  </>
                )}

                {linkingStatus.step === 'completed' && (
                  <PartyPopper className="h-5 w-5 mx-auto mb-3 text-gray-500" />
                )}

                <p className="text-[10px] text-muted-foreground mt-3 text-gray-400">
                  If you are not seeing your accounts, please check the following:
                </p>
                <ul className="list-disc list-inside text-[10px] text-muted-foreground mt-2 text-gray-400">
                  <li>Click on the "Link Platforms" button on the top right</li>
                  <li>Open or refresh all your MetaTrader platforms</li>
                  <li>In MetaTrader, add IPTRADE Expert Advisor to the chart</li>
                  <li>Wait for the EA to connect to the app and it will appear here</li>
                </ul>
                <p className="text-[10px] text-muted-foreground mt-2 text-gray-400">
                  <a
                    href="https://iptradecopier.com/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 "
                  >
                    For more info or details, click here
                  </a>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map(account => {
                  const isOnline = (account.current_status || account.status) === 'online';

                  return (
                    <div
                      key={account.account_id}
                      className={`border rounded-lg p-2 shadow ${
                        isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`font-semibold ml-2 ${
                              isOnline ? 'text-green-900' : 'text-orange-900'
                            }`}
                          >
                            {account.account_id}
                          </h3>
                          <Badge
                            variant="outline"
                            className={
                              isOnline
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : 'bg-red-50 text-red-800 border-red-300'
                            }
                          >
                            {isOnline ? 'Pending Online' : 'Pending Offline'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-gray-50 text-gray-800 border border-gray-300"
                          >
                            {getPlatformDisplayName(account.platform)}
                          </Badge>
                          {/* Removed timeDiff display for pending accounts */}
                        </div>

                        {/* aca agregar otro badgegt para la plataforma */}

                        <div className="flex items-center gap-2 flex-wrap justify-left lg:p-0 lg:m-0">
                          {/* debo agregar botones de confirmacion para slave y master */}
                          {confirmingMasterId === account.account_id ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-blue-50 h-9   rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100"
                                onClick={() =>
                                  convertToMaster(account.account_id, account.platform || 'Unknown')
                                }
                                disabled={isConverting}
                              >
                                {isConverting ? (
                                  <>
                                    <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent mr-1" />
                                    Converting...
                                  </>
                                ) : (
                                  <>
                                    <HousePlug className="h-4 w-4 mr-2" />
                                    Convert to Master
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gray-50 h-9  rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100"
                                onClick={cancelConversion}
                                disabled={isConverting}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : expandedAccountId === account.account_id ? (
                            // Show conversion form buttons when form is open
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-50 h-9 rounded-lg border-green-200 text-green-700 hover:bg-green-100"
                                onClick={convertAccount}
                                disabled={isConverting}
                              >
                                {isConverting ? (
                                  <>
                                    <div className="h-4 w-4 rounded-full border-2 border-green-600 border-t-transparent mr-1" />
                                    Converting...
                                  </>
                                ) : (
                                  <>
                                    <Unplug className="h-4 w-4 mr-2" />
                                    Convert to Slave
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gray-50 h-9 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-100"
                                onClick={cancelConversion}
                                disabled={isConverting}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            // Normal buttons - only show if account is online
                            <>
                              {!isOnline ? (
                                // Show offline status only
                                <div className="h-9 w-9"></div>
                              ) : (
                                // Show normal buttons for online accounts
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-white h-9 w-9 p-0 rounded-lg border-blue-200 text-blue-700 hover:bg-gray-50"
                                    onClick={async () =>
                                      await openConversionForm(account, 'master')
                                    }
                                    title="Make Master"
                                    disabled={
                                      isConverting ||
                                      (userInfo &&
                                        !canCreateMoreAccounts(userInfo, totalAccounts)) ||
                                      false
                                    }
                                  >
                                    <HousePlug className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-white h-9 w-9 p-0 rounded-lg border-green-200 text-green-700 hover:bg-gray-50"
                                    onClick={async () => await openConversionForm(account, 'slave')}
                                    title="Make Slave"
                                    disabled={
                                      isConverting ||
                                      (userInfo &&
                                        !canCreateMoreAccounts(userInfo, totalAccounts)) ||
                                      false
                                    }
                                  >
                                    <Unplug className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline Conversion Form */}
                      {expandedAccountId === account.account_id && (
                        <div className="p-2">
                          <h2 className="text-lg flex items-center font-medium ">
                            <Unplug className="h-4 w-4 mr-2" />
                            Convert to Slave
                          </h2>

                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              convertAccount();
                            }}
                            className="space-y-4 pt-2"
                          >
                            {/* Trading Configuration */}
                            <div className="space-y-4">
                              {/* First Row: Master Connection + Lot Multiplier */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Master Connection Section */}
                                <div>
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="convert-master">Connect to</Label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={loadMasterAccounts}
                                      disabled={isRefreshingMasters}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {isRefreshingMasters ? (
                                        <div className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                      ) : (
                                        '↻'
                                      )}
                                    </Button>
                                  </div>
                                  <Select
                                    value={conversionForm.masterAccountId}
                                    onValueChange={value =>
                                      setConversionForm(prev => ({
                                        ...prev,
                                        masterAccountId: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="bg-white border border-gray-200">
                                      <SelectValue placeholder="Select master..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border border-gray-200">
                                      {masterAccounts.length > 0 ? (
                                        <>
                                          <SelectItem value="none">
                                            Not connected (configure later)
                                          </SelectItem>
                                          {masterAccounts.map(master => (
                                            <SelectItem
                                              key={master.id}
                                              value={master.id}
                                              className=" hover:bg-gray-50 cursor-pointer"
                                            >
                                              {String(master.name || master.id)} (
                                              {String(master.platform)})
                                            </SelectItem>
                                          ))}
                                        </>
                                      ) : (
                                        <SelectItem value="none" disabled>
                                          No master accounts available
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                    {masterAccounts.length === 0
                                      ? 'No master accounts available. Convert a pending account to master first.'
                                      : 'Set the master account to convert to'}
                                  </p>
                                </div>

                                <div>
                                  <Label htmlFor="lotCoefficient">
                                    Lot Multiplier (0.01 - 100)
                                  </Label>
                                  <Input
                                    id="lotCoefficient"
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={conversionForm.lotCoefficient.toFixed(2)}
                                    onChange={e => {
                                      const inputValue = e.target.value;
                                      let value = 1;

                                      if (inputValue !== '') {
                                        // Permitir valores con hasta 2 decimales
                                        const parsedValue = parseFloat(inputValue);
                                        if (!isNaN(parsedValue) && parsedValue > 0) {
                                          // Redondear a 2 decimales para evitar problemas de precisión
                                          value = Math.round(parsedValue * 100) / 100;
                                        }
                                      }

                                      setConversionForm(prev => ({
                                        ...prev,
                                        lotCoefficient: value,
                                      }));
                                    }}
                                    className="bg-white border border-gray-200"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                    Multiplies the lot size from the master account
                                  </p>
                                </div>
                              </div>

                              {/* Second Row: Fixed Lot + Reverse Trading */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <div>
                                  <Label htmlFor="forceLot">Fixed Lot (0 to disable)</Label>
                                  <Input
                                    id="forceLot"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={
                                      conversionForm.forceLot > 0
                                        ? conversionForm.forceLot.toFixed(2)
                                        : '0.00'
                                    }
                                    onChange={e => {
                                      const inputValue = e.target.value;
                                      let value = 0;

                                      if (inputValue !== '') {
                                        // Permitir valores con hasta 2 decimales
                                        const parsedValue = parseFloat(inputValue);
                                        if (!isNaN(parsedValue)) {
                                          // Redondear a 2 decimales para evitar problemas de precisión
                                          value = Math.round(parsedValue * 100) / 100;
                                        }
                                      }

                                      setConversionForm(prev => ({
                                        ...prev,
                                        forceLot: value,
                                      }));
                                    }}
                                    className="bg-white border border-gray-200"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                                    If greater than 0, uses this fixed lot instead of copying
                                  </p>
                                </div>

                                <div className="flex items-center space-x-2 pt-1">
                                  <Switch
                                    id="reverseTrade"
                                    checked={conversionForm.reverseTrade}
                                    onCheckedChange={checked =>
                                      setConversionForm(prev => ({
                                        ...prev,
                                        reverseTrade: checked,
                                      }))
                                    }
                                  />
                                  <Label
                                    htmlFor="reverseTrade"
                                    className="font-medium cursor-pointer"
                                  >
                                    Reverse trades
                                  </Label>
                                  <p className="text-xs text-muted-foreground text-gray-500">
                                    Reverse the trade direction (buy/sell)
                                  </p>
                                </div>
                              </div>
                            </div>
                          </form>
                        </div>
                      )}
                      {/* Show limit message if reached */}
                      {userInfo && accountLimit !== null && totalAccounts >= accountLimit && (
                        <div className="p-2 text-xs text-orange-800 font-semibold">
                          {getAccountLimitMessage(userInfo, totalAccounts)} Delete an account to add
                          another one.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
};
