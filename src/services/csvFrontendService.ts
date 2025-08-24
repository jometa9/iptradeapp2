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

interface GlobalStats {
  slaves: number;
  masters: number;
  pendings: number;
  offline: number;
  total: number;
  timestamp: string;
  message: string;
}

interface AccountsData {
  masterAccounts: Record<string, any>;
  unconnectedSlaves: Array<any>;
  globalStats?: {
    slaves: number;
    masters: number;
    pendings: number;
    offline: number;
    total: number;
    timestamp: string;
    message: string;
  };
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

  private async processCSVData(data: any) {
    // Siempre emitir dataUpdated para mantener todo sincronizado
    this.emit('dataUpdated', data);

    switch (data.type) {
      case 'csv_updated':
        // Archivo CSV actualizado
        this.emit('csvUpdated', data);

        // Forzar actualización inmediata
        await this.refreshCSVData();
        break;

      case 'initial_data':
        this.emit('initialData', data);
        break;

      case 'heartbeat':
        // Solo log si hay cambios importantes

        this.emit('heartbeat', data);
        break;

      case 'accountDeleted':
        this.emit('accountDeleted', data);

        // Forzar actualización inmediata
        await this.refreshCSVData();
        break;

      case 'accountConverted':
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
        break;
    }
  }

  // Convertir una cuenta a pending
  public async convertToPending(accountId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.serverPort}/api/csv/convert-to-pending/${accountId}`,
        {
          method: 'POST',
          headers: {
            'x-api-key': this.getApiKey(),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Procesar la respuesta y emitir eventos
        this.processCSVData(data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error converting account to pending:', error);
      return false;
    }
  }

  // Borrar una master account (desconecta slaves y convierte a pending)
  public async deleteMasterAccount(masterAccountId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.serverPort}/api/accounts/master/${masterAccountId}`,
        {
          method: 'DELETE',
          headers: {
            'x-api-key': this.getApiKey(),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Procesar la respuesta y emitir eventos
        this.processCSVData(data);
        return true;
      }

      console.error(`❌ Failed to delete master account ${masterAccountId}:`, response.status);
      return false;
    } catch (error) {
      console.error('Error deleting master account:', error);
      return false;
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
        const data = await response.json();
        // Extraer los datos del formato de respuesta del servidor
        return data.data || data;
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
      console.log('🔄 [csvFrontendService] Getting all accounts...');
      // Usar el endpoint correcto que lee las cuentas del sistema
      const response = await fetch(`http://localhost:${this.serverPort}/api/accounts/all`, {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📊 [csvFrontendService] Raw response:', data);
        // Extraer los datos del formato de respuesta del servidor
        const result = data.data || data;
        console.log('📊 [csvFrontendService] Processed result:', {
          masterAccountsCount: result?.masterAccounts
            ? Object.keys(result.masterAccounts).length
            : 0,
          unconnectedSlavesCount: result?.unconnectedSlaves ? result.unconnectedSlaves.length : 0,
          totalPendingCount: result?.totalPendingAccounts || 0,
        });
        return result;
      } else {
        console.error(
          '❌ [csvFrontendService] Response not ok:',
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error('❌ [csvFrontendService] Error getting accounts:', error);
    }
    return {
      masterAccounts: {},
      unconnectedSlaves: [],
    };
  }

  public async updateGlobalStatus(enabled: boolean): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/csv/copier/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update global status');
      }

      const data = await response.json();

      // Obtener datos actualizados de copier y accounts
      const [copierStatus, accounts] = await Promise.all([
        this.getCopierStatus(),
        this.getAllAccounts(),
      ]);

      // Emitir eventos con los datos actualizados
      this.emit('csvUpdated', { copierStatus, accounts });
      this.emit('dataUpdated', { copierStatus, accounts });

      // Notificar a todos los componentes
      window.dispatchEvent(
        new CustomEvent('csvDataUpdated', {
          detail: { copierStatus, accounts },
        })
      );
    } catch (error) {
      console.error('❌ Error updating global status:', error);
      throw error;
    }
  }

  public async updateMasterStatus(masterId: string, enabled: boolean): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/csv/copier/master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
        body: JSON.stringify({ masterAccountId: masterId, enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update master status');
      }
    } catch (error) {
      console.error('Error updating master status:', error);
      throw error;
    }
  }

  public async updateSlaveConfig(slaveId: string, enabled: boolean): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/slave-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.getApiKey(),
        },
        body: JSON.stringify({ slaveAccountId: slaveId, enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update slave config');
      }
    } catch (error) {
      console.error('Error updating slave config:', error);
      throw error;
    }
  }

  public async updateAccountStatus(accountId: string, enabled: boolean): Promise<void> {
    try {
      const response = await fetch(
        `http://localhost:${this.serverPort}/api/csv/account/${accountId}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.getApiKey(),
          },
          body: JSON.stringify({ enabled }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account status');
      }

      // Obtener datos actualizados de copier y accounts
      const [copierStatus, accounts] = await Promise.all([
        this.getCopierStatus(),
        this.getAllAccounts(),
      ]);

      // Emitir eventos con los datos actualizados
      this.emit('csvUpdated', { copierStatus, accounts });
      this.emit('dataUpdated', { copierStatus, accounts });

      // Notificar a todos los componentes
      window.dispatchEvent(
        new CustomEvent('csvDataUpdated', {
          detail: { copierStatus, accounts },
        })
      );
    } catch (error) {
      console.error('Error updating account status:', error);
      throw error;
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

  public async getGlobalStats(): Promise<GlobalStats> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/copier/stats`, {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting global stats:', error);
    }

    return {
      slaves: 0,
      masters: 0,
      pendings: 0,
      offline: 0,
      total: 0,
      timestamp: new Date().toISOString(),
      message: 'Failed to load global stats',
    };
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
      // Primero, obtener datos actualizados del servidor
      const response = await fetch(`http://localhost:${this.serverPort}/api/csv/refresh`, {
        method: 'POST',
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Procesar la respuesta del servidor
        this.processCSVData(data);

        // Obtener datos actualizados de copier y accounts
        const [copierStatus, accounts] = await Promise.all([
          this.getCopierStatus(),
          this.getAllAccounts(),
        ]);

        // Emitir eventos con los datos actualizados
        this.emit('csvUpdated', { copierStatus, accounts });
        this.emit('dataUpdated', { copierStatus, accounts });

        // Notificar a todos los componentes
        window.dispatchEvent(
          new CustomEvent('csvDataUpdated', {
            detail: { copierStatus, accounts },
          })
        );
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
