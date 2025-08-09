import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { linkPlatformsService } from '../services/linkPlatformsService';
import type { LinkPlatformsResult } from '../services/linkPlatformsService';
import { SSEService } from '../services/sseService';

export const useLinkPlatforms = () => {
  const { secretKey } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [lastResult, setLastResult] = useState<LinkPlatformsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerIdRef = useRef<string | null>(null);

  const linkPlatforms = async () => {
    if (!secretKey) {
      setError('Authentication required');
      return;
    }

    setIsLinking(true);
    setError(null);

    try {
      console.log('🔗 Starting Link Platforms process...');
      
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
      setIsLinking(false);
    }
  };

  // SSE listener para eventos de Link Platforms
  useEffect(() => {
    if (!secretKey) return;

    console.log('🔗 Link Platforms: Setting up SSE listener...');

    // Conectar al SSE (solo creará conexión si no existe)
    SSEService.connect(secretKey);

    const handleSSEMessage = (data: any) => {
      if (data.type !== 'heartbeat' && data.type !== 'initial_data') {
        console.log('📨 Link Platforms SSE message:', data.type);
      }

      // Escuchar eventos de Link Platforms
      if (data.type === 'linkPlatformsEvent') {
        console.log('🔗 Link Platforms event received:', data.eventType, data.message);
        
        switch (data.eventType) {
          case 'started':
            setIsLinking(true);
            setError(null);
            console.log('🔄 Link Platforms started automatically by server');
            break;
            
          case 'completed':
            setIsLinking(false);
            setLastResult({
              success: true,
              message: data.message,
              result: data.result
            });
            console.log('✅ Link Platforms completed automatically by server');
            break;
            
          case 'error':
            setIsLinking(false);
            setError(data.error || 'Link Platforms failed');
            setLastResult({
              success: false,
              message: data.message,
              result: data.result
            });
            console.error('❌ Link Platforms failed automatically by server:', data.error);
            break;
        }
      }

      // Escuchar eventos de background scan (SOLO para logs, NO afecta spinner)
      if (data.type === 'backgroundScanEvent') {
        console.log('🔇 Background scan event received (silent):', data.eventType, data.message);
        
        switch (data.eventType) {
          case 'completed':
            if (data.newInstallations && (data.newInstallations.mql4 > 0 || data.newInstallations.mql5 > 0)) {
              console.log(`🆕 Background scan found new installations: ${data.newInstallations.mql4} MQL4 + ${data.newInstallations.mql5} MQL5`);
              console.log(`✅ Background scan synced ${data.newInstallations.synced} new bots silently`);
            } else {
              console.log('ℹ️ Background scan completed - no new installations found');
            }
            break;
            
          case 'error':
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
    clearResult: () => setLastResult(null)
  };
};
