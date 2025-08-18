// import { EventEmitter } from 'events';

// Simple EventEmitter implementation for browser
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event: string, data?: any) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  removeAllListeners() {
    this.events = {};
  }
}

// CSVData interface moved to useCSVData hook

interface CopierStatus {
  globalStatus: boolean;
  globalStatusText: string;
  masterAccounts: Record<string, any>;
  totalMasterAccounts: number;
}

interface AccountsData {
  masterAccounts: Record<string, any>;
  unconnectedSlaves: Array<any>;
}

class CSVFrontendService extends SimpleEventEmitter {
  private eventSource: EventSource | null = null;
  private apiKey: string | null = null;
  private serverPort: string;

  private getApiKey(): string {
    // Obtener API key del localStorage o context
    return this.apiKey || localStorage.getItem('secretKey') || '';
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  constructor() {
    super();
    // Configurar puerto del servidor
    this.serverPort = import.meta.env.VITE_SERVER_PORT || '30';
    this.init();
  }

  private async init() {
    // Usar Server-Sent Events para file watching real
    this.startEventSource();
  }

  private startEventSource() {
    console.log('🚫 CSVFrontendService: EventSource DISABLED - using unified SSE instead');
    return; // DISABLED - ahora usamos SSEService unificado

    const eventSource = new EventSource(
      `http://localhost:${this.serverPort}/api/csv/events/frontend`
    );

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        this.processCSVData(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('EventSource error:', error);
      // Reintentar conexión después de un delay
      setTimeout(() => {
        if (this.eventSource) {
          this.startEventSource();
        }
      }, 5000);
    };

    this.eventSource = eventSource;
  }

  private processCSVData(data: any) {
    console.log('📥 Processing CSV data:', data);

    // Siempre emitir dataUpdated para mantener todo sincronizado
    this.emit('dataUpdated', data);

    switch (data.type) {
      case 'csv_updated':
        // Archivo CSV actualizado
        console.log('📄 CSV file updated:', data);
        this.emit('csvUpdated', data);

        // Forzar actualización inmediata
        this.refreshCSVData();
        break;

      case 'initial_data':
        console.log('🔰 Initial data received:', data);
        this.emit('initialData', data);
        break;

      case 'heartbeat':
        // Solo log si hay cambios importantes
        if (data.changes) {
          console.log('💓 Heartbeat with changes:', data.changes);
        }
        this.emit('heartbeat', data);
        break;

      case 'accountDeleted':
        console.log('🗑️ Account deleted:', data);
        this.emit('accountDeleted', data);

        // Forzar actualización inmediata
        this.refreshCSVData();
        break;

      case 'accountConverted':
        console.log('🔄 Account converted:', data);
        this.emit('accountConverted', data);

        // Forzar actualización inmediata de CSV y estado
        this.refreshCSVData();

        // Notificar a todos los componentes
        window.dispatchEvent(
          new CustomEvent('accountConverted', {
            detail: {
              accountId: data.accountId,
              newType: data.newType,
              platform: data.platform,
              status: data.status || 'online',
              timestamp: new Date().toISOString(),
            },
          })
        );

        // También emitir un evento general de actualización
        window.dispatchEvent(new CustomEvent('csvDataUpdated'));
        break;

      default:
        console.log('ℹ️ Unhandled event:', data);
        break;
    }
  }

  // Método para forzar actualización inmediata
  private async refreshCSVData() {
    try {
      const [copierStatus, accounts] = await Promise.all([
        this.getCopierStatus(),
        this.getAllAccounts(),
      ]);

      this.emit('csvUpdated', { copierStatus, accounts });
      this.emit('dataUpdated', { copierStatus, accounts });

      // Notificar a todos los componentes
      window.dispatchEvent(
        new CustomEvent('csvDataUpdated', {
          detail: { copierStatus, accounts },
        })
      );
    } catch (error) {
      console.error('Error refreshing CSV data:', error);
    }
  }

  // Métodos públicos para el frontend
  public async getCopierStatus(): Promise<CopierStatus> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/csv/copier/status`, {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting copier status:', error);
    }
    return {
      globalStatus: false,
      globalStatusText: 'OFF',
      masterAccounts: {},
      totalMasterAccounts: 0,
    };
  }

  public async getAllAccounts(): Promise<AccountsData> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/accounts/all`, {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting accounts:', error);
    }
    return {
      masterAccounts: {},
      unconnectedSlaves: [],
    };
  }

  public async updateGlobalStatus(enabled: boolean): Promise<void> {
    try {
      await fetch(`http://localhost:${this.serverPort}/api/csv/copier/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
        body: JSON.stringify({ enabled }),
      });
    } catch (error) {
      console.error('Error updating global status:', error);
    }
  }

  public async updateMasterStatus(masterId: string, enabled: boolean): Promise<void> {
    try {
      await fetch(`http://localhost:${this.serverPort}/api/csv/copier/master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
        body: JSON.stringify({ masterId, enabled }),
      });
    } catch (error) {
      console.error('Error updating master status:', error);
    }
  }

  public async updateSlaveConfig(slaveId: string, enabled: boolean): Promise<void> {
    try {
      await fetch(`http://localhost:${this.serverPort}/api/csv/slave-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
        body: JSON.stringify({ slaveId, enabled }),
      });
    } catch (error) {
      console.error('Error updating slave config:', error);
    }
  }

  public async emergencyShutdown(): Promise<void> {
    try {
      await fetch(`http://localhost:${this.serverPort}/api/csv/copier/emergency-shutdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
      });
    } catch (error) {
      console.error('Error emergency shutdown:', error);
    }
  }

  public async resetAllToOn(): Promise<void> {
    try {
      await fetch(`http://localhost:${this.serverPort}/api/csv/copier/reset-all-on`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
      });
    } catch (error) {
      console.error('Error reset all to on:', error);
    }
  }

  public async scanCSVFiles(): Promise<void> {
    try {
      // En el frontend, simulamos la lectura de CSV
      // En una implementación real, esto sería una API que lee los archivos
      const response = await fetch(`http://localhost:${this.serverPort}/api/csv/scan`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        this.processCSVData(data);
      }
    } catch (error) {
      console.error('Error scanning CSV files:', error);
    }
  }

  public async refreshCSVData(): Promise<void> {
    try {
      // Solo refrescar datos existentes, no hacer búsqueda completa
      const response = await fetch(`http://localhost:${this.serverPort}/api/csv/refresh`, {
        method: 'POST',
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });
      if (response.ok) {
        const data = await response.json();
        this.processCSVData(data);
      }
    } catch (error) {
      console.error('Error refreshing CSV data:', error);
    }
  }

  // Eventos que emite el servicio
  public onDataUpdate(callback: (data: any) => void) {
    this.on('dataUpdated', callback);
  }

  public onCopierStatusChange(callback: (status: CopierStatus) => void) {
    this.on('copierStatusChanged', callback);
  }

  public onAccountsUpdate(callback: (accounts: AccountsData) => void) {
    this.on('accountsUpdated', callback);
  }

  public disconnect() {
    this.removeAllListeners();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    // this.isConnected = false; // This line was removed as per the new_code
  }
}

export default new CSVFrontendService();
