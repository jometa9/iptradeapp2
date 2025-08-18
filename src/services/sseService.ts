// SOLUCIÓN SIMPLE: Una sola conexión SSE global
let globalEventSource: EventSource | null = null;
const globalListeners = new Map<string, (data: any) => void>();
let listenerCounter = 0;

export const SSEService = {
  connect(secretKey: string) {
    if (typeof window === 'undefined') return;

    // Si ya existe una conexión, no crear otra
    if (globalEventSource) {
      return;
    }

    const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
    const baseUrl = import.meta.env.VITE_SERVER_URL || `http://localhost:${serverPort}`;
    const sseUrl = `${baseUrl}/api/csv/events?apiKey=${secretKey}`;

    globalEventSource = new EventSource(sseUrl);

    globalEventSource.onopen = () => {};

    globalEventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // Log TODOS los mensajes para debugging completo

        globalListeners.forEach((callback, id) => {
          try {
            callback(data);
          } catch (error) {
            console.error(`❌ SSE: Error in listener ${id}:`, error);
          }
        });
      } catch (error) {
        console.error('❌ SSE: Error parsing message:', error);
        console.error('❌ SSE: Raw event data:', event.data);
      }
    };

    globalEventSource.onerror = error => {
      console.error('❌ SSE: Connection error:', error);
    };
  },

  addListener(callback: (data: any) => void): string {
    listenerCounter++;
    const id = `listener-${listenerCounter}`;
    globalListeners.set(id, callback);
    return id;
  },

  removeListener(id: string) {
    globalListeners.delete(id);

    // Si no hay más listeners, cerrar la conexión (solo en producción)
    if (globalListeners.size === 0 && globalEventSource) {
      if (import.meta.env.MODE !== 'development') {
        globalEventSource.close();
        globalEventSource = null;
      }
    }
  },

  isConnected(): boolean {
    return !!globalEventSource && globalEventSource.readyState === EventSource.OPEN;
  },
};
