# IPRADE

Professional copy trading application with support for multiple platforms (MT4, MT5, cTrader, NinjaTrader).

## 🚀 Quick Start

```bash
# Install dependencies
npm i
cd server
npm i
cd ..

# Run in development mode
npm run dev

# Or run Electron app in development
npm run electron:dev
```

## 🛠️ Available Scripts

### Development
```bash
npm run dev                    # Run frontend and server concurrently
npm run dev:frontend          # Run frontend only (Vite on port 5174)
npm run dev:server            # Run server only
npm run electron:dev          # Run Electron app in development
```

### Building
```bash
npm run build                 # Build for production
npm run electron:build        # Build Electron app for Windows
npm run electron:build:ci    # Build and publish to GitHub
npm run release              # Build release version
```

### Testing & Maintenance
```bash
npm run test:accounts         # Manage test accounts
npm run test:accounts:generate # Generate test accounts
npm run test:accounts:cleanup  # Cleanup test accounts
npm run test:accounts:reset   # Reset test accounts
npm run clean:mac            # Clean CSV files on macOS
npm run check:csv            # Check CSV cache
npm run clear:cache          # Clear application cache
```

### Code Quality
```bash
npm run lint                  # Run ESLint
npm run format               # Format code with Prettier
npm run format:check         # Check code formatting
npm run format:fix           # Format and fix linting issues
```

## 📁 Project Structure

```
├── src/                      # 🎨 Frontend (React + TypeScript)
├── server/                   # 🔧 Backend (Node.js + Express)
├── electron/                 # 🖥️ Desktop application
├── bots/                     # 🤖 Trading platform bots
├── config/                   # ⚙️ Configuration files
├── accounts/                 # 👥 Account data
├── csv_data/                 # 📊 CSV data storage
├── release/                  # 📦 Built applications
└── public/                   # 🌐 Static assets
```

## 🎯 Key Features

- ✅ **Multi-platform Support**: MT4, MT5, cTrader, NinjaTrader
- ✅ **Real-time Updates**: Live trading data synchronization
- ✅ **Account Management**: Master/Slave account relationships
- ✅ **Subscription System**: Limits and validations
- ✅ **Modern Interface**: React + TypeScript + Tailwind CSS
- ✅ **Desktop Application**: Cross-platform Electron app
- ✅ **CSV Integration**: Dynamic CSV file scanning and processing
- ✅ **Auto-linking**: Automatic platform account linking

## 🔧 Technology Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Radix UI** for components
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **Real-time** data processing
- **CSV** file management
- **RESTful APIs**

### Desktop
- **Electron** for cross-platform desktop app
- **Auto-updater** for seamless updates
- **System tray** integration

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm i && cd server && npm i && cd ..`
3. **Run development**: `npm run electron:dev`
4. **Configure platforms**: Set up your trading platform connections
5. **Start trading**: Link accounts and begin copy trading

## 📊 Platform Support

- **MetaTrader 4 (MT4)**: Full support with MQL4 bots
- **MetaTrader 5 (MT5)**: Full support with MQL5 bots
- **cTrader**: Full support with C# bots
- **NinjaTrader**: Full support with C# bots

## 🔑 Configuration

The application uses dynamic configuration files located in the `config/` directory:
- `registered_accounts.json` - Account registrations
- `csv_locations.json` - CSV file locations
- `trading_transformations.json` - Trading transformations
- `slave_configurations.json` - Slave account settings

## 📞 Support

For technical queries or issues, check the project documentation or create an issue in the repository.

---

*Developed with ❤️ for automated trading*
