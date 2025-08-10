# Nuevo Formato de CSV para Cuentas Pendientes

## Resumen

Se ha implementado un nuevo formato simplificado para archivos CSV de cuentas pendientes que utiliza el indicador `[0]` al inicio de cada línea para identificar cuentas que requieren configuración.

## Formato

### Estructura
```
[0][ACCOUNT_ID][PLATFORM][STATUS][TIMESTAMP]
```

### Ejemplo
```
0,250062001,MT4,PENDING,2024-01-15T10:30:00Z
0,250062002,MT5,PENDING,1754853060
0,250062003,CTRADER,PENDING,1754853120000
```

## Campos

| Posición | Campo | Descripción | Ejemplo |
|----------|-------|-------------|---------|
| 1 | `pending_indicator` | Siempre "0" para indicar cuenta pendiente | `0` |
| 2 | `account_id` | ID único de la cuenta | `250062001` |
| 3 | `platform` | Plataforma de trading | `MT4`, `MT5`, `CTRADER`, `TRADINGVIEW` |
| 4 | `status` | Estado de la cuenta (siempre "PENDING") | `PENDING` |
| 5 | `timestamp` | Timestamp de la última actividad (Unix o ISO 8601) | `1754853000` o `2024-01-15T10:30:00Z` |

## Ventajas del Nuevo Formato

### ✅ Simplicidad
- **Sin headers**: No requiere línea de encabezados
- **Formato fijo**: Estructura consistente y predecible
- **Fácil parsing**: Separación por comas simple

### ✅ Identificación Clara
- **Indicador visual**: El "0" al inicio identifica inmediatamente cuentas pendientes
- **Compatibilidad**: Funciona junto con el formato anterior
- **Escalabilidad**: Fácil de extender para futuros campos

### ✅ Detección de Estado
- **Online/Offline**: Se determina automáticamente basado en el timestamp
- **Tiempo real**: Actualización continua del estado de conectividad
- **Límite temporal**: Solo considera cuentas activas en la última hora

## Implementación Técnica

### Backend (Node.js)

#### 1. Detección de Formato
```javascript
// Verificar si el primer valor es "0" (indicador de pending)
if (values[0] === '0' && values.length >= 5) {
  // Procesar formato nuevo
}
```

#### 2. Parsing de Datos
```javascript
const account = {
  pending_indicator: lineValues[0], // "0"
  account_id: lineValues[1],
  platform: lineValues[2],
  status: lineValues[3],
  timestamp: lineValues[4],
  account_type: 'pending'
};
```

#### 3. Parsing de Timestamps
```javascript
// Función helper para parsear timestamp (Unix o ISO)
parseTimestamp(timestamp) {
  // Si es un número (Unix timestamp en segundos)
  if (!isNaN(timestamp) && timestamp.toString().length === 10) {
    return new Date(parseInt(timestamp) * 1000);
  }
  // Si es un número más largo (Unix timestamp en milisegundos)
  if (!isNaN(timestamp) && timestamp.toString().length === 13) {
    return new Date(parseInt(timestamp));
  }
  // Si es string ISO o cualquier otro formato
  return new Date(timestamp);
}
```

#### 4. Determinación de Estado
```javascript
const accountTime = this.parseTimestamp(account.timestamp);
const timeDiff = (currentTime - accountTime) / 1000;
account.current_status = timeDiff <= 5 ? 'online' : 'offline';
```

### Frontend (React)

#### 1. Interfaz de Usuario
- **Badges de estado**: Verde para online, rojo para offline
- **Información de tiempo**: Muestra cuánto tiempo hace desde la última actividad
- **Botones condicionales**: Solo disponibles para cuentas online

#### 2. Actualización en Tiempo Real
- **SSE**: Server-Sent Events para actualizaciones automáticas
- **Polling inteligente**: Solo cuando hay cambios
- **Estado reactivo**: UI se actualiza automáticamente

## Soporte de Timestamps

### Formatos Soportados
El sistema soporta múltiples formatos de timestamp:

1. **Unix Timestamp (10 dígitos)**: Segundos desde epoch
   ```
   1754853000 → 2025-08-10T19:03:20.000Z
   ```

2. **Unix Timestamp (13 dígitos)**: Milisegundos desde epoch
   ```
   1754853060000 → 2025-08-10T19:04:20.000Z
   ```

3. **ISO 8601**: Formato estándar de fecha/hora
   ```
   2024-01-15T10:30:00Z
   ```

### Detección Automática
El sistema detecta automáticamente el formato del timestamp:
- **10 dígitos**: Unix timestamp en segundos
- **13 dígitos**: Unix timestamp en milisegundos
- **String**: ISO 8601 u otro formato de fecha

## Compatibilidad

### Formato Anterior
El sistema mantiene compatibilidad con el formato anterior:
```
timestamp,account_id,account_type,platform
2024-01-15T10:30:00Z,12345,pending,MT4
```

### Detección Automática
El sistema detecta automáticamente qué formato usar:
1. **Nuevo formato**: Si la primera línea de datos empieza con "0"
2. **Formato anterior**: Si tiene headers estándar
3. **Fallback**: Procesa ambos formatos simultáneamente

## Herramientas de Desarrollo

### Generador de Datos de Prueba
```bash
node scripts/generate-new-pending-format.cjs
```

### Script de Prueba
```bash
node scripts/test-new-pending-format.cjs
```

### Script de Prueba de Timestamps Unix
```bash
node scripts/test-unix-timestamp.cjs
```

### Archivos de Ejemplo
- `csv_data/pending_accounts_example.csv`: Ejemplo básico
- `csv_data/IPTRADECSV2.csv`: Archivo principal del sistema

## Monitoreo y Logs

### Logs del Sistema
```
📄 Processing simplified pending format: /path/to/file.csv
📱 Found pending account 250062001 (MT4) - online (2.3s ago)
⏰ Ignoring account 250062002 - too old (65.2 minutes)
```

### Métricas Disponibles
- **Total de cuentas**: Número total de cuentas pendientes
- **Cuentas online**: Cuentas activas en los últimos 5 segundos
- **Cuentas offline**: Cuentas inactivas por más de 5 segundos
- **Estadísticas por plataforma**: Desglose por MT4, MT5, etc.

## Configuración

### Límites de Tiempo
- **Online threshold**: 5 segundos (cuentas se consideran online si su última actividad fue hace menos de 5 segundos)
- **Expiration time**: 1 hora (cuentas más antiguas se ignoran)
- **Update interval**: 1 segundo (frecuencia de verificación)

### Rutas de Archivos
```javascript
const patterns = [
  '**/IPTRADECSV2.csv',
  '**/csv_data/**/IPTRADECSV2.csv',
  '**/accounts/**/IPTRADECSV2.csv',
];
```

## Próximos Pasos

### Mejoras Planificadas
1. **Validación de datos**: Verificar formato de timestamps y IDs
2. **Compresión**: Soporte para archivos comprimidos
3. **Backup automático**: Respaldo de archivos CSV
4. **Notificaciones**: Alertas para cuentas offline prolongadas

### Integración
- **EA Integration**: Actualizar EAs para usar el nuevo formato
- **API Endpoints**: Nuevos endpoints para gestión de cuentas pendientes
- **Dashboard**: Métricas avanzadas en el panel de control
