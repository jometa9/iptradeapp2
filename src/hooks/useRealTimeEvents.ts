import { useCallback, useEffect, useRef, useState } from 'react';

interface SystemEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  id: string;
}

// Generar un clientId único
const generateClientId = () => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useRealTimeEvents = (onEvent?: (event: SystemEvent) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SystemEvent[]>([]);

  const clientIdRef = useRef<string>(generateClientId());
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
    } catch (error) {
      console.error('❌ Error desregistrando cliente:', error);
    }
  }, [baseUrl]);

  // Inicializar conexión
  useEffect(() => {
    registerClient();

    return () => {
      unregisterClient();
    };
  }, [registerClient, unregisterClient]);

  // Función para refrescar manualmente
  const refresh = useCallback(() => {
    // Los datos se actualizan automáticamente via SSE
  }, []);

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
