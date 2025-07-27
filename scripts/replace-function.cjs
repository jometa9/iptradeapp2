const fs = require('fs');
const path = require('path');

// Read the corrected function
const correctedFunction = fs.readFileSync('fix-connectivity-function.js', 'utf8');

// Read the original file
const originalFile = fs.readFileSync('server/src/controllers/accountsController.js', 'utf8');

// Find the start and end of the getConnectivityStats function
const functionStart = originalFile.indexOf('export const getConnectivityStats = (req, res) => {');
const functionEnd = originalFile.indexOf('};', functionStart) + 2;

if (functionStart === -1) {
  console.error('Could not find getConnectivityStats function');
  process.exit(1);
}

// Extract the corrected function content (remove the export declaration and add it back)
const correctedContent = correctedFunction
  .replace('// Corrected getConnectivityStats function\n', '')
  .replace(
    'export const getConnectivityStats = (req, res) => {',
    'export const getConnectivityStats = (req, res) => {'
  );

// Replace the function in the original file
const newFile =
  originalFile.substring(0, functionStart) + correctedContent + originalFile.substring(functionEnd);

// Write the corrected file
fs.writeFileSync('server/src/controllers/accountsController.js', newFile);

console.log('✅ Function replaced successfully');
