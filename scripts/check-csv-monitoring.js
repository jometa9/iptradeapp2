#!/usr/bin/env node

/**
 * Script to check which CSV files are currently being monitored
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';

async function checkCSVMonitoring() {
  console.log('🔍 Checking CSV file monitoring status...\n');

  try {
    // Check server status
    console.log('📋 Step 1: Checking server status...');
    const statusResponse = await fetch(`${BASE_URL}/status`);
    if (!statusResponse.ok) {
      throw new Error('Server not responding');
    }
    console.log('✅ Server is running');

    // Check pending accounts (this will show what files are being scanned)
    console.log('\n📋 Step 2: Checking pending accounts scan...');
    const pendingResponse = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!pendingResponse.ok) {
      throw new Error(`Failed to get pending accounts: ${pendingResponse.status}`);
    }

    const pendingData = await pendingResponse.json();
    console.log('📊 Pending accounts scan result:', pendingData.summary);

    // Check configured accounts
    console.log('\n📋 Step 3: Checking configured accounts...');
    const accountsResponse = await fetch(`${BASE_URL}/accounts/all`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to get accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();
    console.log('📊 Configured accounts:', {
      masters: accountsData.totalMasterAccounts,
      slaves: accountsData.totalSlaveAccounts,
    });

    // Check configuration files
    console.log('\n📋 Step 4: Checking configuration files...');
    const fs = await import('fs');
    const path = await import('path');

    // Check csv_locations.json
    const csvLocationsPath = './server/config/csv_locations.json';
    if (fs.existsSync(csvLocationsPath)) {
      const csvLocations = JSON.parse(fs.readFileSync(csvLocationsPath, 'utf8'));
      console.log('📁 CSV Locations configured:', csvLocations.csvLocations);
      console.log('🔍 Search patterns:', csvLocations.searchPatterns);
    } else {
      console.log('❌ csv_locations.json not found');
    }

    // Check mql_paths_cache.json
    const mqlCachePath = './config/mql_paths_cache.json';
    if (fs.existsSync(mqlCachePath)) {
      const mqlCache = JSON.parse(fs.readFileSync(mqlCachePath, 'utf8'));
      console.log('📁 MQL4 folders cached:', mqlCache.paths.mql4Folders);
      console.log('📁 MQL5 folders cached:', mqlCache.paths.mql5Folders);
      console.log('⏰ Cache timestamp:', mqlCache.timestamp);
    } else {
      console.log('❌ mql_paths_cache.json not found');
    }

    // Check actual CSV file
    console.log('\n📋 Step 5: Checking actual CSV file...');
    const csvPath =
      '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf8').trim();
      console.log('📄 Current CSV content:', csvContent);

      const stats = fs.statSync(csvPath);
      console.log('📅 File last modified:', stats.mtime);
      console.log('📏 File size:', stats.size, 'bytes');
    } else {
      console.log('❌ CSV file not found at expected location');
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`- Pending accounts found: ${pendingData.summary.totalAccounts}`);
    console.log(
      `- Configured accounts: ${accountsData.totalMasterAccounts + accountsData.totalSlaveAccounts}`
    );
    console.log(`- CSV file exists: ${fs.existsSync(csvPath) ? 'YES' : 'NO'}`);

    if (pendingData.summary.totalAccounts === 0) {
      console.log('\n⚠️ No pending accounts found. This could be because:');
      console.log('   1. The CSV file has status other than PENDING');
      console.log('   2. The file is not being detected by the system');
      console.log('   3. There are timestamp filtering issues');
      console.log('   4. The file watching is not working correctly');
    } else {
      console.log('\n✅ System is detecting pending accounts correctly');
    }
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

// Run the check
checkCSVMonitoring();
