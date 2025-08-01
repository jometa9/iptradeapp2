import { useCallback, useEffect, useRef, useState } from 'react';

interface SystemEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  id: string;
}

interface EventsResponse {
  events: SystemEvent[];
  hasEvents: boolean;
  clientId: string;
  status: string;
}

// Generar un clientId único
const generateClientId = () => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useRealTimeEvents = (onEvent?: (event: SystemEvent) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  const clientIdRef = useRef<string>(generateClientId());
  const pollingRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onEventRef = useRef(onEvent);

  const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
  const baseUrl = `http://localhost:${serverPort}/api`;

  // Update the ref when the callback changes
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Registrar cliente
  const registerClient = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl}/events/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientIdRef.current,
        }),
      });

      if (response.ok) {
        setIsConnected(true);
        console.log(`📡 Cliente ${clientIdRef.current} registrado para eventos`);
      }
    } catch (error) {
      console.error('❌ Error registrando cliente:', error);
    }
  }, [baseUrl]);

  // Desregistrar cliente
  const unregisterClient = useCallback(async () => {
    try {
      await fetch(`${baseUrl}/events/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientIdRef.current,
        }),
      });

      setIsConnected(false);
      console.log(`📡 Cliente ${clientIdRef.current} desregistrado`);
    } catch (error) {
      console.error('❌ Error desregistrando cliente:', error);
    }
  }, [baseUrl]);

  // Polling inmediato para eventos
  const pollForEvents = useCallback(async () => {
    if (!isConnected) return;

    try {
      const controller = new AbortController();
      pollingRef.current = controller;

      const url = new URL(`${baseUrl}/events/immediate`);
      url.searchParams.append('clientId', clientIdRef.current);
      if (lastEventId) {
        url.searchParams.append('lastEventId', lastEventId);
      }

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      if (response.ok) {
        const result: EventsResponse = await response.json();

        if (result.hasEvents && result.events.length > 0) {
          console.log(`📨 Recibidos ${result.events.length} eventos`);

          // Procesar cada evento
          for (const event of result.events) {
            setEvents(prev => [...prev, event]);
            setLastEventId(event.id);

            // Llamar al callback si está definido
            if (onEventRef.current) {
              onEventRef.current(event);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('❌ Error polling events:', error);
      }
    }
  }, [isConnected, lastEventId, baseUrl]);

  // Long polling mejorado
  const startLongPolling = useCallback(async () => {
    if (!isConnected) return;

    try {
      const controller = new AbortController();
      pollingRef.current = controller;

      const url = new URL(`${baseUrl}/events/poll`);
      url.searchParams.append('clientId', clientIdRef.current);
      url.searchParams.append('timeout', '15000'); // 15 segundos
      if (lastEventId) {
        url.searchParams.append('lastEventId', lastEventId);
      }

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      if (response.ok) {
        const result: EventsResponse = await response.json();

        if (result.hasEvents && result.events.length > 0) {
          console.log(`📨 Long poll - Recibidos ${result.events.length} eventos`);

          // Procesar eventos
          result.events.forEach(event => {
            if (onEventRef.current) {
              onEventRef.current(event);
            }
            setLastEventId(event.id);
          });

          setEvents(prev => [...prev, ...result.events]);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('❌ Error en long polling:', error);
      }
    } finally {
      pollingRef.current = null;

      // Reiniciar long polling después de un breve delay
      if (isConnected) {
        timeoutRef.current = setTimeout(startLongPolling, 1000);
      }
    }
  }, [baseUrl, isConnected, lastEventId]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      pollingRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Inicializar conexión
  useEffect(() => {
    registerClient();

    return () => {
      cleanup();
      unregisterClient();
    };
  }, [registerClient, unregisterClient, cleanup]);

  // Iniciar polling más frecuente
  useEffect(() => {
    if (!isConnected) return;

    // Polling inmediato al conectar
    pollForEvents();

    // Polling cada 200ms para eventos en tiempo real (más frecuente)
    const interval = setInterval(() => {
      pollForEvents();
    }, 200); // Reducido de 500ms a 200ms para mayor responsividad

    return () => {
      clearInterval(interval);
      if (pollingRef.current) {
        pollingRef.current.abort();
      }
    };
  }, [isConnected, pollForEvents]);

  // Función para refrescar manualmente
  const refresh = useCallback(() => {
    if (isConnected) {
      pollForEvents();
    }
  }, [isConnected, pollForEvents]);

  // Función para limpiar eventos
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    isConnected,
    events,
    refresh,
    clearEvents,
    clientId: clientIdRef.current,
  };
};
