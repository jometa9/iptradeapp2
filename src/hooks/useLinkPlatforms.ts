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
    console.log(`🔄 Changing isLinking: ${isLinking} → ${newValue} (${reason})`);
    setIsLinking(newValue);
  };

  // Check if Link Platforms is currently running on server
  const checkLinkingStatus = async () => {
    if (!secretKey) return;

    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const response = await fetch(`http://localhost:${serverPort}/api/link-platforms/status`, {
        headers: {
          'x-api-key': secretKey,
        },
      });

      if (response.ok) {
        const status = await response.json();
        console.log('🔍 Link Platforms status check:', status);

        if (status.isLinking) {
          console.log('🔄 Link Platforms is already running - activating spinner');
          setIsLinkingWithLog(true, 'server status check');
        }
      }
    } catch (error) {
      console.log('ℹ️ Could not check Link Platforms status (probably not running)');
    }
  };

  const linkPlatforms = async () => {
    if (!secretKey) {
      setError('Authentication required');
      return;
    }

    setIsLinkingWithLog(true, 'manual button click');
    setError(null);

    try {
      console.log('🔗 Starting Link Platforms process...');

      // Limpiar cuentas ocultas cuando se inicia Link Platforms manual
      console.log('🧹 Clearing hidden accounts due to manual Link Platforms initiation');
      clearHiddenAccounts();

      const result = await linkPlatformsService.linkPlatforms(secretKey);

      setLastResult(result);

      console.log('✅ Link Platforms completed:', result);

      if (result.result.errors.length > 0) {
        console.warn('⚠️ Link Platforms completed with errors:', result.result.errors);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Link Platforms failed';
      setError(errorMessage);
      console.error('❌ Link Platforms error:', err);
      throw err;
    } finally {
      setIsLinkingWithLog(false, 'manual request finished');
    }
  };

  // SSE listener para eventos de Link Platforms
  useEffect(() => {
    if (!secretKey) return;

    console.log('🔗 Link Platforms: Setting up SSE listener...');

    // Verificar estado inicial solo una vez
    if (!hasCheckedInitialStatus.current) {
      hasCheckedInitialStatus.current = true;
      checkLinkingStatus();
    }

    // Conectar al SSE (solo creará conexión si no existe)
    SSEService.connect(secretKey);

    const handleSSEMessage = (data: any) => {
      if (data.type !== 'heartbeat' && data.type !== 'initial_data') {
        console.log('📨 Link Platforms SSE message:', data.type, data);
      }

      // Escuchar eventos de Link Platforms
      if (data.type === 'linkPlatformsEvent') {
        console.log('🔗 Link Platforms event received:', data.eventType, data.message);
        console.log('🔍 Full event payload:', data);

        switch (data.eventType) {
          case 'started':
            console.log('🟢 STARTED event - activating spinner');
            setIsLinkingWithLog(true, 'SSE started event');
            setError(null);
            console.log('🔄 Link Platforms started - spinner activated');
            break;

          case 'completed':
            console.log('🟢 COMPLETED event received');
            setLastResult({
              success: true,
              message: data.message,
              result: data.result,
            });
            console.log('✅ Link Platforms completed by server');
            console.log('✅ Message:', data.message);
            console.log('✅ backgroundScan value:', data.result?.backgroundScan);
            console.log('✅ Full result data:', data.result);
            console.log('✅ Current isLinking state before decision:', isLinking);

            // Limpiar cuentas ocultas cuando se complete el proceso de link platforms
            console.log('🧹 Clearing hidden pending accounts after Link Platforms completion');
            clearHiddenAccounts();

            if (data.result?.backgroundScan) {
              console.log('🔄 Spinner continues - waiting for background scan completion...');
            } else {
              // Si no hay background scan, terminar spinner inmediatamente
              console.log('🛑 COMPLETED: Stopping spinner - no background scan needed');
              setIsLinkingWithLog(false, 'SSE completed event');
              console.log('✅ COMPLETED: Spinner stopped immediately');
            }
            break;

          case 'idle':
            // El servidor está indicando que Link Platforms no está corriendo
            setIsLinkingWithLog(false, 'SSE idle event');
            console.log('💤 Link Platforms is idle - ensuring spinner is stopped');
            break;

          case 'error':
            setIsLinkingWithLog(false, 'SSE error event');
            setError(data.error || 'Link Platforms failed');
            setLastResult({
              success: false,
              message: data.message,
              result: data.result,
            });
            console.error('❌ Link Platforms failed automatically by server:', data.error);
            break;
        }
      }

      // Escuchar eventos de background scan (AFECTA spinner cuando cache se usa)
      if (data.type === 'backgroundScanEvent') {
        console.log('🔇 Background scan event received:', data.eventType, data.message);
        console.log('🔄 Stopping spinner due to background scan completion');

        switch (data.eventType) {
          case 'completed':
            // Si había background scan, terminar el spinner ahora
            setIsLinkingWithLog(false, 'SSE background scan completed');
            console.log('✅ Spinner stopped - background scan completed');

            // Limpiar cuentas ocultas cuando se complete el background scan
            console.log('🧹 Clearing hidden pending accounts after background scan completion');
            clearHiddenAccounts();

            if (
              data.newInstallations &&
              (data.newInstallations.mql4 > 0 || data.newInstallations.mql5 > 0)
            ) {
              console.log(
                `🆕 Background scan found new installations: ${data.newInstallations.mql4} MQL4 + ${data.newInstallations.mql5} MQL5`
              );
              console.log(
                `✅ Background scan synced ${data.newInstallations.synced} new bots silently`
              );
            } else {
              console.log('ℹ️ Background scan completed - no new installations found');
            }
            break;

          case 'error':
            // Si el background scan falló, terminar el spinner
            setIsLinkingWithLog(false, 'SSE background scan error');
            console.error('❌ Background scan failed:', data.error);
            break;
        }
      }
    };

    // Agregar listener
    const listenerId = SSEService.addListener(handleSSEMessage);
    listenerIdRef.current = listenerId;

    return () => {
      if (listenerIdRef.current) {
        console.log('🔌 Link Platforms: Removing SSE listener');
        SSEService.removeListener(listenerIdRef.current);
      }
    };
  }, [secretKey]);

  return {
    linkPlatforms,
    isLinking,
    lastResult,
    error,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null),
  };
};
