# Implementación: Monitoreo de Actividad para Cuentas Pendientes

## Resumen de la Implementación

Se ha implementado exitosamente un sistema de monitoreo de actividad para las cuentas pendientes que detecta automáticamente cuando un EA se desconecta y lo marca como offline, pero lo reactiva cuando vuelve a conectarse.

## Funcionalidades Implementadas

### ✅ Detección Automática de Desconexión
- **Intervalo de monitoreo**: 5 segundos (`ACTIVITY_TIMEOUT = 5000ms`)
- **Detección automática**: Las cuentas se marcan como `offline` después de 5 segundos sin actividad
- **Monitoreo continuo**: El sistema verifica la actividad cada segundo

### ✅ Reactivación Automática
- **Detección de reconexión**: Cuando una cuenta offline vuelve a enviar pings, se reactiva automáticamente
- **Cambio de status**: De `offline` a `pending` cuando vuelve a estar activa
- **Sin intervención manual**: El proceso es completamente automático

### ✅ Interfaz de Usuario Actualizada
- **Botones condicionales**: Solo se muestran los botones "Make Master" y "Make Slave" cuando la cuenta está online
- **Indicador de offline**: Se muestra un badge "Offline" y solo el botón "Delete" cuando la cuenta está offline
- **Actualización en tiempo real**: El frontend se actualiza cada segundo para reflejar cambios de status

## Arquitectura del Sistema

### Backend (Node.js)

#### 1. Monitoreo de Actividad (`accountsController.js`)
```javascript
const ACTIVITY_TIMEOUT = 5000; // 5 segundos

const checkAccountActivity = () => {
  // Verifica todas las cuentas cada segundo
  // Marca como offline después de 5 segundos de inactividad
  // Reactiva automáticamente cuando vuelve a estar activa
};
```

#### 2. Actualización de Actividad (`roleAuth.js`)
```javascript
const updateAccountActivity = (accountId, accountType, apiKey) => {
  // Actualiza lastActivity cada vez que el EA hace una solicitud
  // Se ejecuta automáticamente en el middleware authenticateAccount
};
```

#### 3. Endpoint de Ping (`accountsController.js`)
```javascript
export const pingAccount = (req, res) => {
  // Endpoint que los EA usan para mantener la conexión activa
  // Actualiza automáticamente lastActivity a través del middleware
};
```

### Frontend (React/TypeScript)

#### 1. Renderizado Condicional (`PendingAccountsManager.tsx`)
```typescript
{account.status === 'offline' ? (
  // Mostrar solo badge "Offline" y botón "Delete"
  <>
    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
      <XCircle className="h-3 w-3 mr-1" />
      Offline
    </Badge>
    <Button onClick={() => openDeleteConfirmation(id)}>
      <XCircle className="h-4 w-4 mr-1" />
      Delete
    </Button>
  </>
) : (
  // Mostrar botones normales para cuentas online
  <>
    <Button onClick={() => openConversionForm(account, 'master')}>
      Make Master
    </Button>
    <Button onClick={() => openConversionForm(account, 'slave')}>
      Make Slave
    </Button>
    <Button onClick={() => openDeleteConfirmation(id)}>
      Delete
    </Button>
  </>
)}
```

#### 2. Polling Automático
```typescript
// Actualización cada segundo para detectar cambios rápidamente
const interval = setInterval(() => {
  if (isAuthenticated && secretKey) {
    loadPendingAccounts();
    loadAccountStats();
  }
}, 1000);
```

## Flujo de Funcionamiento

### 1. EA Se Conecta
```
EA → POST /accounts/ping → Middleware actualiza lastActivity → Status: pending
```

### 2. EA Se Desconecta
```
EA deja de enviar pings → Sistema detecta inactividad después de 5s → Status: offline
```

### 3. EA Se Reconecta
```
EA → POST /accounts/ping → Middleware actualiza lastActivity → Status: pending (reactivado)
```

### 4. Interfaz de Usuario
```
Status: pending → Muestra botones "Make Master", "Make Slave", "Delete"
Status: offline → Muestra badge "Offline" y solo botón "Delete"
```

## Configuración del Sistema

### Variables de Configuración
```javascript
const ACTIVITY_TIMEOUT = 5000; // 5 segundos en milisegundos
const MONITORING_INTERVAL = 1000; // Verificar cada segundo
const PING_INTERVAL = 2000; // EA debe ping cada 2 segundos (recomendado)
```

### Intervals del Sistema
- **Monitoreo del servidor**: Cada 1 segundo
- **Timeout de actividad**: 5 segundos
- **Polling del frontend**: Cada 1 segundo
- **Ping recomendado para EA**: Cada 2 segundos

## Casos de Uso

### ✅ Caso 1: EA Normal
- EA se conecta y envía pings regularmente
- Cuenta se mantiene como `pending` con botones disponibles
- Usuario puede convertir a master o slave

### ✅ Caso 2: EA Se Desconecta
- EA deja de enviar pings
- Después de 5 segundos, cuenta se marca como `offline`
- Solo se muestra badge "Offline" y botón "Delete"
- No se pueden hacer conversiones hasta que vuelva a estar online

### ✅ Caso 3: EA Se Reconecta
- EA vuelve a enviar pings
- Cuenta se reactiva automáticamente a `pending`
- Botones de conversión vuelven a estar disponibles
- Proceso transparente para el usuario

### ✅ Caso 4: EA Intermitente
- EA se conecta y desconecta varias veces
- Sistema maneja automáticamente los cambios de status
- Interfaz se actualiza en tiempo real
- No se requieren acciones manuales

## Beneficios de la Implementación

### 🔄 Automatización Completa
- No requiere intervención manual del administrador
- Detecta automáticamente desconexiones y reconexiones
- Mantiene el sistema actualizado en tiempo real

### 🎯 Experiencia de Usuario Mejorada
- Interfaz clara que indica el estado real de las cuentas
- Botones disponibles solo cuando es apropiado
- Feedback visual inmediato sobre el estado de conexión

### ⚡ Rendimiento Optimizado
- Polling eficiente (1 segundo)
- Detección rápida de cambios (5 segundos)
- Actualizaciones en tiempo real sin recargas

### 🛡️ Robustez del Sistema
- Manejo automático de reconexiones
- No se pierden cuentas por desconexiones temporales
- Sistema tolerante a fallos de red

## Compatibilidad con EA

### Endpoints que los EA Deben Usar
```http
POST /api/accounts/ping
Headers:
  x-account-id: {accountId}
  x-api-key: IPTRADE_APIKEY
  Content-Type: application/json
Body:
  {
    "status": "online",
    "lastActivity": "2024-01-01T12:00:00Z"
  }
```

### Comportamiento Esperado del EA
- **Ping regular**: Cada 2-5 segundos
- **Manejo de errores**: Reintentar en caso de fallo de red
- **Reconexión automática**: Volver a enviar pings cuando se restablezca la conexión
- **Logging**: Registrar el estado de conexión para debugging

## Pruebas Realizadas

### ✅ Prueba de Desconexión
- EA simulado se desconecta después de 3 pings
- Sistema detecta inactividad después de 5 segundos
- Cuenta marcada como `offline` correctamente

### ✅ Prueba de Reconexión
- EA simulado se reconecta después de estar offline
- Sistema reactiva automáticamente la cuenta
- Status cambia de `offline` a `pending`

### ✅ Prueba de Interfaz
- Botones se ocultan/muestran según el status
- Badge "Offline" aparece cuando corresponde
- Actualizaciones en tiempo real funcionan correctamente

## Conclusión

La implementación cumple completamente con los requisitos especificados:

1. ✅ **Detección automática**: Las cuentas se marcan como offline después de 5 segundos sin actividad
2. ✅ **Reactivación automática**: Las cuentas offline se reactivan cuando vuelven a enviar pings
3. ✅ **Interfaz actualizada**: Solo se muestran botones apropiados según el estado de la cuenta
4. ✅ **Tiempo real**: El sistema se actualiza cada segundo para reflejar cambios inmediatamente

El sistema está listo para producción y maneja correctamente todos los casos de uso de los EA según la documentación en `EA_API_ENDPOINTS.md`.
