# IPTRADE Server API Documentation

## Sistema de Gestión de Cuentas

Este sistema permite registrar y administrar cuentas master y slave, configurar conexiones entre ellas, y aplicar transformaciones específicas por slave.

## Conceptos Clave

- **Cuenta Master**: Cuenta que envía órdenes al sistema
- **Cuenta Slave**: Cuenta que recibe órdenes de una cuenta master específica
- **Registro de Cuentas**: Solo las cuentas registradas pueden operar
- **Conexiones**: Cada slave debe estar conectado a un master específico
- **Transformaciones por Slave**: Cada slave puede tener configuraciones específicas que se aplican DESPUÉS de las transformaciones del master

## Plataformas Soportadas

El sistema soporta múltiples plataformas de trading:

- **MT4** (MetaTrader 4): Plataforma popular para forex con soporte para EAs
- **MT5** (MetaTrader 5): Plataforma avanzada multi-activos
- **cTrader**: Plataforma moderna ECN
- **TradingView**: Plataforma web de gráficos y trading
- **NinjaTrader**: Plataforma profesional para futuros y forex
- **Other**: Otras plataformas no listadas

Para MetaTrader 4 y MetaTrader 5, solo se requiere el ID de la cuenta para la configuración. Para plataformas futuras como cTrader, el proceso de configuración puede ser diferente.

---

## API Endpoints

### 🔐 Gestión de Cuentas

#### Registrar Cuenta Master
```http
POST /api/accounts/master
```

**Body:**
```json
{
  "masterAccountId": "MASTER001",
  "name": "Cuenta Principal Trading",
  "description": "Cuenta master para estrategia EURUSD",
  "broker": "IC Markets",
  "platform": "MT5"
}
```

**Campos:**
- `masterAccountId` (requerido): ID único de la cuenta
- `name` (opcional): Nombre descriptivo de la cuenta
- `description` (opcional): Descripción detallada
- `broker` (opcional): Nombre del broker
- `platform` (opcional): Plataforma de trading (ver plataformas soportadas)

**Respuesta:**
```json
{
  "message": "Master account registered successfully",
  "account": {
    "id": "MASTER001",
    "name": "Cuenta Principal Trading",
    "description": "Cuenta master para estrategia EURUSD",
    "broker": "IC Markets",
    "platform": "MT5",
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "lastActivity": null,
    "status": "active"
  },
  "status": "success"
}
```

#### Registrar Cuenta Slave
```http
POST /api/accounts/slave
```

**Body:**
```json
{
  "slaveAccountId": "SLAVE001",
  "name": "Cuenta Seguidor 1",
  "description": "Cuenta que sigue MASTER001 con lot 0.5",
  "broker": "MetaTrader 4",
  "platform": "MT4",
  "masterAccountId": "MASTER001"  // Opcional: conectar directamente
}
```

#### Conectar Slave a Master
```http
POST /api/accounts/connect
```

**Body:**
```json
{
  "slaveAccountId": "SLAVE001",
  "masterAccountId": "MASTER001"
}
```

#### Desconectar Slave
```http
DELETE /api/accounts/disconnect/SLAVE001
```

#### Obtener Plataformas Soportadas
```http
GET /api/accounts/platforms
```

**Respuesta:**
```json
{
  "platforms": [
    {
      "value": "MT4",
      "label": "MetaTrader 4",
      "description": "Popular forex trading platform with EA support"
    },
    {
      "value": "MT5",
      "label": "MetaTrader 5",
      "description": "Advanced multi-asset trading platform"
    },
    {
      "value": "cTrader",
      "label": "cTrader",
      "description": "Modern ECN trading platform"
    }
  ],
  "total": 6
}
```

#### Obtener Información de Cuenta Master
```http
GET /api/accounts/master/MASTER001
```

**Respuesta:**
```json
{
  "account": {
    "id": "MASTER001",
    "name": "Cuenta Principal Trading",
    // ... más datos de la cuenta
  },
  "connectedSlaves": ["SLAVE001", "SLAVE002"],
  "totalSlaves": 2
}
```

#### Obtener Información de Cuenta Slave
```http
GET /api/accounts/slave/SLAVE001
```

#### Obtener Todas las Cuentas
```http
GET /api/accounts/all
```

**Respuesta:**
```json
{
  "masterAccounts": {
    "MASTER001": {
      "id": "MASTER001",
      "name": "Cuenta Principal Trading",
      "connectedSlaves": [
        {
          "id": "SLAVE001",
          "name": "Cuenta Seguidor 1"
        }
      ],
      "totalSlaves": 1
    }
  },
  "unconnectedSlaves": [],
  "totalMasterAccounts": 1,
  "totalSlaveAccounts": 1,
  "totalConnections": 1
}
```

#### Actualizar Cuenta
```http
PUT /api/accounts/master/MASTER001
PUT /api/accounts/slave/SLAVE001
```

#### Eliminar Cuenta
```http
DELETE /api/accounts/master/MASTER001
DELETE /api/accounts/slave/SLAVE001
```

---

### ⚙️ Configuraciones Específicas por Slave

#### Obtener Configuración de Slave
```http
GET /api/slave-config/SLAVE001
```

**Respuesta:**
```json
{
  "slaveAccountId": "SLAVE001",
  "config": {
    "lotMultiplier": 1.0,
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
    "enabled": true,
    "description": "",
    "lastUpdated": null
  },
  "status": "success"
}
```

#### Configurar Slave
```http
POST /api/slave-config
```

**Body Ejemplo - Configuración Completa:**
```json
{
  "slaveAccountId": "SLAVE001",
  "lotMultiplier": 2.0,
  "forceLot": null,
  "reverseTrading": true,
  "maxLotSize": 1.0,
  "minLotSize": 0.01,
  "allowedSymbols": ["EURUSD", "GBPUSD"],
  "blockedSymbols": ["USDJPY"],
  "allowedOrderTypes": ["BUY", "SELL"],
  "blockedOrderTypes": ["BUY STOP", "SELL STOP"],
  "tradingHours": {
    "enabled": true,
    "startTime": "08:00",
    "endTime": "18:00",
    "timezone": "UTC"
  },
  "enabled": true,
  "description": "Config conservadora con reverse trading"
}
```

#### Obtener Todas las Configuraciones de Slaves
```http
GET /api/slave-config
```

#### Resetear Configuración a Defaults
```http
POST /api/slave-config/SLAVE001/reset
```

#### Eliminar Configuración
```http
DELETE /api/slave-config/SLAVE001
```

---

## 📋 Flujo de Trabajo Completo

### 1. Registro de Cuentas
```bash
# Registrar cuenta master
curl -X POST http://localhost:3000/api/accounts/master \
  -H "Content-Type: application/json" \
  -d '{
    "masterAccountId": "MASTER001",
    "name": "Cuenta Principal"
  }'

# Registrar cuenta slave
curl -X POST http://localhost:3000/api/accounts/slave \
  -H "Content-Type: application/json" \
  -d '{
    "slaveAccountId": "SLAVE001",
    "name": "Seguidor 1",
    "masterAccountId": "MASTER001"
  }'
```

### 2. Configuración de Transformaciones

```bash
# Configurar transformaciones del master
curl -X POST http://localhost:3000/api/trading-config \
  -H "Content-Type: application/json" \
  -d '{
    "masterAccountId": "MASTER001",
    "lotMultiplier": 2.0,
    "reverseTrading": false
  }'

# Configurar transformaciones específicas del slave
curl -X POST http://localhost:3000/api/slave-config \
  -H "Content-Type: application/json" \
  -d '{
    "slaveAccountId": "SLAVE001",
    "lotMultiplier": 0.5,
    "allowedSymbols": ["EURUSD", "GBPUSD"],
    "maxLotSize": 0.5
  }'
```

### 3. Operación Normal

```bash
# Master envía orden (solo cuentas registradas)
curl -X POST http://localhost:3000/api/neworder \
  -H "Content-Type: application/json" \
  -d '{
    "counter": "1",
    "account0": "MASTER001",
    "id0": "12345",
    "sym0": "EURUSD",
    "typ0": "BUY",
    "lot0": "0.1",
    "price0": "1.2345",
    "sl0": "1.2300",
    "tp0": "1.2400"
  }'

# Slave consulta órdenes (con transformaciones aplicadas)
curl "http://localhost:3000/api/neworder?account=SLAVE001"
```

---

## 🔄 Orden de Aplicación de Transformaciones

1. **Master recibe orden original**
2. **Se aplican transformaciones del Master** (configuradas en `/api/trading-config`)
3. **Orden se guarda en CSV del Master**
4. **Slave consulta órdenes**
5. **Se aplican transformaciones específicas del Slave** (configuradas en `/api/slave-config`)
6. **Slave recibe orden final transformada**

### Ejemplo de Transformaciones en Cadena:

**Orden Original:**
- Símbolo: EURUSD
- Tipo: BUY
- Lot: 0.1

**Transformaciones Master (MASTER001):**
- lotMultiplier: 2.0
- Resultado: BUY 0.2 lotes

**Transformaciones Slave (SLAVE001):**
- lotMultiplier: 0.5
- maxLotSize: 0.05
- Resultado Final: BUY 0.05 lotes (limitado por maxLotSize)

---

## 🛡️ Control de Acceso

- **Masters**: Solo las cuentas registradas pueden enviar órdenes
- **Slaves**: Solo las cuentas registradas pueden consultar órdenes
- **Conexiones**: Los slaves solo reciben datos de masters registrados y conectados
- **Estado**: Las cuentas inactivas no procesan órdenes

---

## 📁 Archivos de Configuración

El sistema crea automáticamente estos archivos en `server/config/`:

```
config/
├── registered_accounts.json      # Cuentas registradas y conexiones
├── slave_configurations.json     # Configuraciones específicas por slave
├── slave_master_mapping.json     # Mapeo slave→master (legacy)
├── trading_transformations.json  # Transformaciones por master
└── copier_status.json            # Estados ON/OFF del copier
```

---

## 🔧 APIs Existentes (sin cambios)

Las siguientes APIs mantienen su funcionalidad actual:

- `/api/status` - Estado del servidor
- `/api/trading-config` - Transformaciones por master
- `/api/copier/*` - Control ON/OFF del copier
- `/api/config` - Mapeo legacy slave→master

El nuevo sistema es **compatible hacia atrás** pero agrega validaciones de cuentas registradas.
