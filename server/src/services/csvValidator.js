// CSV2 Format Validator
// Validates the structure and content of IPTRADECSV2 files

const validateCSVLine = line => {
  if (!line || typeof line !== 'string') return false;

  // Check basic bracket format [TYPE] [VALUE]
  const bracketPattern = /^\[([^\]]+)\]\s*(\[[^\]]+\])*$/;
  if (!bracketPattern.test(line)) return false;

  // Extract all bracketed values
  const values = line.match(/\[([^\]]+)\]/g)?.map(v => v.replace(/[\[\]]/g, '').trim());
  if (!values || values.length < 2) return false;

  return values;
};

const validateOrderLine = values => {
  if (values.length !== 9) return false;

  const [type, ticket, symbol, orderType, volume, openPrice, sl, tp, timestamp] = values;

  // Basic type check
  if (type !== 'ORDER') return false;

  // Validate numeric values
  if (!/^\d+$/.test(ticket)) return false;
  if (!/^\d+(\.\d+)?$/.test(volume)) return false;
  if (!/^\d+(\.\d+)?$/.test(openPrice)) return false;
  if (!/^\d+(\.\d+)?$/.test(sl)) return false;
  if (!/^\d+(\.\d+)?$/.test(tp)) return false;
  if (!/^\d+$/.test(timestamp)) return false;

  // Validate order type
  const validOrderTypes = ['BUY', 'SELL', 'BUYLIMIT', 'SELLLIMIT', 'BUYSTOP', 'SELLSTOP'];
  if (!validOrderTypes.includes(orderType)) return false;

  return true;
};

const validateCSVStructure = lines => {
  if (!Array.isArray(lines) || lines.length < 3) {
    return { valid: false, error: 'CSV must have at least TYPE, STATUS, and CONFIG lines' };
  }

  // Validate TYPE line
  const typeValues = validateCSVLine(lines[0]);
  if (
    !typeValues ||
    typeValues[0] !== 'TYPE' ||
    !['MT4', 'MT5', 'CTRADER'].includes(typeValues[1]) ||
    !/^\d+$/.test(typeValues[2])
  ) {
    return { valid: false, error: 'Invalid TYPE line format' };
  }

  // Validate STATUS line
  const statusValues = validateCSVLine(lines[1]);
  if (
    !statusValues ||
    statusValues[0] !== 'STATUS' ||
    !['ONLINE', 'OFFLINE'].includes(statusValues[1]) ||
    !/^\d+$/.test(statusValues[2])
  ) {
    return { valid: false, error: 'Invalid STATUS line format' };
  }

  // Validate CONFIG line
  const configValues = validateCSVLine(lines[2]);
  if (!configValues || configValues[0] !== 'CONFIG') {
    return { valid: false, error: 'Invalid CONFIG line format' };
  }

  // Validate ORDER lines (if any) - account type will be determined from CONFIG line
  if (lines.length > 3) {
    for (let i = 3; i < lines.length; i++) {
      const orderValues = validateCSVLine(lines[i]);
      if (orderValues && orderValues[0] === 'ORDER' && !validateOrderLine(orderValues)) {
        return { valid: false, error: `Invalid ORDER line format at line ${i + 1}` };
      }
    }
  }

  return { valid: true };
};

const readAndValidateCSV = content => {
  try {
    // Remove BOM and special characters, split into lines
    const sanitizedContent = content.replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lines = sanitizedContent.split('\n').filter(line => line.trim());

    return validateCSVStructure(lines);
  } catch (error) {
    return { valid: false, error: `Error reading CSV: ${error.message}` };
  }
};

module.exports = {
  validateCSVLine,
  validateOrderLine,
  validateCSVStructure,
  readAndValidateCSV,
};
