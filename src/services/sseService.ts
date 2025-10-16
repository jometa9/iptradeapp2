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

    const serverPort = import.meta.env.VITE_SERVER_PORT || '7777';
    const baseUrl = import.meta.env.VITE_SERVER_URL || `http://localhost:${serverPort}`;
    const sseUrl = `${baseUrl}/api/csv/events?apiKey=${secretKey}`;

    globalEventSource = new EventSource(sseUrl);

    globalEventSource.onopen = () => {};

    globalEventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // Notify all listeners
        globalListeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            // Silent error handling
          }
        });
      } catch (error) {
        // Silent error handling
      }
    };

    globalEventSource.onerror = error => {
      // Silent error handling
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
