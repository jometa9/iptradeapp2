# Sistema CSV Unificado - IPTRADE

## 🎯 Objetivo

Simplificar al máximo la lógica de configuración de cuentas (master, slave, pending) para que:
- **Solo guardamos la licencia del usuario** en memoria/servidor
- **TODO lo demás se guarda directamente en el CSV**
- El frontend es **completamente reactivo** al CSV mediante file watching
- Para cualquier cambio, **modificamos directamente el CSV**

## 📄 Formato CSV Unificado

### Estructura con Corchetes
```
[TYPE][ACCOUNT_ID][PLATFORM][STATUS][CONFIG][MASTER_ID][TIMESTAMP]
```

### Campos

1. **[TYPE]**: Tipo de cuenta
   - `PENDING`: Cuenta esperando configuración
   - `MASTER`: Cuenta principal que envía señales
   - `SLAVE`: Cuenta que copia las señales

2. **[ACCOUNT_ID]**: ID único de la cuenta

3. **[PLATFORM]**: Plataforma de trading
   - `MT4`, `MT5`, `CTRADER`, `TRADINGVIEW`, `NINJATRADER`

4. **[STATUS]**: Estado de conectividad
   - `ONLINE`: Activo en los últimos 5 segundos
   - `OFFLINE`: Inactivo por más de 5 segundos

5. **[CONFIG]**: Configuración JSON
   - Para **PENDING**: `{}` (vacío)
   - Para **MASTER**: `{"enabled": true/false, "name": "string"}`
   - Para **SLAVE**: `{"enabled": true/false, "lotMultiplier": 1.0, "forceLot": null, ...}`

6. **[MASTER_ID]**: Solo para SLAVE, el ID del master al que está conectado

7. **[TIMESTAMP]**: Unix timestamp en segundos

### Ejemplos

```csv
[PENDING][250062001][MT4][ONLINE][{}][][1755131092]
[MASTER][12345][MT4][ONLINE][{"enabled":true,"name":"Master Principal"}][][1755131092]
[SLAVE][67890][MT5][ONLINE][{"enabled":true,"lotMultiplier":1.5}][12345][1755131092]
```

## 🏗️ Arquitectura Simplificada

### Backend

```
csvManagerUnified.js
├── Lectura del CSV
├── Escritura al CSV
├── File watching (polling cada 1s)
└── Emisión de eventos SSE

csvUnifiedController.js
├── getAllAccounts()
├── convertToMaster()
├── convertToSlave()
├── updateMasterConfig()
├── updateSlaveConfig()
└── deleteAccount()
```

### Frontend

```
csvUnifiedService.ts
├── Llamadas API
└── Suscripción SSE

useCSVDataUnified.ts
├── Estado reactivo
├── Auto-actualización via SSE
└── Funciones de modificación
```

## 🔄 Flujo de Datos

1. **Bot/EA escribe al CSV** → Agrega línea con formato `[TYPE][ID][...]`
2. **CSV Manager detecta cambio** → Polling cada segundo
3. **Servidor emite evento SSE** → Notifica a todos los clientes
4. **Frontend se actualiza** → Refresca UI automáticamente

## 🚀 Ventajas del Nuevo Sistema

### ✅ Simplicidad Total
- **Sin archivos JSON** de configuración
- **Sin estado en memoria** (excepto licencia)
- **Un solo archivo** para toda la información

### ✅ Transparencia
- Todo visible en el CSV
- Fácil de debuggear
- Fácil de editar manualmente

### ✅ Tiempo Real
- File watching automático
- SSE para actualizaciones instantáneas
- Frontend siempre sincronizado

### ✅ Portabilidad
- Solo necesitas el CSV
- Fácil backup/restore
- Compatible con cualquier editor

## 📡 API Endpoints

### Cuentas
```
GET  /api/csv/accounts/all          # Obtener todas las cuentas
GET  /api/csv/accounts/pending      # Solo cuentas pending
POST /api/csv/accounts/:id/convert-to-master
POST /api/csv/accounts/:id/convert-to-slave
PUT  /api/csv/accounts/master/:id   # Actualizar config master
PUT  /api/csv/accounts/slave/:id    # Actualizar config slave
DELETE /api/csv/accounts/:id        # Eliminar cuenta
```

### Estado del Copier
```
GET  /api/csv/copier/status         # Estado general
POST /api/csv/copier/global         # Habilitar/deshabilitar todos
POST /api/csv/copier/emergency-shutdown
POST /api/csv/copier/reset-all-on
```

### Server-Sent Events
```
GET  /api/csv/events                # Stream de actualizaciones
```

## 🛠️ Uso

### 1. Agregar Cuenta Pending (desde Bot/EA)
```csv
[PENDING][123456][MT4][ONLINE][{}][][1755131092]
```

### 2. Convertir a Master (desde UI)
```javascript
await csvUnifiedService.convertToMaster('123456', 'Mi Master Principal');
```
Resultado en CSV:
```csv
[MASTER][123456][MT4][ONLINE][{"enabled":true,"name":"Mi Master Principal"}][][1755131092]
```

### 3. Actualizar Configuración
```javascript
await csvUnifiedService.updateSlaveConfig('67890', {
  enabled: true,
  lotMultiplier: 2.0,
  reverseTrading: true
});
```

### 4. Eliminar Cuenta
```javascript
await csvUnifiedService.deleteAccount('123456');
```

## 📝 Scripts Útiles

### Generar CSV de Ejemplo
```bash
node scripts/generate-unified-csv-format.js
```

### Migrar desde JSON a CSV
```bash
node scripts/migrate-to-unified-csv.js
```

### Probar el Sistema
```bash
node scripts/test-unified-csv-system.js
```

## 🔍 Debugging

### Ver contenido del CSV
```bash
cat csv_data/IPTRADECSV_UNIFIED.csv
```

### Monitorear cambios en tiempo real
```bash
tail -f csv_data/IPTRADECSV_UNIFIED.csv
```

### Ver logs del servidor
```bash
# El servidor logueará:
# 📄 CSV file changed, emitting update...
# ✅ Written to CSV: [MASTER][123456]...
# 🔌 SSE connection established
```

## 🎉 Resultado Final

Con este sistema:
1. **NO guardamos nada en JSON** - Todo está en el CSV
2. **NO mantenemos estado** - El CSV es la única fuente de verdad
3. **TODO es reactivo** - Cambios en CSV → UI actualizada instantáneamente
4. **Simple de entender** - Un archivo, un formato, sin complejidad

El sistema es **completamente dinámico** y basado en el contenido del CSV.
