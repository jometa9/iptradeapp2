#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define CSV directories to clean
const csvDirectories = [
  path.join(__dirname, '..', 'csv_data'),
  path.join(__dirname, '..', 'server', 'csv_data'),
  path.join(__dirname, '..', 'accounts')
];

function cleanCSVFile(filePath) {
  try {
    console.log(`🧹 Cleaning: ${path.basename(filePath)}`);
    
    // Read the file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Split into lines and filter out empty lines
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Clean each line
    const cleanedLines = lines.map(line => {
      // Remove BOM and special characters, keep brackets and basic ASCII
      return line.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\[\]]/g, '');
    });
    
    // Write back the cleaned content
    const cleanedContent = cleanedLines.join('\n') + '\n';
    fs.writeFileSync(filePath, cleanedContent, 'utf8');
    
    console.log(`✅ Cleaned: ${path.basename(filePath)} (${lines.length} lines)`);
    return true;
  } catch (error) {
    console.error(`❌ Error cleaning ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

function cleanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️  Directory not found: ${dirPath}`);
    return;
  }
  
  console.log(`\n📁 Cleaning directory: ${path.basename(dirPath)}`);
  
  const files = fs.readdirSync(dirPath);
  const csvFiles = files.filter(file => file.endsWith('.csv'));
  
  if (csvFiles.length === 0) {
    console.log(`ℹ️  No CSV files found in ${path.basename(dirPath)}`);
    return;
  }
  
  let cleanedCount = 0;
  csvFiles.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (cleanCSVFile(filePath)) {
      cleanedCount++;
    }
  });
  
  console.log(`📊 Cleaned ${cleanedCount}/${csvFiles.length} CSV files in ${path.basename(dirPath)}`);
}

function main() {
  console.log('🧹 Starting CSV cleanup for Mac...\n');
  
  let totalCleaned = 0;
  
  csvDirectories.forEach(dir => {
    cleanDirectory(dir);
    totalCleaned++;
  });
  
  console.log(`\n🎉 CSV cleanup completed! Processed ${totalCleaned} directories.`);
}

// Run the script
main();
