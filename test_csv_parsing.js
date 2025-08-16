import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test the CSV2 parsing logic
function parseCSV2Format(lines, filePath, currentTime) {
  try {
    if (lines.length < 3) return null; // Need at least TYPE, STATUS, CONFIG lines

    let typeData = null;
    let statusData = null;
    let configData = null;

    // Parse each line looking for the CSV2 format
    for (const line of lines) {
      console.log(`DEBUG: Processing line: "${line}"`);

      // Handle both formats: [TYPE] and [TYPE] (with spaces)
      if (line.includes('[TYPE]')) {
        console.log(`DEBUG: Found TYPE line: "${line}"`);
        const matches = line.match(/\[([^\]]+)\]/g);
        console.log(`DEBUG: TYPE matches:`, matches);
        if (matches && matches.length >= 4) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          console.log(`DEBUG: TYPE values:`, values);
          typeData = {
            type: values[1], // PENDING, MASTER, SLAVE
            platform: values[2], // MT4, MT5, CTRADER
            accountId: values[3], // Account ID
          };
          console.log(`DEBUG: Parsed TYPE data:`, typeData);
        }
      } else if (line.includes('[STATUS]')) {
        console.log(`DEBUG: Found STATUS line: "${line}"`);
        const matches = line.match(/\[([^\]]+)\]/g);
        console.log(`DEBUG: STATUS matches:`, matches);
        if (matches && matches.length >= 3) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          console.log(`DEBUG: STATUS values:`, values);
          statusData = {
            status: values[1], // ONLINE, OFFLINE
            timestamp: parseInt(values[2]), // Unix timestamp
          };
          console.log(`DEBUG: Parsed STATUS data:`, statusData);
        }
      } else if (line.includes('[CONFIG]')) {
        console.log(`DEBUG: Found CONFIG line: "${line}"`);
        const matches = line.match(/\[([^\]]+)\]/g);
        console.log(`DEBUG: CONFIG matches:`, matches);
        if (matches && matches.length >= 2) {
          const values = matches.map(m => m.replace(/[\[\]]/g, '').trim());
          console.log(`DEBUG: CONFIG values:`, values);
          configData = {
            configType: values[1], // PENDING, MASTER, SLAVE
            details: values.slice(2), // Additional config details
          };
          console.log(`DEBUG: Parsed CONFIG data:`, configData);
        }
      }
    }

    // Check if this is a pending account in CSV2 format
    console.log(`DEBUG: Final parsed data:`, { typeData, statusData, configData });
    console.log(`DEBUG: Type check: typeData.type === 'PENDING': ${typeData?.type === 'PENDING'}`);
    console.log(
      `DEBUG: Config check: configData.configType === 'PENDING': ${configData?.configType === 'PENDING'}`
    );

    if (
      typeData &&
      statusData &&
      configData &&
      (typeData.type === 'PENDING' || configData.configType === 'PENDING')
    ) {
      const accountTime = statusData.timestamp * 1000; // Convert to milliseconds
      const timeDiff = (currentTime - accountTime) / 1000; // Difference in seconds

      // Only include if not older than 1 hour
      if (timeDiff <= 3600) {
        const account = {
          account_id: typeData.accountId,
          platform: typeData.platform,
          account_type: 'pending',
          status: timeDiff <= 5 ? 'online' : 'offline',
          current_status: timeDiff <= 5 ? 'online' : 'offline',
          timestamp: statusData.timestamp,
          timeDiff: timeDiff,
          filePath: filePath,
          format: 'csv2',
        };

        console.log(
          `📱 Found CSV2 pending account ${account.account_id} (${account.platform}) - ${account.status} (${timeDiff.toFixed(1)}s ago)`
        );
        return account;
      } else {
        console.log(
          `⏰ Ignoring CSV2 account ${typeData.accountId} - too old (${(timeDiff / 60).toFixed(1)} minutes)`
        );
      }
    }

    return null;
  } catch (error) {
    console.error(`Error parsing CSV2 format in ${filePath}:`, error);
    return null;
  }
}

// Test function
function testCSVParsing() {
  console.log('🧪 Testing CSV2 parsing...\n');

  const currentTime = new Date();

  // Test file with spaces
  console.log('📄 Testing file with spaces:');
  const testFile1 = path.join(__dirname, 'csv_data', 'test_csv2_master.csv');
  if (fs.existsSync(testFile1)) {
    const content1 = fs.readFileSync(testFile1, 'utf8');
    const lines1 = content1.split('\n').filter(line => line.trim());
    console.log('File content:', content1);
    const result1 = parseCSV2Format(lines1, testFile1, currentTime);
    console.log('Result:', result1);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test file without spaces
  console.log('📄 Testing file without spaces:');
  const testFile2 = path.join(__dirname, 'csv_data', 'test_csv2_pending.csv');
  if (fs.existsSync(testFile2)) {
    const content2 = fs.readFileSync(testFile2, 'utf8');
    const lines2 = content2.split('\n').filter(line => line.trim());
    console.log('File content:', content2);
    const result2 = parseCSV2Format(lines2, testFile2, currentTime);
    console.log('Result:', result2);
  }
}

// Run the test
testCSVParsing();
