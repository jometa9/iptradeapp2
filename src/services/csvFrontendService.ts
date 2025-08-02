import { EventEmitter } from 'events';

interface CSVData {
  timestamp: string;
  account_id: string;
  account_type: string;
  status: string;
  action: string;
  data: string;
  master_id: string;
  platform: string;
}

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

class CSVFrontendService extends EventEmitter {
  private csvFiles: Map<string, CSVData[]> = new Map();
  private eventSource: EventSource | null = null;
  private isConnected = false;
  private apiKey: string | null = null;

  private getApiKey(): string {
    // Obtener API key del localStorage o context
    return this.apiKey || localStorage.getItem('secretKey') || '';
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  constructor() {
    super();
    this.init();
  }

  private async init() {
    // Usar Server-Sent Events para file watching real
    this.startEventSource();
  }

  private startEventSource() {
    const eventSource = new EventSource('/api/csv/events');

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        this.processCSVData(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('SSE connection error:', error);
      // Reconnect after 5 seconds
      setTimeout(() => {
        this.startEventSource();
      }, 5000);
    };

    // Store the event source for cleanup
    this.eventSource = eventSource;
  }

  private async scanCSVFiles() {
    try {
      // En el frontend, simulamos la lectura de CSV
      // En una implementación real, esto sería una API que lee los archivos
      const response = await fetch('/api/csv/scan');
      if (response.ok) {
        const data = await response.json();
        this.processCSVData(data);
      }
    } catch (error) {
      console.error('Error scanning CSV files:', error);
    }
  }

  private processCSVData(data: any) {
    switch (data.type) {
      case 'csv_updated':
        // Archivo CSV actualizado
        this.emit('csvUpdated', data);
        break;

      case 'initial_data':
        // Datos iniciales
        this.emit('initialData', data);
        break;

      case 'heartbeat':
        // Heartbeat para mantener conexión
        this.emit('heartbeat', data);
        break;

      default:
        // Otros tipos de datos
        this.emit('dataUpdated', data);
    }
  }

  // Métodos públicos para el frontend
  public async getCopierStatus(): Promise<CopierStatus> {
    try {
      const response = await fetch('/api/csv/copier/status', {
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
      const response = await fetch('/api/csv/accounts/all', {
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
      await fetch('/api/csv/copier/global', {
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
      await fetch('/api/csv/copier/master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ masterAccountId: masterId, enabled }),
      });
    } catch (error) {
      console.error('Error updating master status:', error);
    }
  }

  public async updateSlaveConfig(slaveId: string, enabled: boolean): Promise<void> {
    try {
      await fetch('/api/csv/slave-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slaveAccountId: slaveId, enabled }),
      });
    } catch (error) {
      console.error('Error updating slave config:', error);
    }
  }

  public async emergencyShutdown(): Promise<void> {
    try {
      await fetch('/api/csv/copier/emergency-shutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error executing emergency shutdown:', error);
    }
  }

  public async resetAllToOn(): Promise<void> {
    try {
      await fetch('/api/csv/copier/reset-all-on', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error resetting all to ON:', error);
    }
  }

  public async scanCSVFiles(): Promise<void> {
    try {
      await fetch('/api/csv/scan', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error scanning CSV files:', error);
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
    this.isConnected = false;
  }
}

export default new CSVFrontendService();
