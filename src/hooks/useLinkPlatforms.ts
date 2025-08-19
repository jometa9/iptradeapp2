import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import type { LinkPlatformsResult } from '../services/linkPlatformsService';
import { linkPlatformsService } from '../services/linkPlatformsService';
import { SSEService } from '../services/sseService';
import { useHiddenPendingAccounts } from './useHiddenPendingAccounts';

export const useLinkPlatforms = () => {
  const { secretKey } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [lastResult, setLastResult] = useState<LinkPlatformsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerIdRef = useRef<string | null>(null);
  const hasCheckedInitialStatus = useRef<boolean>(false);
  const { clearHiddenAccounts } = useHiddenPendingAccounts();

  // Track isLinking state changes
  const setIsLinkingWithLog = (newValue: boolean, reason: string) => {
    setIsLinking(newValue);
  };

  // Check if Link Platforms is currently running on server
  const checkLinkingStatus = async () => {
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
    } catch (error) {
      setIsLinkingWithLog(false, 'status check failed - assuming completed');
    }
  };

  const linkPlatforms = async () => {
    if (!secretKey) {
      setError('Authentication required');
      return;
    }

    // Check if already linking before making the request
    if (isLinking) {
      setError('Link Platforms is already running. Please wait for it to complete.');
      return;
    }

    setIsLinkingWithLog(true, 'manual button click');
    setError(null);

    try {
      const result = await linkPlatformsService.linkPlatforms(secretKey);

      setLastResult(result);

      // IMPORTANT: If the HTTP request completes successfully, it means the process finished
      // We should stop the spinner immediately since there's no background scan
      if (result.success && !result.result.backgroundScan) {
        clearHiddenAccounts();
        setIsLinkingWithLog(false, 'HTTP request completed without background scan');
      }

      if (result.result.errors.length > 0) {
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

      throw err;
    } finally {
      // Only stop spinner if it's not running elsewhere
      if (!error || !error.includes('already running')) {
        setIsLinkingWithLog(false, 'manual request finished');
      }
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

    const handleSSEMessage = (data: any) => {
      if (data.type !== 'heartbeat' && data.type !== 'initial_data') {
      }

      // Escuchar eventos de Link Platforms
      if (data.type === 'linkPlatformsEvent') {
        switch (data.eventType) {
          case 'started':
            setIsLinkingWithLog(true, 'SSE started event');
            setError(null);
            break;

          case 'completed':
            setLastResult({
              success: true,
              message: data.message,
              result: data.result,
            });
            clearHiddenAccounts();

            if (data.result?.backgroundScan) {
            } else {
              setIsLinkingWithLog(false, 'SSE completed event');
            }
            break;

          case 'idle':
            // El servidor está indicando que Link Platforms no está corriendo
            setIsLinkingWithLog(false, 'SSE idle event');
            break;

          case 'error':
            setIsLinkingWithLog(false, 'SSE error event');
            setError(data.error || 'Link Platforms failed');
            setLastResult({
              success: false,
              message: data.message,
              result: data.result,
            });
            break;
        }
      }

      // Escuchar eventos de background scan (AFECTA spinner cuando cache se usa)
      if (data.type === 'backgroundScanEvent') {
        switch (data.eventType) {
          case 'completed':
            // Si había background scan, terminar el spinner ahora
            setIsLinkingWithLog(false, 'SSE background scan completed');

            // Limpiar cuentas ocultas cuando se complete el background scan
            clearHiddenAccounts();

            if (
              data.newInstallations &&
              (data.newInstallations.mql4 > 0 || data.newInstallations.mql5 > 0)
            ) {
            } else {
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
  }, [secretKey]);

  // Polling fallback: Check linking status every second when isLinking is true
  useEffect(() => {
    if (!isLinking || !secretKey) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await linkPlatformsService.getLinkingStatus(secretKey);

        if (!status.isLinking && isLinking) {
          setIsLinkingWithLog(false, 'polling detected completion');

          // Clear hidden accounts when linking finishes
          clearHiddenAccounts();
        }
      } catch (error) {
        // Don't change state on polling errors to avoid false negatives
      }
    }, 1000); // Poll every second

    return () => {
      clearInterval(pollInterval);
    };
  }, [isLinking, secretKey, setIsLinkingWithLog, clearHiddenAccounts]);

  return {
    linkPlatforms,
    isLinking,
    lastResult,
    error,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null),
  };
};
