# IPTRADE API - Expert Advisor Integration Guide

> **Complete documentation for MetaTrader Expert Advisors**
> Version: 1.0.0
> Date: 2024

## 📋 Table of Contents

1. [Initial Setup](#initial-setup)
2. [Authentication](#authentication)
3. [Main Endpoints](#main-endpoints)
4. [Workflow](#workflow)
5. [Code Examples](#code-examples)
6. [Error Codes](#error-codes)
7. [Response Messages](#response-messages)

---

## 🔧 Initial Setup

### Base URL
```
http://localhost:3000/api
```

### Required Headers
```http
Content-Type: application/json
x-account-id: {accountId}
x-api-key: IPTRADE_APIKEY
```

> **🔑 Fixed API Key**: All MT4/MT5 accounts must use the same fixed API key `IPTRADE_APIKEY` to authenticate their requests. This key validates that orders come from authorized sources, while `x-account-id` identifies the specific account.

---

## 🔐 Authentication

### 1. Check Account Type
**Endpoint:** `GET /orders/account-type`
**Description:** First endpoint that EA must call to identify if it's master, slave, or pending.

```http
GET /api/orders/account-type
x-account-id: {accountId}
x-api-key: IPTRADE_APIKEY
```

**Responses:**

#### Pending Account (New):
```json
{
  "accountId": "123456",
  "type": "pending",
  "status": "awaiting_configuration",
  "message": "Account detected and registered as pending - awaiting configuration",
  "permissions": [],
  "nextSteps": [
    "Account has been automatically registered as pending",
    "Administrator must configure this account as master or slave",
    "Contact administrator to complete setup",
    "EA will remain in standby mode until configured"
  ],
  "adminEndpoints": {
    "viewPending": "GET /api/accounts/pending",
    "convertToMaster": "POST /api/accounts/pending/{accountId}/to-master",
    "convertToSlave": "POST /api/accounts/pending/{accountId}/to-slave"
  }
}
```

#### Configured Account (Master/Slave):
```json
{
  "accountId": "123456",
  "type": "master", // or "slave"
  "status": "active",
  "permissions": ["POST /neworder (send trades)"], // or ["GET /neworder (receive trades)"]
  "endpoints": {
    "checkType": "GET /api/orders/account-type",
    "trading": "POST /api/orders/neworder" // or "GET /api/orders/neworder"
  }
}
```

---

## 📡 Main Endpoints

### For MASTER Accounts

#### 1. Send New Order
**Endpoint:** `POST /orders/neworder`
**Description:** Sends a new trading order that will be copied to connected slave accounts.

```http
POST /api/orders/neworder
x-account-id: {masterAccountId}
x-api-key: IPTRADE_APIKEY
Content-Type: application/x-www-form-urlencoded

counter=1&id0=12345&sym0=EURUSD&typ0=buy&lot0=0.1&price0=1.12345&sl0=1.12000&tp0=1.13000&account0={masterAccountId}
```

**Response:**
```
OK
```
*Note: Response is plain text "OK" when order is processed successfully.*

#### 2. Get Trading Configuration
**Endpoint:** `GET /trading-config/{masterAccountId}`

```http
GET /api/trading-config/master_123
x-account-id: master_123
x-api-key: IPTRADE_APIKEY
```

### For SLAVE Accounts

#### 1. Receive Pending Orders
**Endpoint:** `GET /orders/neworder`
**Description:** Gets orders that should be copied from its master account.

```http
GET /api/orders/neworder
x-account-id: {slaveAccountId}
x-api-key: IPTRADE_APIKEY
```

**Response:**
```
[1]
[12345,EURUSD,buy,0.1,1.12345,1.12000,1.13000,1704110400,master_123]
```
*Note: Response is CSV format where each line represents an order. First line is counter, following lines are: [orderId,symbol,type,lot,price,sl,tp,timestamp,account]*

#### 2. Process Received Orders
**Description:** No need to confirm to server - slave simply executes received orders in MT4/MT5 platform.

### For All Accounts

#### 1. Ping/Keep Alive
**Endpoint:** `POST /accounts/ping`
**Description:** Keeps connection active and reports EA status.

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

**Response:**
```json
{
  "message": "Ping successful",
  "accountId": "123456",
  "accountType": "master",
  "timestamp": "2024-01-01T12:00:00Z",
  "status": "active"
}
```

#### 2. Check Server Status
**Endpoint:** `GET /status`

```http
GET /api/status
```

---

## 🔄 Workflow

### For MASTER EA:
1. **Initialization:**
   - Call `GET /orders/account-type` to verify type
   - If "pending", wait for admin configuration
   - If "master", continue with workflow

2. **Active Trading:**
   - When opening position → `POST /orders/neworder`
   - Every 30 seconds → `POST /accounts/ping`

### For SLAVE EA:
1. **Initialization:**
   - Call `GET /orders/account-type` to verify type
   - If "pending", wait for admin configuration
   - If "slave", continue with workflow

2. **Copy Trades:**
   - Every 5 seconds → `GET /orders/neworder`
   - For each received order → Execute in MT4/MT5
   - Every 30 seconds → `POST /accounts/ping`

---

## 💻 Code Examples (MQL5)

### Function to Check Account Type
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
      // Parse JSON response
      // Determine if master, slave or pending
      return true;
   }

   return false;
}
```

### Function to Send Order (Master)
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

### Function to Receive Orders (Slave)
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
      // Parse CSV format
      // First line is counter [1]
      // Following lines are orders [id,symbol,type,lot,price,sl,tp,timestamp,account]
      string lines[];
      int lineCount = StringSplit(result_string, '\n', lines);
      
      for(int i = 1; i < lineCount; i++) // Skip counter line
      {
         if(StringLen(lines[i]) > 0 && StringFind(lines[i], "[") >= 0)
         {
            string cleanLine = StringSubstr(lines[i], 1, StringLen(lines[i]) - 2); // Remove []
            string fields[];
            int fieldCount = StringSplit(cleanLine, ',', fields);
            
            if(fieldCount >= 7)
            {
               // Execute order: fields[0]=id, fields[1]=symbol, fields[2]=type, etc.
               ExecuteSlaveOrder(fields);
            }
         }
      }
      return true;
   }

   return false;
}
```

### Function to Ping Server
```mql5
bool PingServer()
{
   string url = API_BASE_URL + "/accounts/ping";
   string headers = "x-account-id: " + AccountInfoInteger(ACCOUNT_LOGIN) + "\r\n";
   headers += "x-api-key: " + API_KEY + "\r\n";
   headers += "Content-Type: application/json\r\n";

   string postData = StringFormat(
      "{\"status\":\"online\",\"lastActivity\":\"%s\"}",
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );

   char post[], result[];
   string result_string;

   StringToCharArray(postData, post, 0, StringLen(postData));

   int res = WebRequest("POST", url, headers, 5000, post, result, result_string);

   return (res == 200);
}
```

---

## ⚠️ Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 200 | OK | Continue |
| 400 | Bad Request | Check data format |
| 401 | Unauthorized | Check account ID and API key |
| 403 | Forbidden | Check account permissions |
| 404 | Not Found | Check endpoint |
| 500 | Server Error | Retry after 30s |

---

## 📝 Response Messages

### Success Messages

#### Account Type Check (Pending):
```json
{
  "accountId": "123456",
  "type": "pending",
  "status": "awaiting_configuration",
  "message": "Account detected and registered as pending - awaiting configuration",
  "permissions": [],
  "nextSteps": [
    "Account has been automatically registered as pending",
    "Administrator must configure this account as master or slave",
    "Contact administrator to complete setup",
    "EA will remain in standby mode until configured"
  ]
}
```

#### Account Type Check (Master):
```json
{
  "accountId": "123456",
  "type": "master",
  "status": "active",
  "permissions": ["POST /neworder (send trades)"],
  "endpoints": {
    "checkType": "GET /api/orders/account-type",
    "trading": "POST /api/orders/neworder"
  }
}
```

#### Account Type Check (Slave):
```json
{
  "accountId": "123456",
  "type": "slave",
  "status": "active",
  "permissions": ["GET /neworder (receive trades)"],
  "endpoints": {
    "checkType": "GET /api/orders/account-type",
    "trading": "GET /api/orders/neworder"
  }
}
```

#### Ping Response:
```json
{
  "message": "Ping successful",
  "accountId": "123456",
  "accountType": "master",
  "timestamp": "2024-01-01T12:00:00Z",
  "status": "active"
}
```

### Error Messages

#### 401 - Unauthorized:
```json
{
  "error": "Account ID is required",
  "message": "Please provide accountId in headers (x-account-id), query params, or request body"
}
```

```json
{
  "error": "Invalid or missing API key",
  "message": "Please provide the correct API key in x-api-key header"
}
```

#### 403 - Forbidden (Pending Account):
```json
{
  "error": "Account pending configuration",
  "message": "This account is pending configuration. Please contact administrator to set up as master or slave.",
  "accountType": "pending",
  "status": "awaiting_configuration",
  "nextSteps": [
    "Contact administrator",
    "Account will be configured as master or slave",
    "Then EA can begin trading operations"
  ]
}
```

#### 403 - Forbidden (Wrong Account Type):
```json
{
  "error": "Access denied",
  "message": "POST requests (sending trades) are only allowed for master accounts",
  "accountType": "slave",
  "allowedMethods": ["GET"]
}
```

```json
{
  "error": "Access denied",
  "message": "GET requests (receiving trades) are only allowed for slave accounts",
  "accountType": "master",
  "allowedMethods": ["POST"]
}
```

#### 400 - Bad Request:
```json
{
  "error": "Master account 123456 is not registered. Please register the account first."
}
```

```json
{
  "error": "Slave account 123456 is not registered"
}
```

```json
{
  "error": "No master configured for slave: 123456"
}
```

#### 500 - Server Error:
```json
{
  "error": "Failed to process order",
  "message": "Internal server error occurred"
}
```

---

## 🔧 Advanced Configuration

### Recommended EA Variables:
```mql5
input string API_BASE_URL = "http://localhost:3000/api";
input string API_KEY = "IPTRADE_APIKEY";  // Fixed API key for all accounts
input int PING_INTERVAL = 30;        // seconds
input int POLL_INTERVAL = 5;         // seconds (slaves only)
input int MAX_RETRIES = 3;
input bool ENABLE_COPY_TRADING = true;
```

### Connectivity Test:
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

## 📝 Important Notes

1. **Authentication:** Use MT4/MT5 account number as `x-account-id` header and fixed API key `IPTRADE_APIKEY`.
2. **Fixed API Key:** All accounts use the same API key `IPTRADE_APIKEY` to authenticate requests.
3. **Data Format:** Master sends data in form-urlencoded format, slave receives CSV.
4. **Multiple Orders:** A master can send multiple orders using indices (id0, id1, etc.).
5. **Polling:** Slave accounts should poll every 5 seconds maximum.
6. **Keep Alive:** All accounts should ping every 30 seconds.
7. **Error Handling:** Implement automatic retries for 500 errors.
8. **Logs:** Log all API calls for debugging.

---

## 🆘 Support

For questions or issues:
- Swagger UI: `http://localhost:3000/api-docs`
- Server logs: Check backend console
- System status: `GET /api/status`
