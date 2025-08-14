#!/usr/bin/env node

/**
 * Debug script to understand CSV detection issues
 */

const API_KEY = 'iptrade_6616c788f776a3b114f0';
const BASE_URL = 'http://localhost:30/api';
const CSV_PATH =
  '/Users/joaquinmetayer/Library/Application Support/net.metaquotes.wine.metatrader4/drive_c/users/crossover/AppData/Roaming/MetaQuotes/Terminal/Common/Files/IPTRADECSV2.csv';

async function debugCSVDetection() {
  console.log('🔍 Debugging CSV detection...\n');

  try {
    const fs = await import('fs');

    // Step 1: Check if file exists
    console.log('📋 Step 1: Checking file existence...');
    const fileExists = fs.existsSync(CSV_PATH);
    console.log(`File exists: ${fileExists}`);

    if (fileExists) {
      const stats = fs.statSync(CSV_PATH);
      console.log(`File size: ${stats.size} bytes`);
      console.log(`Last modified: ${stats.mtime}`);
    }

    // Step 2: Read current file content
    console.log('\n📋 Step 2: Reading current file content...');
    if (fileExists) {
      const content = fs.readFileSync(CSV_PATH, 'utf8');
      console.log('📄 Raw content:');
      console.log(content);
      console.log('📄 Content length:', content.length);
      console.log('📄 Content bytes:', Buffer.from(content, 'utf8').length);
    }

    // Step 3: Create a test file with a very simple format
    console.log('\n📋 Step 3: Creating test file with simple format...');
    const testContent = '[0][250062001][MT4][PENDING][1755124000]';
    fs.writeFileSync(CSV_PATH, testContent + '\n', 'utf8');
    console.log('✅ Test content written:', testContent);

    // Step 4: Wait and check if system detects it
    console.log('\n📋 Step 4: Waiting for system to detect...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Check what system sees
    console.log('\n📋 Step 5: Checking what system sees...');
    const response = await fetch(`${BASE_URL}/csv/scan-pending`, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get pending accounts: ${response.status}`);
    }

    const data = await response.json();
    console.log('📊 System response:', JSON.stringify(data, null, 2));

    // Step 6: Check if file was modified by system
    console.log('\n📋 Step 6: Checking if file was modified...');
    const newContent = fs.readFileSync(CSV_PATH, 'utf8');
    console.log('📄 New content:', newContent);
    console.log('📄 Content changed:', newContent !== testContent + '\n');

    // Step 7: Try with a different approach - check if system is looking at the right path
    console.log('\n📋 Step 7: Checking system file detection...');

    // Try to find all CSV files in the system
    const { glob } = await import('glob');
    const patterns = [
      '**/IPTRADECSV2.csv',
      '**/csv_data/**/IPTRADECSV2.csv',
      '**/accounts/**/IPTRADECSV2.csv',
      process.env.HOME + '/**/IPTRADECSV2.csv',
    ];

    console.log('🔍 Searching for CSV files...');
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/.git/**'],
          absolute: true,
        });
        if (files.length > 0) {
          console.log(`📁 Pattern "${pattern}" found files:`, files);
        }
      } catch (error) {
        console.log(`❌ Pattern "${pattern}" error:`, error.message);
      }
    }

    // Step 8: Check if there are any other CSV files that might be interfering
    console.log('\n📋 Step 8: Checking for other CSV files...');
    try {
      const allCSVFiles = await glob('**/IPTRADECSV2.csv', {
        ignore: ['**/node_modules/**', '**/.git/**'],
        absolute: true,
      });
      console.log('📁 All IPTRADECSV2.csv files found:', allCSVFiles);

      for (const file of allCSVFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8').trim();
          console.log(`📄 ${file}: ${content}`);
        }
      }
    } catch (error) {
      console.log('❌ Error searching for CSV files:', error.message);
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  }
}

// Run the debug
debugCSVDetection();
