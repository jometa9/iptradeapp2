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
x-account-id: {accountId}
x-api-key: IPTRADE_APIKEY
```

> **🔑 API Key único**: Todas las cuentas MT4/MT5 deben usar el mismo API key fijo `IPTRADE_APIKEY` para autenticar sus requests. Este key valida que las órdenes vienen de fuentes autorizadas, mientras que `x-account-id` identifica la cuenta específica.

---

## 🔐 Autenticación

### 1. Verificar tipo de cuenta
**Endpoint:** `GET /orders/account-type`
**Descripción:** Primer endpoint que debe llamar el EA para identificar si es master, slave o pending.

```http
GET /api/orders/account-type
x-account-id: {accountId}
x-api-key: IPTRADE_APIKEY
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
x-account-id: {masterAccountId}
x-api-key: IPTRADE_APIKEY
Content-Type: application/x-www-form-urlencoded

counter=1&id0=12345&sym0=EURUSD&typ0=buy&lot0=0.1&price0=1.12345&sl0=1.12000&tp0=1.13000&account0={masterAccountId}
```

**Respuesta:**
```
OK
```
*Nota: La respuesta es texto plano "OK" cuando la orden se procesa exitosamente.*

#### 2. Obtener configuración de trading
**Endpoint:** `GET /trading-config/{masterAccountId}`

```http
GET /api/trading-config/master_123
x-account-id: master_123
x-api-key: IPTRADE_APIKEY
```

### Para cuentas SLAVE

#### 1. Recibir órdenes pendientes
**Endpoint:** `GET /orders/neworder`
**Descripción:** Obtiene las órdenes que debe copiar desde su cuenta master.

```http
GET /api/orders/neworder
x-account-id: {slaveAccountId}
x-api-key: IPTRADE_APIKEY
```

**Respuesta:**
```
[1]
[12345,EURUSD,buy,0.1,1.12345,1.12000,1.13000,1704110400,master_123]
```
*Nota: La respuesta es formato CSV donde cada línea representa una orden. La primera línea es el contador, las siguientes son: [orderId,symbol,type,lot,price,sl,tp,timestamp,account]*

#### 2. Procesar órdenes recibidas
**Descripción:** No es necesario confirmar al servidor - el slave simplemente ejecuta las órdenes recibidas en su plataforma MT4/MT5.

### Para todas las cuentas

#### 1. Ping/Keep Alive
**Endpoint:** `POST /accounts/ping`
**Descripción:** Mantiene la conexión activa y reporta el estado del EA.

```http
POST /api/accounts/ping
x-account-id: {accountId}
x-api-key: IPTRADE_APIKEY
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

### Para EA SLAVE:
1. **Inicialización:**
   - Llamar `GET /orders/account-type` para verificar tipo
   - Si es "pending", esperar configuración del admin
   - Si es "slave", continuar con el flujo

2. **Copiar trades:**
   - Cada 5 segundos → `GET /orders/neworder`
   - Por cada orden recibida → Ejecutar en MT4/MT5
   - Cada 30 segundos → `POST /accounts/ping`

---

## 💻 Ejemplos de código (MQL5)

### Función para verificar tipo de cuenta
```mql5
bool CheckAccountType()
{
   string url = API_BASE_URL + "/orders/account-type";
   string headers = "x-account-id: " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";
   headers += "x-api-key: " + API_KEY + "\r\n";

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
bool SendOrderToAPI(string symbol, double volume, int type, double price, double sl, double tp, long orderId)
{
   string url = API_BASE_URL + "/orders/neworder";
   string headers = "x-account-id: " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";
   headers += "x-api-key: " + API_KEY + "\r\n";
   headers += "Content-Type: application/x-www-form-urlencoded\r\n";

   string postData = StringFormat(
      "counter=1&id0=%d&sym0=%s&typ0=%s&lot0=%.2f&price0=%.5f&sl0=%.5f&tp0=%.5f&account0=%d",
      orderId, symbol, (type == ORDER_TYPE_BUY) ? "buy" : "sell", volume, price, sl, tp, AccountInfoInteger(ACCOUNT_LOGIN)
   );

   char post[], result[];
   string result_string;

   StringToCharArray(postData, post, 0, StringLen(postData));

   int res = WebRequest("POST", url, headers, 5000, post, result, result_string);

   return (res == 200 && result_string == "OK");
}
```

### Función para recibir órdenes (Slave)
```mql5
bool GetPendingOrders()
{
   string url = API_BASE_URL + "/orders/neworder";
   string headers = "x-account-id: " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";
   headers += "x-api-key: " + API_KEY + "\r\n";

   char post[], result[];
   string result_string;

   int res = WebRequest("GET", url, headers, 5000, post, result, result_string);

   if(res == 200)
   {
      // Parsear formato CSV
      // Primera línea es el contador [1]
      // Siguientes líneas son órdenes [id,symbol,type,lot,price,sl,tp,timestamp,account]
      string lines[];
      int lineCount = StringSplit(result_string, '\n', lines);
      
      for(int i = 1; i < lineCount; i++) // Saltar línea del contador
      {
         if(StringLen(lines[i]) > 0 && StringFind(lines[i], "[") >= 0)
         {
            string cleanLine = StringSubstr(lines[i], 1, StringLen(lines[i]) - 2); // Remover []
            string fields[];
            int fieldCount = StringSplit(cleanLine, ',', fields);
            
            if(fieldCount >= 7)
            {
               // Ejecutar orden: fields[0]=id, fields[1]=symbol, fields[2]=type, etc.
               ExecuteSlaveOrder(fields);
            }
         }
      }
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
input string API_KEY = "IPTRADE_APIKEY";  // API key fijo para todas las cuentas
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

1. **Autenticación:** Usa el número de cuenta de MT4/MT5 como header `x-account-id` y el API key fijo `IPTRADE_APIKEY`.
2. **API Key único:** Todas las cuentas usan el mismo API key `IPTRADE_APIKEY` para autenticar requests.
3. **Formato de datos:** Master envía datos en formato form-urlencoded, slave recibe CSV.
4. **Múltiples órdenes:** Un master puede enviar múltiples órdenes usando índices (id0, id1, etc.).
5. **Polling:** Las cuentas slave deben hacer polling cada 5 segundos máximo.
6. **Keep Alive:** Todas las cuentas deben hacer ping cada 30 segundos.
7. **Error Handling:** Implementa reintentos automáticos para errores 500.
8. **Logs:** Registra todas las llamadas al API para debugging.

---

## 🆘 Soporte

Para dudas o problemas:
- Swagger UI: `http://localhost:3000/api-docs`
- Logs del servidor: Revisar consola del backend
- Estado del sistema: `GET /api/status`
