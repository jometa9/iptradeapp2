# TODO - IPTrade App

## ✅ COMPLETED TASKS

### CSV File Search and Caching
- ✅ **Platform Link CSV Search**: Updated to search for files containing "IPTRADECSV2" (partial match)
  - Windows PowerShell: `Get-ChildItem -Path $_.Root -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*IPTRADECSV2*.csv' }`
  - macOS/Linux: `find / -name "*IPTRADECSV2*.csv" 2>/dev/null`
  - Updated in `linkPlatformsController.js` and `csvManager.js`

### File Access Optimization
- ✅ **EBUSY Error Fix**: Converted synchronous file reads to asynchronous with retry logic
  - Updated `getAllActiveAccounts()` to use `parseCSVFileAsync()` instead of `parseCSVFile()`
  - Added retry logic for locked files
  - Fixed in multiple controllers: `accountsController.js`, `slaveConfigController.js`, `ordersController.js`
  - Converted `forEach` loops to `for...of` to allow `await` operations

### Unified API Endpoint
- ✅ **Unified Account Data Endpoint**: Created `GET /api/accounts/unified`
  - Combines pending accounts, server status, and configured accounts in single call
  - **Single CSV Read Operation**: Reads all CSV files once and processes all data types
  - Eliminates repeated CSV file access for different data types
  - Optimized to reduce file I/O operations
  - Added to `accountsController.js` and `accounts.js` routes

### Frontend Migration to Unified Endpoint
- ✅ **Frontend Service Update**: Added `getUnifiedAccountData()` to `csvFrontendService.ts`
- ✅ **Unified React Hook**: Created `useUnifiedAccountData.ts` hook
  - Single interface for all account-related data
  - SSE integration for real-time updates
  - Backward compatibility with existing data structures
- ✅ **Component Updates**: 
  - Updated `PendingAccountsManager.tsx` to use unified hook
  - Updated `TradingAccountsConfig.tsx` to use unified hook
- ✅ **Legacy Code Cleanup**:
  - Removed deprecated hooks: `usePendingAccounts.ts`, `useCSVData.ts`, `useHiddenPendingAccounts.ts`
  - Updated `useAutoLinkPlatforms.ts` and `useLinkPlatforms.ts` to use unified data
  - Marked legacy methods as deprecated in `csvFrontendService.ts`
  - Updated internal references to use unified endpoint
- ✅ **Performance Optimization**: Created `UnifiedAccountDataContext` provider
  - Eliminates duplicate API calls by sharing data across components
  - Single source of truth for all account data
  - Reduced from 3 simultaneous calls to 1 call
  - Configured polling to 1 second for real-time updates
  - Removed deprecated `getCopierStatus()` calls - now uses unified endpoint

## 🎯 CURRENT STATUS

**✅ MIGRATION COMPLETE**: The frontend now uses **ONLY** the `GET /api/accounts/unified` endpoint for data retrieval. All other GET endpoints are deprecated and only used for POST/PUT/DELETE operations.

### Data Flow:
1. **Frontend Components** → `useUnifiedAccountDataContext` (shared context)
2. **Context Provider** → `useUnifiedAccountData` hook (single instance)
3. **Hook** → `csvFrontendService.getUnifiedAccountData()`
4. **Service** → `GET /api/accounts/unified`
5. **Backend** → Single optimized call that returns all account data

### Benefits Achieved:
- **Performance**: Single API call instead of multiple separate calls
- **Optimized Frontend**: Context provider eliminates duplicate calls (3→1)
- **Single CSV Read**: Backend reads all CSV files once and processes all data types
- **Eliminated Redundant Calls**: Removed separate copier status endpoints
- **Consistency**: All account data comes from the same source
- **Real-time updates**: SSE integration for live data updates (1 second polling)
- **Reduced file I/O**: Backend optimizations prevent `EBUSY` errors
- **Simplified frontend**: Cleaner component logic with unified data access

## 📋 PENDING TASKS

*No pending tasks at this time.*

---

**Note**: The user confirmed that diagrams are not a priority ("np me importan los diagramas").

## 🔧 TECHNICAL REFERENCE

### PowerShell Commands for CSV Search
```powershell
# Search for CSV files containing "IPTRADECSV2"
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -File -Force -ErrorAction SilentlyContinue 2>$null |
    Where-Object { $_.Name -like '*IPTRADECSV2*.csv' } |
    Select-Object -ExpandProperty FullName
}

# Search for MQL4 and MQL5 folders
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    Get-ChildItem -Path $_.Root -Recurse -Directory -ErrorAction SilentlyContinue -Force 2>$null |
    Where-Object { $_.Name -in @('MQL4','MQL5') } |
    Select-Object -ExpandProperty FullName
}
```

