// CSV Unified Frontend Service - trabaja directamente con el CSV unificado

const API_BASE_URL = 'http://localhost:3000/api';

export interface UnifiedAccount {
  type: 'pending' | 'master' | 'slave';
  accountId: string;
  platform: string;
  status: 'online' | 'offline';
  config: any;
  masterId?: string;
  timestamp: Date;
  timeDiff?: number;
}

export interface AccountsResponse {
  masterAccounts: Record<string, any>;
  slaveAccounts: Record<string, any>;
  unconnectedSlaves: any[];
  pendingAccounts: any[];
}

class CSVUnifiedService {
  private eventSource: EventSource | null = null;

  // Obtener todas las cuentas
  async getAllAccounts(): Promise<AccountsResponse> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/all`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }

  // Obtener cuentas pending
  async getPendingAccounts(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/pending`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }

  // Convertir pending a master
  async convertToMaster(accountId: string, name?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/${accountId}/convert-to-master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Convertir pending a slave
  async convertToSlave(accountId: string, masterId: string, config?: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/${accountId}/convert-to-slave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterId, config }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Actualizar configuración de master
  async updateMasterConfig(
    accountId: string,
    config: { enabled?: boolean; name?: string }
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/master/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Actualizar configuración de slave
  async updateSlaveConfig(accountId: string, config: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/slave/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Eliminar cuenta
  async deleteAccount(accountId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/accounts/${accountId}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Obtener estado del copier
  async getCopierStatus(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/csv/copier/status`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }

  // Actualizar estado global
  async updateGlobalCopierStatus(enabled: boolean): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/copier/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Emergency shutdown
  async emergencyShutdown(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/copier/emergency-shutdown`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Reset all to ON
  async resetAllToOn(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/csv/copier/reset-all-on`, {
      method: 'POST',
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  // Obtener configuración de slave
  async getSlaveConfig(accountId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/csv/slave-config/${accountId}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }

  // Obtener estadísticas
  async getStatistics(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/csv/statistics`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }

  // Suscribirse a actualizaciones en tiempo real
  subscribeToUpdates(onUpdate: (data: any) => void): () => void {
    // Cerrar conexión existente si hay una
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Crear nueva conexión SSE
    this.eventSource = new EventSource(`${API_BASE_URL}/events/stream`);

    this.eventSource.addEventListener('csvUpdate', event => {
      const data = JSON.parse(event.data);
      onUpdate(data);
    });

    this.eventSource.addEventListener('accountsUpdate', event => {
      const data = JSON.parse(event.data);
      onUpdate(data);
    });

    this.eventSource.onerror = error => {
      // Silent error handling
    };

    // Retornar función de limpieza
    return () => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };
  }
}

export default new CSVUnifiedService();
