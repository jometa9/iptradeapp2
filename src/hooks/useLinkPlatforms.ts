import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import type { LinkPlatformsResult } from '../services/linkPlatformsService';
import { linkPlatformsService } from '../services/linkPlatformsService';
import { SSEService } from '../services/sseService';

// Removed useHiddenPendingAccounts - functionality moved to useUnifiedAccountData

interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
}

interface LinkPlatformsProgress {
  message: string;
  progress?: ProgressInfo;
  details?: {
    mql4Platforms?: number;
    mql5Platforms?: number;
    ninjaTraderPlatforms?: number;
    filesSynced?: number;
    csvFilesFound?: number;
  };
}

interface SSEMessageData {
  type: string;
  eventType?: string;
  message?: string;
  progress?: ProgressInfo;
  details?: {
    mql4Platforms?: number;
    mql5Platforms?: number;
    csvFilesFound?: number;
  };
  result?: {
    backgroundScan?: boolean;
    [key: string]: unknown;
  };
  error?: string;
  newInstallations?: {
    mql4?: number;
    mql5?: number;
    ninjaTrader?: number;
    total?: number;
  };
}

// Singleton state para evitar múltiples polling intervals
class LinkPlatformsManager {
  private static instance: LinkPlatformsManager;
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private listeners = new Set<() => void>();

  static getInstance(): LinkPlatformsManager {
    if (!LinkPlatformsManager.instance) {
      LinkPlatformsManager.instance = new LinkPlatformsManager();
    }
    return LinkPlatformsManager.instance;
  }

  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }

  startPolling(secretKey: string, isLinking: boolean, onFindBotsCompleted?: () => void, linkingSource?: 'link' | 'bot' | null) {
    // Find Bots is now synchronous, no need for polling
    if (linkingSource === 'bot') {
      console.log('🔍 Skipping polling for Find Bots (now synchronous)');
      return;
    }
    
    if (this.isPolling || !isLinking || !secretKey) return;

    this.isPolling = true;
    this.pollInterval = setInterval(async () => {
      try {
        const status = await linkPlatformsService.getLinkingStatus(secretKey);
        if (!status.isLinking) {
          this.stopPolling();
          this.notifyListeners();
        }
      } catch {
        // Don't change state on polling errors to avoid false negatives
      }
    }, 1000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  isCurrentlyPolling(): boolean {
    return this.isPolling;
  }
}

export const useLinkPlatforms = (onFindBotsCompleted?: () => void) => {
  const { secretKey } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [linkingSource, setLinkingSource] = useState<'link' | 'bot' | null>(null);
  const [lastResult, setLastResult] = useState<LinkPlatformsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LinkPlatformsProgress | null>(null);
  const listenerIdRef = useRef<string | null>(null);
  const hasCheckedInitialStatus = useRef<boolean>(false);
  // Removed clearHiddenAccounts - functionality moved to useUnifiedAccountData

  // Track isLinking state changes
  const setIsLinkingWithLog = useCallback((
    newValue: boolean,
    reason: string,
    source?: 'link' | 'bot' | null
  ) => {
    setIsLinking(newValue);
    if (newValue === false || source !== undefined) {
      setLinkingSource(source || null);
    }
  }, []);

  // Check if Link Platforms is currently running on server
  const checkLinkingStatus = useCallback(async () => {
    // TEMPORAL: Permitir ejecución sin secretKey para testing
    if (!secretKey) {
      return; // ← COMENTADO TEMPORALMENTE
    }

    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(`http://localhost:${serverPort}/api/link-platforms/status`, {
        headers: {
          'x-api-key': secretKey || 'test-key', // TEMPORAL: usar test-key si no hay secretKey
        },
      });

      if (response.ok) {
        const status = await response.json();

        if (status.isLinking) {
          setIsLinkingWithLog(true, 'server status check - process running');
        } else {
          setIsLinkingWithLog(false, 'server status check - process completed');
        }
      }
    } catch {
      setIsLinkingWithLog(false, 'status check failed - assuming completed');
    }
  }, [secretKey, setIsLinkingWithLog]);

  const linkPlatforms = async (source: 'link' | 'bot' = 'link') => {
    if (!secretKey) {
      setError('Authentication required');
      return;
    }

    // Check if already linking before making the request
    if (isLinking) {
      setError('Process is already running. Please wait for it to complete.');
      return;
    }

    setIsLinkingWithLog(true, 'manual button click', source);
    setError(null);
    setProgress(null);

    try {
      const result = await linkPlatformsService.linkPlatforms(secretKey);

      // The new API responds immediately when the process starts
      if (result.success && result.backgroundProcess) {
        // Process started successfully in background
        // Keep isLinking = true and let SSE events handle the completion
        console.log('✅ Link Platforms process started in background');
        return result;
      }

      // Legacy handling for old response format (if any)
      setLastResult(result);

      if (result.result?.errors?.length > 0) {
        // Handle errors silently
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Link Platforms failed';
      setError(errorMessage);

      // If the error is about already running, don't stop the spinner since it's running elsewhere
      if (errorMessage.includes('already running')) {
        // Don't set isLinking to false here, let the SSE events handle it
        return;
      }

      // For other errors, stop the linking state
      setIsLinkingWithLog(false, 'link platforms request failed');
      throw err;
    }
  };

  const findBots = async () => {
    const startTime = Date.now();
    console.log('🔍 FRONTEND HOOK: findBots called at', new Date().toISOString());
    console.log('🔍 FRONTEND HOOK: secretKey exists:', !!secretKey);
    console.log('🔍 FRONTEND HOOK: current isLinking state:', isLinking);
    
    if (!secretKey) {
      console.error('❌ FRONTEND HOOK: No secretKey available');
      setError('Authentication required');
      return;
    }

    // Check if already linking before making the request
    if (isLinking) {
      console.warn('⚠️ FRONTEND HOOK: Process already running, aborting');
      setError('Process is already running. Please wait for it to complete.');
      return;
    }

    console.log('🔍 FRONTEND HOOK: Setting linking state to true');
    setIsLinkingWithLog(true, 'manual find bots click', 'bot');
    setError(null);
    setProgress(null);

    try {
      console.log('🔍 FRONTEND HOOK: Starting Find Bots (synchronous)...');
      console.log('🔍 FRONTEND HOOK: Calling linkPlatformsService.findBots...');
      
      // The API now waits for completion before responding
      const result = await linkPlatformsService.findBots(secretKey);
      
      const duration = Date.now() - startTime;
      console.log(`🔍 FRONTEND HOOK: Find Bots completed in ${duration}ms:`, result);
      console.log('🔍 FRONTEND HOOK: Result structure:', {
        success: result.success,
        message: result.message,
        hasResult: !!result.result,
        csvFilesCount: result.result?.csvFiles?.length || 0,
        errorsCount: result.result?.errors?.length || 0
      });
      
      // Process completed, update state
      setLastResult(result);
      setIsLinkingWithLog(false, 'find bots completed successfully');
      
      // Trigger unified data refresh immediately after completion
      if (onFindBotsCompleted) {
        console.log('✅ FRONTEND HOOK: Find Bots completed, refreshing unified data...');
        onFindBotsCompleted();
      }
      
      if (result.result?.errors?.length > 0) {
        console.warn('⚠️ FRONTEND HOOK: Find Bots completed with errors:', result.result.errors);
      }

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Find Bots failed';
      console.error(`❌ FRONTEND HOOK: Find Bots failed after ${duration}ms:`, errorMessage);
      console.error('❌ FRONTEND HOOK: Error details:', err);
      setError(errorMessage);
      setIsLinkingWithLog(false, 'find bots request failed');
      
      throw err;
    }
  };

  // SSE listener para eventos de Link Platforms
  useEffect(() => {
    // Verificar estado inicial solo una vez
    if (!hasCheckedInitialStatus.current) {
      hasCheckedInitialStatus.current = true;
      checkLinkingStatus();
    }

    // Conectar al SSE (solo creará conexión si no existe)
    SSEService.connect(secretKey);

    const handleSSEMessage = (data: SSEMessageData) => {
      if (data.type !== 'heartbeat' && data.type !== 'initial_data') {
        // Log non-heartbeat messages for debugging
      }

      // Escuchar eventos de Link Platforms
      if (data.type === 'linkPlatformsEvent') {
        switch (data.eventType) {
          case 'started':
            setIsLinkingWithLog(true, 'SSE started event');
            setError(null);
            setProgress({
              message: data.message || 'Starting Link Platforms process...',
              progress: data.progress
            });
            break;

          case 'progress':
            setProgress({
              message: data.message || 'Processing...',
              progress: data.progress,
              details: data.details
            });
            break;

          case 'scanning':
            setProgress({
              message: data.message || 'Scanning for platforms...',
              progress: data.progress
            });
            break;

          case 'syncing':
            setProgress({
              message: data.message || 'Syncing files...',
              progress: data.progress
            });
            break;

          case 'completed':
            if (data.result) {
              setLastResult({
                success: true,
                message: data.message || 'Process completed',
                result: data.result as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              });
            }
            setProgress({
              message: data.message || 'Process completed successfully',
              progress: data.progress || { current: 100, total: 100, percentage: 100 }
            });
            // Removed clearHiddenAccounts - functionality moved to useUnifiedAccountData

            if (data.result?.backgroundScan) {
              // Background scan is running, keep spinner active
            } else {
              // Check if this was a Find Bots process completion BEFORE resetting linkingSource
              const wasFindBotsProcess = linkingSource === 'bot';
              
              setIsLinkingWithLog(false, 'SSE completed event');
              
              // If this was a Find Bots process completion, trigger unified data refresh IMMEDIATELY
              if (wasFindBotsProcess && onFindBotsCompleted) {
                console.log('✅ Find Bots completed, refreshing unified data...');
                onFindBotsCompleted();
              }
            }
            break;

          case 'idle':
            // El servidor está indicando que Link Platforms no está corriendo
            setIsLinkingWithLog(false, 'SSE idle event');
            setProgress(null);
            break;

          case 'error':
            setIsLinkingWithLog(false, 'SSE error event');
            setError(data.error || 'Link Platforms failed');
            setProgress(null);
            if (data.result) {
              setLastResult({
                success: false,
                message: data.message || 'Process failed',
                result: data.result as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              });
            }
            break;
        }
      }

      // Escuchar eventos de background scan (AFECTA spinner cuando cache se usa)
      if (data.type === 'backgroundScanEvent') {
        switch (data.eventType) {
          case 'completed':
            // Si había background scan, terminar el spinner ahora
            setIsLinkingWithLog(false, 'SSE background scan completed');

            // Removed clearHiddenAccounts - functionality moved to useUnifiedAccountData

            if (
              data.newInstallations &&
              (data.newInstallations.mql4 > 0 ||
                data.newInstallations.mql5 > 0 ||
                data.newInstallations.ninjaTrader > 0)
            ) {
              // Handle new installations
            } else {
              // No new installations
            }
            break;

          case 'error':
            // Si el background scan falló, terminar el spinner
            setIsLinkingWithLog(false, 'SSE background scan error');
            break;
        }
      }
    };

    // Agregar listener
    const listenerId = SSEService.addListener(handleSSEMessage);
    listenerIdRef.current = listenerId;

    return () => {
      if (listenerIdRef.current) {
        SSEService.removeListener(listenerIdRef.current);
      }
    };
  }, [secretKey, checkLinkingStatus, setIsLinkingWithLog]);

  // Polling fallback: Check linking status every second when isLinking is true (usando singleton)
  useEffect(() => {
    const manager = LinkPlatformsManager.getInstance();
    
    if (isLinking && secretKey) {
      // Iniciar polling solo si no está ya en curso
      manager.startPolling(secretKey, isLinking, onFindBotsCompleted, linkingSource);
      
      // Suscribirse a notificaciones de completion
      const unsubscribe = manager.addListener(() => {
        if (isLinking) {
          setIsLinkingWithLog(false, 'polling detected completion');
        }
      });

      return unsubscribe;
    } else {
      // Detener polling si ya no está linking
      manager.stopPolling();
    }
  }, [isLinking, secretKey, setIsLinkingWithLog, onFindBotsCompleted, linkingSource]);

  // Función para limpiar el cache de auto-link
  const clearAutoLinkCache = () => {
    localStorage.removeItem('iptrade_auto_link_executed');
  };

  return {
    linkPlatforms,
    findBots,
    isLinking,
    linkingSource,
    lastResult,
    error,
    progress,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null),
    clearProgress: () => setProgress(null),
    clearAutoLinkCache,
  };
};
