# CSV System Architecture

## Overview

The IPTRADE application has been restructured to use CSV files instead of APIs for communication between trading bots and the main application. This new architecture provides better reliability, offline capabilities, and easier debugging.

## Architecture Changes

### Before (API-based)
```
Frontend (React/Electron) → Server APIs → Trading Bots
```

### After (CSV-based)
```
Frontend (React/Electron) → Server → CSV Files ← Trading Bots
```

## Key Components

### 1. CSV Manager Service (`server/src/services/csvManager.js`)

The core service that handles all CSV file operations:

- **File Discovery**: Automatically scans for `IPTRADECSV2.csv` files
- **Real-time Monitoring**: Uses `fs.watchFile()` to monitor CSV changes
- **Data Parsing**: Parses CSV data into structured objects
- **Configuration Management**: Handles bot configurations via CSV

### 2. CSV Routes (`server/src/routes/csvRoutes.js`)

New API endpoints that work with CSV data:

- `/api/csv/accounts/all` - Get all accounts from CSV
- `/api/csv/copier/status` - Get copier status from CSV
- `/api/csv/copier/global` - Set global copier status
- `/api/csv/copier/master` - Set master account status
- `/api/csv/slave-config/:id` - Get/update slave configuration
- `/api/csv/scan` - Scan for CSV files
- `/api/csv/install-bot` - Install bot on platform
- `/api/csv/run-install-script` - Run installation script
- `/api/csv/scan-platform-accounts` - Scan platform accounts

### 3. Platform Linker Component (`src/components/PlatformLinker.tsx`)

New UI component for managing platform installations:

- Install bots on different trading platforms
- Run installation scripts
- Scan for platform accounts
- Monitor bot status

## CSV File Format

### Structure
```csv
timestamp,account_id,account_type,status,action,data,master_id,platform
```

### Fields
- `timestamp`: ISO 8601 timestamp
- `account_id`: Unique account identifier
- `account_type`: `master` or `slave`
- `status`: `online` or `offline`
- `action`: `ping`, `config`, `order`, etc.
- `data`: JSON string with action-specific data
- `master_id`: For slaves, the master account ID
- `platform`: Trading platform (MT4, MT5, cTrader, etc.)

### Example Entries

#### Master Account Ping
```csv
2024-01-15T10:30:00Z,12345,master,online,ping,{},,MT4
```

#### Master Account Configuration
```csv
2024-01-15T10:30:01Z,12345,master,online,config,{"enabled":true,"type":"master"},,MT4
```

#### Trading Order
```csv
2024-01-15T10:30:02Z,12345,master,online,order,{"symbol":"EURUSD","type":"BUY","lot":0.1,"price":1.0850},,MT4
```

#### Slave Account Configuration
```csv
2024-01-15T10:30:04Z,67890,slave,online,config,{"enabled":true,"description":"Slave 67890"},12345,MT5
```

## File Discovery

The system automatically discovers CSV files using glob patterns:

```javascript
const patterns = [
  '**/IPTRADECSV2.csv',
  '**/csv_data/**/IPTRADECSV2.csv',
  '**/accounts/**/IPTRADECSV2.csv'
];
```

## Real-time Monitoring

The CSV Manager uses `fs.watchFile()` to monitor file changes:

```javascript
const watcher = watch(filePath, (eventType, filename) => {
  if (eventType === 'change') {
    console.log(`📝 CSV file updated: ${filePath}`);
    this.refreshFileData(filePath);
  }
});
```

## Bot Installation Process

### 1. Platform Detection
- User clicks "Run Script" for a platform
- System executes platform-specific installation script
- Script detects platform installation and requirements

### 2. Bot Installation
- User clicks "Install Bot" for a platform
- System installs the appropriate trading bot
- Bot creates `IPTRADECSV2.csv` file in platform directory

### 3. Account Discovery
- Bot scans platform for trading accounts
- Bot writes account information to CSV
- Main application detects new accounts via file monitoring

## Configuration Management

### Global Settings
```csv
2024-01-15T10:30:00Z,GLOBAL,config,online,config,{"globalEnabled":true},,
```

### Master Account Settings
```csv
2024-01-15T10:30:01Z,12345,config,online,config,{"enabled":true,"type":"master"},,MT4
```

### Slave Account Settings
```csv
2024-01-15T10:30:02Z,67890,config,online,config,{"enabled":true,"description":"Slave config"},12345,MT5
```

## Emergency Controls

### Emergency Shutdown
```csv
2024-01-15T10:30:00Z,EMERGENCY,config,online,config,{"emergencyShutdown":true},,
```

### Reset All to ON
```csv
2024-01-15T10:30:00Z,RESET,config,online,config,{"resetAllOn":true},,
```

## Benefits of CSV System

### 1. Reliability
- No network dependencies for bot communication
- Works offline
- File-based persistence

### 2. Debugging
- Easy to inspect CSV files
- Clear audit trail
- Human-readable format

### 3. Flexibility
- Bots can work independently
- Easy to add new platforms
- Simple data format

### 4. Performance
- No API rate limits
- Local file system access
- Real-time file monitoring

## Migration from API System

### Frontend Changes
- Updated `CopierStatusControls.tsx` to use CSV endpoints
- Added `PlatformLinker.tsx` for bot installation
- All API calls now use `/csv/` prefix

### Backend Changes
- New `csvManager.js` service
- New `csvAccountsController.js` controller
- New `csvRoutes.js` routes
- Updated server to include CSV routes

### Data Migration
- Existing account data remains in JSON files
- New CSV files created for bot communication
- Gradual migration possible

## File Locations

### CSV Files
- `csv_data/` - Main CSV directory
- `accounts/` - Account-specific CSV files
- Platform directories - Platform-specific CSV files

### Configuration Files
- `server/config/` - Server configuration
- `server/accounts/` - Account data (legacy)

## Monitoring and Logging

### CSV Manager Logs
```
📁 Found 3 CSV files
📝 CSV file updated: /path/to/IPTRADECSV2.csv
📝 Config written to CSV for account 12345
```

### File Monitoring
- Real-time file change detection
- Automatic data refresh
- Error handling for file access issues

## Security Considerations

### File Permissions
- CSV files should have appropriate read/write permissions
- Platform-specific directories may need elevated permissions

### Data Validation
- CSV data is validated before processing
- JSON data in CSV fields is parsed safely
- Error handling for malformed data

## Future Enhancements

### 1. Advanced File Monitoring
- Multiple file format support
- Compressed CSV files
- Database integration

### 2. Enhanced Bot Management
- Bot health monitoring
- Automatic bot restart
- Performance metrics

### 3. Data Analytics
- CSV data analysis
- Trading performance metrics
- Historical data tracking

## Troubleshooting

### Common Issues

1. **CSV files not found**
   - Check file paths in glob patterns
   - Verify file naming convention
   - Check file permissions

2. **Data not updating**
   - Verify file watching is working
   - Check CSV format is correct
   - Restart CSV Manager service

3. **Bot installation fails**
   - Check platform requirements
   - Verify installation scripts
   - Check system permissions

### Debug Commands

```bash
# Scan for CSV files
curl -X POST http://localhost:3000/api/csv/scan

# Get all accounts
curl -X GET http://localhost:3000/api/csv/accounts/all

# Check copier status
curl -X GET http://localhost:3000/api/csv/copier/status
```

## Conclusion

The CSV-based architecture provides a robust, reliable, and flexible foundation for the IPTRADE application. It eliminates network dependencies for bot communication while maintaining all existing functionality and adding new capabilities for platform management.
