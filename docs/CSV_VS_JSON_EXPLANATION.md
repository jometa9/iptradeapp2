# CSV vs JSON en el Sistema IPTRADE

## 📋 **Resumen Ejecutivo**

- **CSV**: Solo para comunicación en tiempo real entre bots
- **JSON**: Para configuraciones permanentes y datos de la aplicación

## 🔄 **Flujo de Datos**

### **1. Configuraciones (JSON)**
```
Usuario cambia configuración → Se guarda en JSON → Aplicación lee JSON → Muestra estado
```

### **2. Comunicación (CSV)**
```
Bot detecta orden → Escribe en CSV → Aplicación detecta cambio → Actualiza UI
```

## 📁 **Archivos JSON (Configuraciones Permanentes)**

### `server/config/copier_status.json`
```json
{
  "globalStatus": true,
  "masterAccounts": {
    "MASTER001": true,
    "MASTER002": false
  }
}
```

### `server/config/slave_configurations.json`
```json
{
  "77777": {
    "enabled": false,
    "description": "Slave account",
    "lotMultiplier": 1,
    "forceLot": null,
    "reverseTrading": false,
    "maxLotSize": null,
    "minLotSize": null,
    "allowedSymbols": [],
    "blockedSymbols": [],
    "allowedOrderTypes": [],
    "blockedOrderTypes": [],
    "tradingHours": {
      "enabled": false,
      "startTime": "00:00",
      "endTime": "23:59",
      "timezone": "UTC"
    },
    "lastUpdated": "2025-01-15T10:30:00Z"
  }
}
```

## 📄 **Archivos CSV (Comunicación en Tiempo Real)**

### `IPTRADECSV2.csv`
```csv
timestamp,account_id,account_type,status,action,data,master_id,platform
2024-01-15T10:30:00Z,12345,master,online,ping,{},,MT4
2024-01-15T10:30:01Z,12345,master,online,order,{"symbol":"EURUSD","type":"BUY","lot":0.1},,MT4
2024-01-15T10:30:02Z,67890,slave,online,ping,{},12345,MT5
2024-01-15T10:30:03Z,67890,slave,online,order,{"symbol":"EURUSD","type":"BUY","lot":0.1},12345,MT5
```

## 🎯 **Cuándo usar cada uno**

### **JSON (Configuraciones)**
- ✅ Estados de copier (ON/OFF)
- ✅ Configuraciones de slaves
- ✅ Configuraciones de masters
- ✅ Datos de cuentas
- ✅ Configuraciones de trading
- ✅ Datos que deben persistir entre reinicios

### **CSV (Comunicación)**
- ✅ Pings de bots (estado online/offline)
- ✅ Órdenes de trading en tiempo real
- ✅ Notificaciones de eventos
- ✅ Datos que cambian constantemente
- ✅ Comunicación entre bots y aplicación

## 🔧 **Ejemplo Práctico**

### **Escenario: Usuario habilita un master**

1. **Usuario hace clic en "Enable Master"**
   ```javascript
   // Se actualiza JSON
   copier_status.json: { "masterAccounts": { "MASTER001": true } }
   ```

2. **Bot lee configuración desde CSV**
   ```csv
   # Bot escribe en CSV para confirmar que leyó la configuración
   2024-01-15T10:30:00Z,MASTER001,master,online,config,{"enabled":true},,MT4
   ```

3. **Bot detecta orden de trading**
   ```csv
   # Bot escribe orden en CSV
   2024-01-15T10:30:01Z,MASTER001,master,online,order,{"symbol":"EURUSD","type":"BUY","lot":0.1},,MT4
   ```

4. **Aplicación detecta cambio en CSV**
   ```javascript
   // Aplicación lee CSV y actualiza UI
   // Muestra orden en tiempo real
   ```

## 📊 **Ventajas del Sistema Híbrido**

### **JSON (Configuraciones)**
- ✅ **Persistencia**: Los datos sobreviven reinicios
- ✅ **Estructura**: Datos complejos y anidados
- ✅ **Validación**: Fácil validar estructura
- ✅ **Backup**: Fácil hacer backup de configuraciones

### **CSV (Comunicación)**
- ✅ **Tiempo Real**: Cambios inmediatos
- ✅ **Simplicidad**: Formato fácil de leer
- ✅ **Debugging**: Fácil inspeccionar archivos
- ✅ **Independencia**: Bots pueden trabajar offline

## 🚀 **Implementación Actual**

### **Leer Configuraciones**
```javascript
// En csvManager.js
isMasterEnabled(masterId) {
  const copierStatusPath = join(process.cwd(), 'server', 'config', 'copier_status.json');
  const copierStatus = JSON.parse(readFileSync(copierStatusPath, 'utf8'));
  return copierStatus.masterAccounts[masterId] === true;
}
```

### **Escribir Configuraciones**
```javascript
// En csvManager.js
updateMasterStatus(masterId, enabled) {
  const copierStatusPath = join(process.cwd(), 'server', 'config', 'copier_status.json');
  const copierStatus = JSON.parse(readFileSync(copierStatusPath, 'utf8'));
  copierStatus.masterAccounts[masterId] = enabled;
  writeFileSync(copierStatusPath, JSON.stringify(copierStatus, null, 2));
}
```

### **Leer Comunicación**
```javascript
// En csvManager.js
parseCSVFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  // Parse CSV data...
}
```

## 🔍 **Debugging**

### **Ver Configuraciones**
```bash
# Ver estado del copier
cat server/config/copier_status.json

# Ver configuraciones de slaves
cat server/config/slave_configurations.json
```

### **Ver Comunicación**
```bash
# Ver comunicación en tiempo real
tail -f csv_data/IPTRADECSV2.csv
```

## 📝 **Conclusión**

- **JSON**: Para todo lo que debe persistir (configuraciones, estados, datos de cuentas)
- **CSV**: Para comunicación en tiempo real (pings, órdenes, eventos)

Este sistema híbrido nos da lo mejor de ambos mundos: configuraciones robustas y persistentes con comunicación rápida y simple.
