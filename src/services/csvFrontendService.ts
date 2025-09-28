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

// CSVData interface moved to useUnifiedAccountData hook

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
        // Silent error handling
      }
    };

    eventSource.onerror = error => {
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
              status: data.status || 'active',
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

      return false;
    } catch (error) {
      return false;
    }
  }

  // Borrar una slave account (elimina de base de datos y convierte a pending en CSV)
  public async deleteSlaveAccount(slaveAccountId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.serverPort}/api/accounts/slave/${slaveAccountId}`,
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

      // Si es 404, significa que no está registrada como slave en la DB
      if (response.status === 404) {
        return false; // Permitir que el frontend use convertToPending como fallback
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // REMOVED: getCopierStatus() - Use getUnifiedAccountData() instead
  // Copier status is now included in the unified endpoint response

  // NEW: Unified endpoint that gets all data in one call
  public async getUnifiedAccountData(): Promise<any> {
    try {
      const response = await fetch(`http://localhost:${this.serverPort}/api/accounts/unified`, {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw error;
    }
  }

  // REMOVED: getAllAccounts() - Use getUnifiedAccountData() instead
  // Account data is now included in the unified endpoint response
  public async getAllAccounts(): Promise<AccountsData> {
    try {
      // Usar el endpoint correcto que lee las cuentas del sistema
      const response = await fetch(`http://localhost:${this.serverPort}/api/accounts/all`, {
        headers: {
          'x-api-key': this.getApiKey(),
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Extraer los datos del formato de respuesta del servidor
        const result = data.data || data;
        return result;
      } else {
        // Silent error handling
      }
    } catch (error) {
      // Silent error handling
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

      // Obtener datos actualizados usando el endpoint unificado
      const unifiedData = await this.getUnifiedAccountData();
      
      // Emitir eventos con los datos actualizados
      this.emit('csvUpdated', unifiedData);
      this.emit('dataUpdated', unifiedData);

      // Notificar a todos los componentes
      window.dispatchEvent(
        new CustomEvent('csvDataUpdated', {
          detail: unifiedData,
        })
      );
    } catch (error) {
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

      // Obtener datos actualizados usando el endpoint unificado
      const unifiedData = await this.getUnifiedAccountData();
      
      // Emitir eventos con los datos actualizados
      this.emit('csvUpdated', unifiedData);
      this.emit('dataUpdated', unifiedData);

      // Notificar a todos los componentes
      window.dispatchEvent(
        new CustomEvent('csvDataUpdated', {
          detail: unifiedData,
        })
      );
    } catch (error) {
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
      // Silent error handling
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
      // Silent error handling
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
      // Silent error handling
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
      // Silent error handling
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

        // Obtener datos actualizados usando el endpoint unificado
        const unifiedData = await this.getUnifiedAccountData();
        
        // Emitir eventos con los datos actualizados
        this.emit('csvUpdated', unifiedData);
        this.emit('dataUpdated', unifiedData);

        // Notificar a todos los componentes
        window.dispatchEvent(
          new CustomEvent('csvDataUpdated', {
            detail: unifiedData,
          })
        );
      }
    } catch (error) {
      // Silent error handling
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
