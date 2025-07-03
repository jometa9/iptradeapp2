# IP Trade App 2

Trading platform with copy trading capabilities for cTrader and MetaTrader 5.

## Features

### cTrader Integration
- OAuth2 authentication with cTrader
- Real-time WebSocket connection
- Account management and trading operations
- Copy trading between master and slave accounts

### MetaTrader 5 Integration
- Direct integration with MT5 terminal via Python API
- Real-time account monitoring
- Trading operations (buy, sell, close positions)
- Copy trading capabilities
- Account credential management

### Copy Trading
- Master/slave account configuration
- Real-time trade copying
- Risk management settings
- Detailed logging and monitoring

## Prerequisites

### For cTrader
- cTrader account with API access
- cTrader application credentials (CLIENT_ID and CLIENT_SECRET)

### For MetaTrader 5
- MetaTrader 5 terminal installed
- Python 3.8+ with MetaTrader5 package
- Trading account credentials

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd iptradeapp2
```

2. Install Node.js dependencies:
```bash
npm install
cd server && npm install
```

3. Install Python dependencies for MT5:
```bash
pip install -r server/src/python/requirements.txt
```

4. Set up environment variables in `server/.env`:
```env
# cTrader API credentials
CTRADER_CLIENT_ID=your_ctrader_client_id
CTRADER_CLIENT_SECRET=your_ctrader_client_secret

# Server configuration
FRONTEND_URL=http://localhost:5173
```

## Usage

### Starting the Application

1. Start the backend server:
```bash
cd server
npm run dev
```

2. Start the frontend (in a new terminal):
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Setting Up cTrader

1. Go to the cTrader tab in the application
2. Click "Initiate Authentication" to connect your cTrader account
3. Follow the OAuth flow to authorize the application
4. Your cTrader accounts will be automatically loaded

### Setting Up MetaTrader 5

1. Ensure MetaTrader 5 terminal is installed and running
2. Go to the MT5 tab in the application
3. Click "Initialize MT5" to start the connection
4. Login with your MT5 account credentials
5. Optionally save credentials for future use

### Copy Trading Setup

1. Configure master accounts (signal providers)
2. Configure slave accounts (signal receivers)
3. Set up copy trading rules and risk management
4. Monitor trades in real-time

## API Endpoints

### cTrader API
- `POST /api/ctrader/auth/initiate` - Start OAuth flow
- `GET /api/ctrader/auth/callback` - OAuth callback
- `POST /api/ctrader/connect` - Connect to cTrader API
- `GET /api/ctrader/accounts/:userId` - Get accounts
- `POST /api/ctrader/register/master` - Register master account
- `POST /api/ctrader/register/slave` - Register slave account

### MetaTrader 5 API
- `POST /api/mt5/initialize` - Initialize MT5 connection
- `POST /api/mt5/login` - Login to MT5 account
- `GET /api/mt5/account/:userId` - Get account info
- `GET /api/mt5/positions/:userId` - Get open positions
- `GET /api/mt5/orders/:userId` - Get pending orders
- `POST /api/mt5/order/place` - Place new order
- `POST /api/mt5/position/close` - Close position
- `POST /api/mt5/register/master` - Register master account
- `POST /api/mt5/register/slave` - Register slave account

## Architecture

### Backend
- **Express.js** server with REST API
- **WebSocket** connections for real-time data
- **Python integration** for MT5 via child processes
- **File-based storage** for configuration and credentials

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Real-time updates** via WebSocket

### Copy Trading Engine
- Real-time trade monitoring
- Configurable copying rules
- Risk management filters
- Detailed logging and audit trail

## Security Notes

⚠️ **Important**: This is a development version. For production use:

1. Implement proper encryption for stored credentials
2. Use secure WebSocket connections (WSS)
3. Add authentication and authorization
4. Use environment variables for all sensitive data
5. Implement rate limiting and input validation

## Development

### Project Structure
```
iptradeapp2/
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── context/           # React contexts
│   └── types/             # TypeScript types
├── server/                # Backend source
│   ├── src/
│   │   ├── controllers/   # API controllers
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API routes
│   │   └── python/        # Python scripts for MT5
│   └── config/           # Configuration files
└── config/               # Application configuration
```

### Adding New Features

1. **Backend**: Add controllers, services, and routes
2. **Frontend**: Create React components and integrate with API
3. **MT5 Features**: Extend Python scripts and API integration
4. **cTrader Features**: Extend WebSocket handlers and API calls

## Deployment and Versioning

This application includes a complete auto-update system for Electron. For detailed information about versioning, releases, and deployment:

📋 **[Read the complete Versioning and Deployment Guide](VERSIONING_AND_DEPLOYMENT.md)**

### Quick Release Commands

```bash
# Deploy a new patch version (1.0.14 → 1.0.15)
npm run release patch

# Deploy a new minor version (1.0.14 → 1.1.0)
npm run release minor

# Deploy a new major version (1.0.14 → 2.0.0)
npm run release major
```

The system automatically:
- ✅ Updates version numbers
- 🏗️ Builds for Windows and macOS via GitHub Actions
- 📦 Publishes to GitHub Releases
- 🔄 Notifies users of available updates
- ⬇️ Handles automatic download and installation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational and development purposes. Please ensure compliance with broker terms of service and applicable regulations when using for live trading.

## Support

For issues and questions:
1. Check the console logs for detailed error messages
2. Ensure all prerequisites are installed correctly
3. Verify API credentials and permissions
4. Check network connectivity and firewall settings

## Disclaimer

This software is provided for educational purposes only. Trading involves substantial risk of loss and is not suitable for all investors. Past performance does not guarantee future results. Use at your own risk.
