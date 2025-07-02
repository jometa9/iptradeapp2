# cTrader Integration - Configuration Guide

This guide will help you configure cTrader integration in your copy trading application.

## 📋 Prerequisites

1. **cTrader ID Account**: You need a registered cTrader account
2. **cTrader Open API Application**: You must register your application in the development portal
3. **Compatible Broker**: Your broker must support cTrader Open API

## 🔧 cTrader Application Configuration

### Step 1: Register your application

1. Go to [https://connect.ctrader.com/](https://connect.ctrader.com/)
2. Sign in with your cTrader ID
3. Navigate to "Applications" > "Create New Application"
4. Fill out the form:
   - **Name**: Your application name (e.g., "My Trade Copier")
   - **Description**: Description of your application
   - **Redirect URI**: `http://localhost:3000/api/ctrader/auth/callback`
   - **Scopes**: Select `trading`

### Step 2: Get credentials

After registration, you will get:
- **Client ID**: Unique ID of your application
- **Client Secret**: Secret key (keep this secure!)

## ⚙️ Server Configuration

### Step 1: Install dependencies

Dependencies are already included in `package.json`, but if you need to install them manually:

```bash
cd server
npm install ws axios dotenv jsonwebtoken
```

### Step 2: Configure environment variables

Create a `.env` file in the `server/` folder based on `.env.example`:

```bash
# Server Configuration
PORT=3000

# cTrader Open API Configuration
CTRADER_CLIENT_ID=your_client_id_here
CTRADER_CLIENT_SECRET=your_client_secret_here
CTRADER_REDIRECT_URI=http://localhost:3000/api/ctrader/auth/callback
CTRADER_SCOPE=trading

# cTrader API Endpoints (do not change)
CTRADER_AUTH_URL=https://connect.ctrader.com/oauth/v2/auth
CTRADER_TOKEN_URL=https://connect.ctrader.com/oauth/v2/token
CTRADER_API_URL=wss://connect.ctrader.com/apps/trading

# Frontend Configuration
FRONTEND_URL=http://localhost:5173

# Security
JWT_SECRET=your-super-secure-secret-key

# Environment
NODE_ENV=development
```

### Step 3: Start the server

```bash
cd server
npm start
```

## 🖥️ Interface Usage

### 1. Authentication

1. Go to Dashboard > "Trading Accounts" tab
2. In the "cTrader Management" section, click **"Authenticate"**
3. A cTrader popup window will open
4. Sign in with your cTrader ID and authorize the application
5. The window will close automatically and you'll see "Authenticated" status

### 2. Connect to API

1. After authentication, click **"Connect"** in the "API Connection" section
2. This will establish a WebSocket connection with cTrader
3. Available accounts will load automatically

### 3. Register Accounts

#### As Master (Signal Provider):
1. Click **"Register Master"**
2. Select the cTrader account that will provide signals
3. Assign a name and description
4. The account will be registered in your copy trading system

#### As Slave (Follower):
1. Click **"Register Slave"**
2. Select the cTrader account that will follow signals
3. Select the master account to follow
4. Assign a name and description
5. The account will automatically copy trades from the master

## 🔗 Available API Endpoints

### Authentication
- `POST /api/ctrader/auth/initiate` - Initiate OAuth authentication
- `GET /api/ctrader/auth/callback` - OAuth callback
- `GET /api/ctrader/auth/status/:userId` - Authentication status
- `DELETE /api/ctrader/auth/revoke/:userId` - Revoke authentication

### API Connection
- `POST /api/ctrader/connect` - Connect to cTrader API
- `DELETE /api/ctrader/disconnect/:userId` - Disconnect
- `GET /api/ctrader/status/:userId` - Connection status

### Account Management
- `GET /api/ctrader/accounts/:userId` - Get accounts
- `POST /api/ctrader/account/authenticate` - Authenticate specific account
- `POST /api/ctrader/register/master` - Register master account
- `POST /api/ctrader/register/slave` - Register slave account

## 🔄 Copy Trading Flow

1. **Master Account** executes a trade in cTrader
2. **cTrader API** sends execution event via WebSocket
3. **Your server** receives the event and processes it
4. **Transformation system** applies rules (multipliers, fixed lots, etc.)
5. **Slave Accounts** receive transformed orders
6. **cTrader API** executes orders in slave accounts

## 📊 Copy Model

### Equity-to-Equity Ratio
```
Copied Volume = (Slave Equity / Master Equity) × Master Volume
```

### Example:
- Master has $10,000 equity, opens 1 lot
- Slave has $5,000 equity
- Copied volume = ($5,000 / $10,000) × 1 = 0.5 lots

## 🛡️ Security

### Access Tokens
- Tokens are stored locally in `server/config/ctrader_tokens.json`
- They are automatically renewed before expiration
- Use HTTPS in production

### Best Practices
1. Keep the `CLIENT_SECRET` secure
2. Use a strong `JWT_SECRET`
3. Configure CORS appropriately
4. Use demo accounts for testing

## 🚨 Troubleshooting

### Error: "cTrader credentials not configured"
- Verify that `CTRADER_CLIENT_ID` and `CTRADER_CLIENT_SECRET` are in the `.env` file

### Error: "Connection timeout"
- Check your internet connection
- Confirm that the API URL is correct

### Error: "User not authenticated"
- Complete the OAuth process first
- Verify that tokens haven't expired

### Accounts don't load
- Make sure you're connected to the API
- Verify that your broker supports cTrader Open API

## 📞 Support

- **cTrader Documentation**: [https://help.ctrader.com/open-api/](https://help.ctrader.com/open-api/)
- **Development Portal**: [https://connect.ctrader.com/](https://connect.ctrader.com/)
- **Telegram Community**: Search for "cTrader Open API" on Telegram

## 🔄 Next Steps

1. **Test with Demo accounts** first
2. **Configure transformations** specific to each account
3. **Implement logging** for auditing
4. **Configure alerts** for critical errors
5. **Optimize performance** for multiple accounts

---

Your cTrader integration is ready! 🎉
