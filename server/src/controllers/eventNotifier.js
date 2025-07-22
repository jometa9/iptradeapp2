import { EventEmitter } from 'events';

// Event emitter global para notificaciones del sistema
const systemEvents = new EventEmitter();

// Tipos de eventos
export const EVENT_TYPES = {
  ACCOUNT_CONVERTED: 'account_converted',
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_DELETED: 'account_deleted',
  ACCOUNT_STATUS_CHANGED: 'account_status_changed',
  COPIER_STATUS_CHANGED: 'copier_status_changed',
  TRADING_CONFIG_CREATED: 'trading_config_created',
};

// Cola de eventos para clientes conectados
const clientEventQueues = new Map();

// Registrar un cliente para recibir eventos
export const registerClient = clientId => {
  if (!clientEventQueues.has(clientId)) {
    clientEventQueues.set(clientId, []);
    console.log(`📡 Cliente ${clientId} registrado para eventos`);
  }
};

// Desregistrar un cliente
export const unregisterClient = clientId => {
  clientEventQueues.delete(clientId);
  console.log(`📡 Cliente ${clientId} desregistrado de eventos`);
};

// Emitir un evento a todos los clientes registrados
export const emitEvent = (eventType, data) => {
  const event = {
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
    id: Date.now().toString(),
  };

  console.log(`📢 Evento emitido: ${eventType}`, data);

  // Agregar evento a la cola de todos los clientes
  for (const [clientId, eventQueue] of clientEventQueues.entries()) {
    eventQueue.push(event);

    // Mantener solo los últimos 50 eventos por cliente
    if (eventQueue.length > 50) {
      eventQueue.shift();
    }
  }

  // También emitir al EventEmitter para listeners internos
  systemEvents.emit(eventType, data);
};

// Obtener eventos pendientes para un cliente
export const getClientEvents = (clientId, lastEventId = null) => {
  const eventQueue = clientEventQueues.get(clientId) || [];

  if (!lastEventId) {
    return eventQueue;
  }

  // Encontrar eventos después del lastEventId
  const lastEventIndex = eventQueue.findIndex(event => event.id === lastEventId);
  if (lastEventIndex === -1) {
    return eventQueue; // Si no encontramos el evento, devolver todos
  }

  return eventQueue.slice(lastEventIndex + 1);
};

// Limpiar eventos antiguos (ejecutar periódicamente)
export const cleanupOldEvents = () => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutos

  for (const [clientId, eventQueue] of clientEventQueues.entries()) {
    const validEvents = eventQueue.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return now - eventTime < maxAge;
    });

    clientEventQueues.set(clientId, validEvents);
  }
};

// Limpiar eventos antiguos cada minuto
setInterval(cleanupOldEvents, 60000);

// Event emitter para uso interno
export { systemEvents };

// Funciones de conveniencia para eventos específicos
export const notifyAccountConverted = (accountId, fromType, toType, apiKey) => {
  emitEvent(EVENT_TYPES.ACCOUNT_CONVERTED, {
    accountId,
    fromType,
    toType,
    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
  });
};

export const notifyAccountCreated = (accountId, accountType, apiKey) => {
  emitEvent(EVENT_TYPES.ACCOUNT_CREATED, {
    accountId,
    accountType,
    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
  });
};

export const notifyAccountDeleted = (accountId, accountType, apiKey) => {
  emitEvent(EVENT_TYPES.ACCOUNT_DELETED, {
    accountId,
    accountType,
    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
  });
};

export const notifyAccountStatusChanged = (accountId, newStatus, apiKey) => {
  emitEvent(EVENT_TYPES.ACCOUNT_STATUS_CHANGED, {
    accountId,
    newStatus,
    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
  });
};

export const notifyCopierStatusChanged = (accountId, enabled, apiKey) => {
  emitEvent(EVENT_TYPES.COPIER_STATUS_CHANGED, {
    accountId,
    enabled,
    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'unknown',
  });
};

export const notifyTradingConfigCreated = (accountId, config) => {
  emitEvent(EVENT_TYPES.TRADING_CONFIG_CREATED, {
    accountId,
    config,
  });
};
