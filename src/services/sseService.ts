// SOLUCIÓN SIMPLE: Una sola conexión SSE global
let globalEventSource: EventSource | null = null;
const globalListeners = new Map<string, (data: any) => void>();
let listenerCounter = 0;

export const SSEService = {
  connect(secretKey: string) {
    if (typeof window === 'undefined') return;
    
    // Si ya existe una conexión, no crear otra
    if (globalEventSource) {
      console.log('♻️ SSE: Reusing existing global connection');
      return;
    }

    const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
    console.log('🔗 SSE: Creating SINGLE global connection...');
    
    globalEventSource = new EventSource(`${baseUrl}/api/csv/events?apiKey=${secretKey}`);

    globalEventSource.onopen = () => {
      console.log('✅ SSE: Global connection opened successfully');
    };

    globalEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Filtrar mensajes de heartbeat y initial_data de los logs
        if (data.type !== 'heartbeat' && data.type !== 'initial_data') {
          console.log('📡 SSE: Message received:', data.type);
        }
        
        // Notificar a todos los listeners
        globalListeners.forEach(callback => callback(data));
      } catch (error) {
        console.error('❌ SSE: Error parsing message:', error);
      }
    };

    globalEventSource.onerror = (error) => {
      console.error('❌ SSE: Connection error:', error);
    };
  },

  addListener(callback: (data: any) => void): string {
    listenerCounter++;
    const id = `listener-${listenerCounter}`;
    globalListeners.set(id, callback);
    console.log(`📡 SSE: Listener '${id}' added (Total: ${globalListeners.size})`);
    return id;
  },

  removeListener(id: string) {
    globalListeners.delete(id);
    console.log(`📡 SSE: Listener '${id}' removed (Remaining: ${globalListeners.size})`);
    
    // Si no hay más listeners, cerrar la conexión (solo en producción)
    if (globalListeners.size === 0 && globalEventSource) {
      if (import.meta.env.MODE === 'development') {
        console.log('⚠️ SSE: In development mode, keeping connection open');
      } else {
        console.log('🔌 SSE: Closing global connection (no more listeners)');
        globalEventSource.close();
        globalEventSource = null;
      }
    }
  },

  isConnected(): boolean {
    return !!globalEventSource && globalEventSource.readyState === EventSource.OPEN;
  }
};