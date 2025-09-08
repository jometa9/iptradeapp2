// CSV2 Format Validator v2
// Enhanced validation for IPTRADECSV2 format including ORDER lines
import { readFileSync } from 'fs';

// Constants for validation
const VALID_ACCOUNT_TYPES = ['MASTER', 'SLAVE', 'PENDING'];
const VALID_PLATFORMS = ['MT4', 'MT5', 'CTRADER'];
const VALID_ORDER_TYPES = ['BUY', 'SELL', 'BUYLIMIT', 'SELLLIMIT', 'BUYSTOP', 'SELLSTOP'];

// Validate a single line in CSV2 format
export const validateLine = line => {
  if (!line || typeof line !== 'string') {
    return { valid: false, error: 'Invalid line format' };
  }

  // Extract bracketed values
  const values = line.match(/\[([^\]]+)\]/g)?.map(v => v.replace(/[\[\]]/g, '').trim());
  if (!values || values.length < 2) {
    return { valid: false, error: 'Invalid bracket format' };
  }

  const lineType = values[0];

  // Validate based on line type
  switch (lineType) {
    case 'TYPE':
      if (values.length !== 3) return { valid: false, error: 'TYPE line must have 3 values' };
      if (!VALID_PLATFORMS.includes(values[1])) return { valid: false, error: 'Invalid platform' };
      if (!/^\d+$/.test(values[2])) return { valid: false, error: 'Invalid account ID' };
      break;

    case 'STATUS':
      if (values.length !== 3) return { valid: false, error: 'STATUS line must have 3 values' };
      if (!['ONLINE', 'OFFLINE'].includes(values[1]))
        return { valid: false, error: 'Invalid status' };
      if (!/^\d+$/.test(values[2])) return { valid: false, error: 'Invalid timestamp' };
      break;

    case 'CONFIG':
      if (values.length < 2)
        return { valid: false, error: 'CONFIG line must have at least 2 values' };
      if (!['MASTER', 'SLAVE', 'PENDING'].includes(values[1]))
        return { valid: false, error: 'Invalid config type' };
      break;

    case 'TRANSLATE':
      if (values.length < 2)
        return { valid: false, error: 'TRANSLATE line must have at least 2 values' };
      // Validate translation pairs or NULL
      for (let i = 1; i < values.length; i++) {
        if (values[i] !== 'NULL' && !values[i].includes(':')) {
          return {
            valid: false,
            error: `Invalid translation format in ${values[i]}. Expected format: SYMBOL1:SYMBOL2`,
          };
        }
      }
      break;

    case 'ORDER':
      if (values.length !== 9) return { valid: false, error: 'ORDER line must have 9 values' };
      if (!/^\d+$/.test(values[1])) return { valid: false, error: 'Invalid ticket number' };
      if (!VALID_ORDER_TYPES.includes(values[3]))
        return { valid: false, error: 'Invalid order type' };
      if (!/^\d+(\.\d+)?$/.test(values[4])) return { valid: false, error: 'Invalid volume' };
      if (!/^\d+(\.\d+)?$/.test(values[5])) return { valid: false, error: 'Invalid price' };
      if (!/^\d+(\.\d+)?$/.test(values[6])) return { valid: false, error: 'Invalid SL' };
      if (!/^\d+(\.\d+)?$/.test(values[7])) return { valid: false, error: 'Invalid TP' };
      if (!/^\d+$/.test(values[8])) return { valid: false, error: 'Invalid timestamp' };
      break;

    default:
      return { valid: false, error: 'Invalid line type' };
  }

  return { valid: true, values };
};

// Validate complete CSV structure
export const validateCSVStructure = lines => {
  if (!Array.isArray(lines) || lines.length < 4) {
    return {
      valid: false,
      error: 'CSV must have at least TYPE, STATUS, CONFIG, and TRANSLATE lines',
    };
  }

  // Validate required lines are present and in order
  const typeLineResult = validateLine(lines[0]);
  if (!typeLineResult.valid || typeLineResult.values[0] !== 'TYPE') {
    return { valid: false, error: 'First line must be TYPE line: ' + typeLineResult.error };
  }

  const statusLineResult = validateLine(lines[1]);
  if (!statusLineResult.valid || statusLineResult.values[0] !== 'STATUS') {
    return { valid: false, error: 'Second line must be STATUS line: ' + statusLineResult.error };
  }

  const configLineResult = validateLine(lines[2]);
  if (!configLineResult.valid || configLineResult.values[0] !== 'CONFIG') {
    return { valid: false, error: 'Third line must be CONFIG line: ' + configLineResult.error };
  }

  const translateLineResult = validateLine(lines[3]);
  if (!translateLineResult.valid || translateLineResult.values[0] !== 'TRANSLATE') {
    return {
      valid: false,
      error: 'Fourth line must be TRANSLATE line: ' + translateLineResult.error,
    };
  }

  // Get account type from CONFIG line
  const accountType = configLineResult.values[1];

  // For MASTER accounts, validate ORDER lines
  if (accountType === 'MASTER' && lines.length > 4) {
    for (let i = 4; i < lines.length; i++) {
      const orderLineResult = validateLine(lines[i]);
      if (!orderLineResult.valid || orderLineResult.values[0] !== 'ORDER') {
        const errorMessage = orderLineResult.error || 'Unknown error';
        return {
          valid: false,
          error: `Invalid ORDER line at position ${i + 1}: ${errorMessage}`,
        };
      }
    }
  }

  return { valid: true };
};

// Read and validate CSV file
export const readAndValidateCSV = filePath => {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content
      .replace(/^\uFEFF/, '')
      .split('\n')
      .filter(line => line.trim());

    return validateCSVStructure(lines);
  } catch (error) {
    return { valid: false, error: `Error reading CSV: ${error.message}` };
  }
};

// Validate before writing
export const validateBeforeWrite = (currentContent, newContent) => {
  // Validate current content
  const currentLines = currentContent.split('\n').filter(line => line.trim());
  const currentValidation = validateCSVStructure(currentLines);
  if (!currentValidation.valid) {
    return { valid: false, error: `Current CSV invalid: ${currentValidation.error}` };
  }

  // Validate new content
  const newLines = newContent.split('\n').filter(line => line.trim());
  const newValidation = validateCSVStructure(newLines);
  if (!newValidation.valid) {
    return { valid: false, error: `New CSV invalid: ${newValidation.error}` };
  }

  return { valid: true };
};
