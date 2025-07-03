# IPTRADE API - MetaTrader EA Integration Guide

> **Documentación completa de endpoints para EA de MetaTrader**
> Versión: 1.0.0
> Fecha: 2024

## 📋 Índice

1. [Configuración inicial](#configuración-inicial)
2. [Autenticación](#autenticación)
3. [Endpoints principales](#endpoints-principales)
4. [Flujo de trabajo](#flujo-de-trabajo)
5. [Ejemplos de código](#ejemplos-de-código)
6. [Códigos de error](#códigos-de-error)

---

## 🔧 Configuración inicial

### Base URL del API
```
http://localhost:3000/api
```

### Headers requeridos
```http
Content-Type: application/json
Authorization: Bearer {accountId}
```

---

## 🔐 Autenticación

### 1. Verificar tipo de cuenta
**Endpoint:** `GET /orders/account-type`
**Descripción:** Primer endpoint que debe llamar el EA para identificar si es master, slave o pending.

```http
GET /api/orders/account-type
Authorization: Bearer {accountId}
```

**Respuestas:**
- **Cuenta pendiente (nueva):**
```json
{
  "accountId": "123456",
  "type": "pending",
  "status": "awaiting_configuration",
  "message": "Account detected and registered as pending - awaiting configuration",
  "nextSteps": [
    "Account has been automatically registered as pending",
    "Administrator must configure this account as master or slave"
  ]
}
```

- **Cuenta configurada (master/slave):**
```json
{
  "accountId": "123456",
  "type": "master", // o "slave"
  "status": "active",
  "permissions": ["POST /neworder (send trades)"], // o ["GET /neworder (receive trades)"]
  "endpoints": {
    "trading": "POST /api/orders/neworder" // o "GET /api/orders/neworder"
  }
}
```

---

## 📡 Endpoints principales

### Para cuentas MASTER

#### 1. Enviar nueva orden
**Endpoint:** `POST /orders/neworder`
**Descripción:** Envía una nueva orden de trading que será copiada a las cuentas slave conectadas.

```http
POST /api/orders/neworder
Authorization: Bearer {masterAccountId}
Content-Type: application/json

{
  "symbol": "EURUSD",
  "volume": 0.1,
  "type": "buy",
  "price": 1.12345,
  "stopLoss": 1.12000,
  "takeProfit": 1.13000,
  "comment": "Master trade #1",
  "magic": 12345
}
```

**Respuesta:**
```json
{
  "orderId": 12345,
  "status": "success",
  "message": "Order placed successfully",
  "copiedTo": ["slave_456", "slave_789"]
}
```

#### 2. Obtener configuración de trading
**Endpoint:** `GET /trading-config/{masterAccountId}`

```http
GET /api/trading-config/master_123
Authorization: Bearer master_123
```

### Para cuentas SLAVE

#### 1. Recibir órdenes pendientes
**Endpoint:** `GET /orders/neworder`
**Descripción:** Obtiene las órdenes que debe copiar desde su cuenta master.

```http
GET /api/orders/neworder
Authorization: Bearer {slaveAccountId}
```

**Respuesta:**
```json
[
  {
    "orderId": 12345,
    "symbol": "EURUSD",
    "volume": 0.1,
    "type": "buy",
    "price": 1.12345,
    "stopLoss": 1.12000,
    "takeProfit": 1.13000,
    "masterAccountId": "master_123",
    "timestamp": "2024-01-01T12:00:00Z"
  }
]
```

#### 2. Confirmar ejecución de orden
**Endpoint:** `POST /orders/confirm`
**Descripción:** Confirma que la orden fue ejecutada exitosamente en la cuenta slave.

```http
POST /api/orders/confirm
Authorization: Bearer {slaveAccountId}
Content-Type: application/json

{
  "orderId": 12345,
  "status": "executed",
  "slaveOrderId": 67890,
  "executionPrice": 1.12348
}
```

### Para todas las cuentas

#### 1. Ping/Keep Alive
**Endpoint:** `POST /accounts/ping`
**Descripción:** Mantiene la conexión activa y reporta el estado del EA.

```http
POST /api/accounts/ping
Authorization: Bearer {accountId}
Content-Type: application/json

{
  "status": "online",
  "lastActivity": "2024-01-01T12:00:00Z"
}
```

#### 2. Verificar estado del servidor
**Endpoint:** `GET /status`

```http
GET /api/status
```

---

## 🔄 Flujo de trabajo

### Para EA MASTER:
1. **Inicialización:**
   - Llamar `GET /orders/account-type` para verificar tipo
   - Si es "pending", esperar configuración del admin
   - Si es "master", continuar con el flujo

2. **Trading activo:**
   - Cuando abres una posición → `POST /orders/neworder`
   - Cada 30 segundos → `POST /accounts/ping`
   - Cuando cierras una posición → `POST /orders/close`

### Para EA SLAVE:
1. **Inicialización:**
   - Llamar `GET /orders/account-type` para verificar tipo
   - Si es "pending", esperar configuración del admin
   - Si es "slave", continuar con el flujo

2. **Copiar trades:**
   - Cada 5 segundos → `GET /orders/neworder`
   - Por cada orden recibida → Ejecutar en MT5
   - Confirmar ejecución → `POST /orders/confirm`
   - Cada 30 segundos → `POST /accounts/ping`

---

## 💻 Ejemplos de código (MQL5)

### Función para verificar tipo de cuenta
```mql5
bool CheckAccountType()
{
   string url = API_BASE_URL + "/orders/account-type";
   string headers = "Authorization: Bearer " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";

   char post[], result[];
   string result_string;

   int res = WebRequest("GET", url, headers, 5000, post, result, result_string);

   if(res == 200)
   {
      // Parsear JSON response
      // Determinar si es master, slave o pending
      return true;
   }

   return false;
}
```

### Función para enviar orden (Master)
```mql5
bool SendOrderToAPI(string symbol, double volume, int type, double price)
{
   string url = API_BASE_URL + "/orders/neworder";
   string headers = "Authorization: Bearer " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";
   headers += "Content-Type: application/json\r\n";

   string json = StringFormat(
      "{\"symbol\":\"%s\",\"volume\":%.2f,\"type\":\"%s\",\"price\":%.5f}",
      symbol, volume, (type == ORDER_TYPE_BUY) ? "buy" : "sell", price
   );

   char post[], result[];
   string result_string;

   StringToCharArray(json, post, 0, StringLen(json));

   int res = WebRequest("POST", url, headers, 5000, post, result, result_string);

   return (res == 200);
}
```

### Función para recibir órdenes (Slave)
```mql5
bool GetPendingOrders()
{
   string url = API_BASE_URL + "/orders/neworder";
   string headers = "Authorization: Bearer " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";

   char post[], result[];
   string result_string;

   int res = WebRequest("GET", url, headers, 5000, post, result, result_string);

   if(res == 200)
   {
      // Parsear JSON array
      // Ejecutar cada orden en MT5
      return true;
   }

   return false;
}
```

---

## ⚠️ Códigos de error

| Código | Descripción | Acción recomendada |
|--------|-------------|-------------------|
| 200 | OK | Continuar |
| 400 | Bad Request | Verificar formato de datos |
| 401 | Unauthorized | Verificar account ID |
| 403 | Forbidden | Verificar permisos de cuenta |
| 404 | Not Found | Verificar endpoint |
| 500 | Server Error | Reintentar después de 30s |

---

## 🔧 Configuración avanzada

### Variables del EA recomendadas:
```mql5
input string API_BASE_URL = "http://localhost:3000/api";
input int PING_INTERVAL = 30;        // segundos
input int POLL_INTERVAL = 5;         // segundos (solo slaves)
input int MAX_RETRIES = 3;
input bool ENABLE_COPY_TRADING = true;
```

### Verificación de conectividad:
```mql5
bool TestAPIConnection()
{
   string url = API_BASE_URL + "/status";
   char post[], result[];
   string result_string;

   int res = WebRequest("GET", url, "", 5000, post, result, result_string);
   return (res == 200);
}
```

---

## 📝 Notas importantes

1. **Autenticación:** Usa el número de cuenta de MT5 como Bearer token.
2. **Polling:** Las cuentas slave deben hacer polling cada 5 segundos máximo.
3. **Keep Alive:** Todas las cuentas deben hacer ping cada 30 segundos.
4. **Error Handling:** Implementa reintentos automáticos para errores 500.
5. **Logs:** Registra todas las llamadas al API para debugging.

---

## 🆘 Soporte

Para dudas o problemas:
- Swagger UI: `http://localhost:3000/api-docs`
- Logs del servidor: Revisar consola del backend
- Estado del sistema: `GET /api/status`
