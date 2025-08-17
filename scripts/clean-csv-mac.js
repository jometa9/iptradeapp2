#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function deleteCSVFile(filePath) {
  try {
    console.log(`🗑️  Deleting: ${path.basename(filePath)}`);

    // Delete the file
    fs.unlinkSync(filePath);

    console.log(`✅ Deleted: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

function findIPTRADECSV2Files() {
  try {
    console.log('🔍 Searching for IPTRADECSV2 files across the entire system...');

    const files = [];

    // Search for IPTRADECSV2.csv files in the entire system (like link platform does)
    const findCommand = `find "${process.env.HOME}" -name "IPTRADECSV2.csv" -type f 2>/dev/null`;
    console.log(`🔍 Executing: ${findCommand}`);

    let stdout = '';
    try {
      const result = execSync(findCommand, { encoding: 'utf8' });
      stdout = result.stdout;
    } catch (error) {
      // find returns exit code 1 when it finds files but also permission errors
      // We use stdout even if there's an error (like link platform does)
      if (error.stdout) {
        stdout = error.stdout;
        console.log(`⚠️  Find command returned error code but found files, using results anyway`);
      }
    }

    const allCsvFiles = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim());

    console.log(`📁 Found ${allCsvFiles.length} IPTRADECSV2.csv files in system:`);
    allCsvFiles.forEach(file => console.log(`   - ${file}`));

    // Also search for other IPTRADE CSV patterns
    const alternativePatterns = ['*IPTRADECSV*.csv', '*iptradecsv*.csv'];

    alternativePatterns.forEach(pattern => {
      try {
        const altFindCommand = `find "${process.env.HOME}" -name "${pattern}" -type f 2>/dev/null`;
        const altResult = execSync(altFindCommand, { encoding: 'utf8' });

        if (altResult.trim()) {
          const altFiles = altResult
            .trim()
            .split('\n')
            .filter(line => line.trim());

          allCsvFiles.push(...altFiles);
        }
      } catch (error) {
        if (error.stdout) {
          const altFiles = error.stdout
            .trim()
            .split('\n')
            .filter(line => line.trim());
          allCsvFiles.push(...altFiles);
        }
      }
    });

    // Remove duplicates
    const uniqueFiles = [...new Set(allCsvFiles)];

    if (uniqueFiles.length === 0) {
      console.log('ℹ️  No IPTRADECSV2 files found in the system');
      return [];
    }

    console.log(`📁 Total unique IPTRADE CSV files found: ${uniqueFiles.length}`);
    return uniqueFiles;
  } catch (error) {
    console.error('❌ Error searching for IPTRADECSV2 files:', error.message);
    return [];
  }
}

function main() {
  console.log('🗑️  Starting IPTRADECSV2 deletion for Mac...\n');

  // Find all IPTRADECSV2 files in the system
  const files = findIPTRADECSV2Files();

  if (files.length === 0) {
    console.log('ℹ️  No files to delete');
    return;
  }

  console.log('\n🗑️  Starting deletion process...\n');

  let deletedCount = 0;
  files.forEach(filePath => {
    if (deleteCSVFile(filePath)) {
      deletedCount++;
    }
  });

  console.log(
    `\n🎉 IPTRADECSV2 deletion completed! Deleted ${deletedCount}/${files.length} files.`
  );
}

// Run the script
main();
