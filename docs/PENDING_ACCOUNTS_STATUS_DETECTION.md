# Detección de Estado Online/Offline para Cuentas Pendientes

## Problema Resuelto

Las cuentas pendientes no se detectaban correctamente como offline durante el polling, aunque al iniciar la aplicación sí funcionaba bien.

## Formato CSV (IPTRADECSV2)

El EA escribe el CSV en el siguiente formato:

```
[TYPE][PENDING][MT4][250062001]
[STATUS][ONLINE][1755208857]
[CONFIG][PENDING][]
```

Donde el timestamp (1755208857) es un Unix timestamp en segundos.

## Solución Implementada

### 1. Detección Basada en Timestamp

En `server/src/services/csvManager.js`, función `parseCSVFile()`:

- Se lee el timestamp de la línea STATUS: `[STATUS][ONLINE][timestamp]`
- Se calcula la diferencia entre el tiempo actual y el timestamp
- Si la diferencia es mayor a 5 segundos, la cuenta se marca como offline
- Si la diferencia es menor a 5 segundos, se mantiene el estado reportado por el EA
- Si la diferencia es mayor a 1 hora, la cuenta no se incluye en las pendientes

```javascript
const PENDING_ONLINE_THRESHOLD = 5; // 5 segundos (igual que ACTIVITY_TIMEOUT)

if (timeDiff > PENDING_ONLINE_THRESHOLD || timeDiff < -5) {
  currentAccountData.status = 'offline';
} else {
  // El timestamp es reciente, mantener el status reportado por el EA
}
```

### 2. Información Adicional en getAllActiveAccounts()

Se agregó información de debug para las cuentas pendientes:
- `timeSinceLastPing`: tiempo transcurrido desde el último ping
- `filePath`: ruta del archivo CSV para debug

### 3. Logging Mejorado

Se agregaron logs detallados durante:
- El parseo del CSV
- La emisión de actualizaciones de cuentas pendientes

## Configuración

- **Threshold para Online**: 5 segundos
- **Threshold para Eliminación**: 1 hora (3600 segundos)
- **Polling de archivos**: cada 2 segundos
- **Re-evaluación de pendientes**: cada 5 segundos

## Lógica de Estados

1. **Online**: timestamp con diferencia ≤ 5 segundos
2. **Offline**: timestamp con diferencia > 5 segundos y ≤ 1 hora
3. **Eliminada**: timestamp con diferencia > 1 hora (no se muestra en pendientes)

## Importante para el EA

El EA debe actualizar el timestamp en la línea STATUS cada vez que escriba el archivo CSV:
- Si el timestamp no se actualiza por más de 5 segundos → se marca como offline
- Si el timestamp no se actualiza por más de 1 hora → la cuenta desaparece de pendientes

## Testing

Para probar la detección de estado:

```bash
node scripts/test-pending-timestamp-detection.js
```

Este script crea cuentas pendientes con diferentes timestamps para verificar la detección correcta del estado.
