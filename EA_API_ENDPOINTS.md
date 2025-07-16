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
  "type": "pending"
}
```

#### Configured Account (Master/Slave):
```json
{
  "accountId": "123456",
  "type": "master" // or "slave"
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

| Code | Description | Specific Error Messages | Action |
|------|-------------|------------------------|--------|
| 200 | OK | - | Continue |
| 400 | Bad Request | - `"masterAccountId is required"`<br>- `"slaveAccountId is required"`<br>- `"Both slaveAccountId and masterAccountId are required"`<br>- `"Account ID is required"`<br>- `"No data received"`<br>- `"Platform {platform} is not supported"` | Check request parameters |
| 401 | Unauthorized | - `"Account ID is required"`<br>- `"Invalid or missing API key"`<br>- `"API Key required - use requireValidSubscription middleware"`<br>- `"Authentication required"` | Check account ID and API key |
| 403 | Forbidden | - `"Account pending configuration"`<br>- `"Access denied - This endpoint is only available for master accounts"`<br>- `"Access denied - This endpoint is only available for slave accounts"`<br>- `"POST requests (sending trades) are only allowed for master accounts"`<br>- `"GET requests (receiving trades) are only allowed for slave accounts"`<br>- `"Account mismatch"`<br>- `"Only master accounts can create orders"`<br>- `"Only slave accounts can retrieve orders"`<br>- `"Master account {id} is not registered"`<br>- `"Slave account {id} is not registered"` | Check account permissions and type |
| 404 | Not Found | - `"Master account {id} not found"`<br>- `"Slave account {id} not found"`<br>- `"Pending account {id} not found"` | Check account registration |
| 409 | Conflict | - `"Master account {id} is already registered"`<br>- `"Slave account {id} is already registered"`<br>- `"Account {id} already exists as master or slave"` | Account already exists |
| 500 | Server Error | - `"Failed to register master account"`<br>- `"Failed to register slave account"`<br>- `"Failed to connect accounts"`<br>- `"Failed to save account configuration"`<br>- `"Error writing CSV for account {id}"`<br>- `"Error reading CSV for master account {id}"`<br>- `"Internal server error"` | Retry after 30s |

---

## 📝 Response Messages

### Success Messages

#### Account Type Check (Pending):
```json
{
  "accountId": "123456",
  "type": "pending"
}
```

#### Account Type Check (Master):
```json
{
  "accountId": "123456",
  "type": "master"
}
```

#### Account Type Check (Slave):
```json
{
  "accountId": "123456",
  "type": "slave"
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

#### 403 - Forbidden (Account Mismatch):
```json
{
  "error": "Account mismatch. Authenticated as 123456 but trying to create order for 789012"
}
```

#### 403 - Forbidden (Not Registered):
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

#### 400 - Bad Request:
```json
{
  "error": "masterAccountId is required"
}
```

```json
{
  "error": "slaveAccountId is required"
}
```

```json
{
  "error": "No data received"
}
```

#### 409 - Conflict:
```json
{
  "error": "Master account 123456 is already registered"
}
```

```json
{
  "error": "Slave account 123456 is already registered"
}
```

#### 500 - Server Error:
```json
{
  "error": "Failed to register master account"
}
```

```json
{
  "error": "Error writing CSV for account 123456"
}
```

```json
{
  "error": "Error reading CSV for master account 123456"
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

## 📊 Chart Messages & User Feedback

### Display Messages on Chart

The EA should display status messages on the chart to keep users informed. Use `Comment()` function to show real-time status.

### Status Messages by Account Type

#### For Pending Accounts:
```
🔄 IPTRADE STATUS: PENDING CONFIGURATION
Account: 123456
Status: Awaiting administrator setup
Action: Contact administrator to configure as master/slave
Last Check: 2024-01-01 12:00:00
```

#### For Master Accounts:
```
✅ IPTRADE STATUS: MASTER ACTIVE
Account: 123456
Status: Sending trades to slaves
Connected Slaves: 3
Last Order: 2024-01-01 12:00:00
Last Ping: 2024-01-01 12:00:00
```

#### For Slave Accounts:
```
📥 IPTRADE STATUS: SLAVE ACTIVE
Account: 123456
Status: Receiving trades from master
Master: MASTER001
Last Order: 2024-01-01 12:00:00
Last Ping: 2024-01-01 12:00:00
```

### Error Messages on Chart

#### Connection Errors:
```
❌ IPTRADE ERROR: CONNECTION FAILED
Account: 123456
Error: Cannot connect to server
Action: Check internet connection
Retry: 30 seconds
```

#### Authentication Errors:
```
❌ IPTRADE ERROR: AUTHENTICATION FAILED
Account: 123456
Error: Invalid API key or account ID
Action: Check EA settings
Status: Disabled
```

#### Permission Errors:
```
❌ IPTRADE ERROR: ACCESS DENIED
Account: 123456
Error: Account not configured for this operation
Action: Contact administrator
Status: Disabled
```

#### Server Errors:
```
⚠️ IPTRADE WARNING: SERVER ERROR
Account: 123456
Error: Internal server error
Action: Retrying in 30 seconds
Status: Retry mode
```

### Implementation Example

```mql5
// Global variables for status tracking
string g_lastStatus = "";
string g_lastError = "";
datetime g_lastUpdate = 0;
int g_retryCount = 0;

// Function to update chart message
void UpdateChartMessage(string status, string error = "")
{
   string message = "";
   
   if(error != "")
   {
      message = "❌ IPTRADE ERROR: " + error + "\n";
      message += "Account: " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\n";
      message += "Time: " + TimeToString(TimeCurrent()) + "\n";
      message += "Action: Check connection and settings";
   }
   else
   {
      message = status + "\n";
      message += "Account: " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\n";
      message += "Last Update: " + TimeToString(TimeCurrent());
   }
   
   Comment(message);
   g_lastStatus = status;
   g_lastError = error;
   g_lastUpdate = TimeCurrent();
}

// Function to handle API responses
void HandleAPIResponse(int responseCode, string response)
{
   switch(responseCode)
   {
      case 200:
         if(StringFind(response, "pending") >= 0)
         {
            UpdateChartMessage("🔄 IPTRADE STATUS: PENDING CONFIGURATION\nContact administrator to setup account");
         }
         else if(StringFind(response, "master") >= 0)
         {
            UpdateChartMessage("✅ IPTRADE STATUS: MASTER ACTIVE\nSending trades to slaves");
         }
         else if(StringFind(response, "slave") >= 0)
         {
            UpdateChartMessage("📥 IPTRADE STATUS: SLAVE ACTIVE\nReceiving trades from master");
         }
         break;
         
      case 400:
         if(StringFind(response, "masterAccountId is required") >= 0)
         {
            UpdateChartMessage("", "BAD REQUEST\nMaster account ID is required");
         }
         else if(StringFind(response, "slaveAccountId is required") >= 0)
         {
            UpdateChartMessage("", "BAD REQUEST\nSlave account ID is required");
         }
         else if(StringFind(response, "Both slaveAccountId and masterAccountId are required") >= 0)
         {
            UpdateChartMessage("", "BAD REQUEST\nBoth slave and master account IDs are required");
         }
         else if(StringFind(response, "Account ID is required") >= 0)
         {
            UpdateChartMessage("", "BAD REQUEST\nAccount ID is required in headers");
         }
         else if(StringFind(response, "No data received") >= 0)
         {
            UpdateChartMessage("", "BAD REQUEST\nNo order data received");
         }
         else if(StringFind(response, "Platform") >= 0 && StringFind(response, "not supported") >= 0)
         {
            UpdateChartMessage("", "BAD REQUEST\nPlatform not supported");
         }
         else
         {
            UpdateChartMessage("", "BAD REQUEST\nCheck request parameters");
         }
         break;
         
      case 401:
         if(StringFind(response, "Account ID is required") >= 0)
         {
            UpdateChartMessage("", "AUTHENTICATION FAILED\nAccount ID is required in headers");
         }
         else if(StringFind(response, "Invalid or missing API key") >= 0)
         {
            UpdateChartMessage("", "AUTHENTICATION FAILED\nInvalid or missing API key");
         }
         else if(StringFind(response, "API Key required") >= 0)
         {
            UpdateChartMessage("", "AUTHENTICATION FAILED\nAPI key required for subscription");
         }
         else if(StringFind(response, "Authentication required") >= 0)
         {
            UpdateChartMessage("", "AUTHENTICATION FAILED\nAuthentication required");
         }
         else
         {
            UpdateChartMessage("", "AUTHENTICATION FAILED\nCheck account ID and API key");
         }
         break;
         
      case 403:
         if(StringFind(response, "Account pending configuration") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nAccount pending configuration\nContact administrator");
         }
         else if(StringFind(response, "only available for master accounts") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nThis endpoint is only for master accounts");
         }
         else if(StringFind(response, "only available for slave accounts") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nThis endpoint is only for slave accounts");
         }
         else if(StringFind(response, "POST requests (sending trades) are only allowed for master accounts") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nOnly master accounts can send trades");
         }
         else if(StringFind(response, "GET requests (receiving trades) are only allowed for slave accounts") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nOnly slave accounts can receive trades");
         }
         else if(StringFind(response, "Account mismatch") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nAccount mismatch\nCheck account configuration");
         }
         else if(StringFind(response, "Only master accounts can create orders") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nOnly master accounts can create orders");
         }
         else if(StringFind(response, "Only slave accounts can retrieve orders") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nOnly slave accounts can retrieve orders");
         }
         else if(StringFind(response, "is not registered") >= 0)
         {
            UpdateChartMessage("", "ACCESS DENIED\nAccount not registered\nContact administrator");
         }
         else
         {
            UpdateChartMessage("", "ACCESS DENIED\nAccount not configured for this operation");
         }
         break;
         
      case 404:
         if(StringFind(response, "Master account") >= 0 && StringFind(response, "not found") >= 0)
         {
            UpdateChartMessage("", "NOT FOUND\nMaster account not found");
         }
         else if(StringFind(response, "Slave account") >= 0 && StringFind(response, "not found") >= 0)
         {
            UpdateChartMessage("", "NOT FOUND\nSlave account not found");
         }
         else if(StringFind(response, "Pending account") >= 0 && StringFind(response, "not found") >= 0)
         {
            UpdateChartMessage("", "NOT FOUND\nPending account not found");
         }
         else
         {
            UpdateChartMessage("", "NOT FOUND\nAccount not registered");
         }
         break;
         
      case 409:
         if(StringFind(response, "Master account") >= 0 && StringFind(response, "already registered") >= 0)
         {
            UpdateChartMessage("", "CONFLICT\nMaster account already registered");
         }
         else if(StringFind(response, "Slave account") >= 0 && StringFind(response, "already registered") >= 0)
         {
            UpdateChartMessage("", "CONFLICT\nSlave account already registered");
         }
         else if(StringFind(response, "already exists as master or slave") >= 0)
         {
            UpdateChartMessage("", "CONFLICT\nAccount already exists as master or slave");
         }
         else
         {
            UpdateChartMessage("", "CONFLICT\nAccount already exists");
         }
         break;
         
      case 500:
         if(StringFind(response, "Failed to register master account") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nFailed to register master account\nRetrying in 30 seconds");
         }
         else if(StringFind(response, "Failed to register slave account") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nFailed to register slave account\nRetrying in 30 seconds");
         }
         else if(StringFind(response, "Failed to connect accounts") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nFailed to connect accounts\nRetrying in 30 seconds");
         }
         else if(StringFind(response, "Failed to save account configuration") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nFailed to save configuration\nRetrying in 30 seconds");
         }
         else if(StringFind(response, "Error writing CSV") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nError writing order data\nRetrying in 30 seconds");
         }
         else if(StringFind(response, "Error reading CSV") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nError reading order data\nRetrying in 30 seconds");
         }
         else if(StringFind(response, "Internal server error") >= 0)
         {
            UpdateChartMessage("", "SERVER ERROR\nInternal server error\nRetrying in 30 seconds");
         }
         else
         {
            UpdateChartMessage("", "SERVER ERROR\nRetrying in 30 seconds");
         }
         break;
         
      default:
         UpdateChartMessage("", "UNKNOWN ERROR\nCheck connection");
         break;
   }
}
```

### Status Update Frequency

- **Normal operation:** Update every 30 seconds
- **Error state:** Update immediately
- **Retry mode:** Update every 5 seconds
- **Pending account:** Update every 60 seconds

### User-Friendly Messages

#### Connection Status:
```
🟢 CONNECTED - All systems operational
🟡 CONNECTING - Establishing connection
🔴 DISCONNECTED - Connection lost
```

#### Account Status:
```
📋 PENDING - Waiting for administrator setup
👑 MASTER - Sending trades to followers
📥 SLAVE - Following master trades
❌ ERROR - Check configuration
```

#### Trading Status:
```
📈 ACTIVE - Trading operations normal
⏸️ PAUSED - Trading temporarily stopped
🚫 DISABLED - Trading disabled by admin
```

---

## 🆘 Support

For questions or issues:
- Swagger UI: `http://localhost:3000/api-docs`
- Server logs: Check backend console
- System status: `GET /api/status`
