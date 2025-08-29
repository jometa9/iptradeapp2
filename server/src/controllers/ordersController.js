import { exec } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFile,
  readFileSync,
  rename,
  writeFile,
  writeFileSync,
} from 'fs';
import { join } from 'path';

import { detectOrderChanges } from '../services/orderChangeDetector.js';
import {
  getSlaveConnection,
  isMasterAccountRegistered,
  isSlaveAccountRegistered,
} from './accountsController.js';
import { isCopierEnabled } from './copierStatusController.js';
import { applySlaveTransformations } from './slaveConfigController.js';
import { applyTransformations } from './tradingConfigController.js';

// CSV file management per account
const csvBaseDir = join(process.cwd(), 'accounts');
const writeQueues = new Map(); // Queue per account
const writingStatus = new Map(); // Writing status per account

// Configuration file management
const configBaseDir = join(process.cwd(), 'config');
const configFilePath = join(configBaseDir, 'slave_master_mapping.json');

// Initialize accounts directory if it doesn't exist
if (!existsSync(csvBaseDir)) {
  mkdirSync(csvBaseDir, { recursive: true });
}

// Helper function to load configuration
const loadSlaveConfiguration = () => {
  try {
    if (!existsSync(configFilePath)) {
      return {};
    }
    const data = readFileSync(configFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading slave configuration:', error);
    return {};
  }
};

// Helper function to get CSV path for specific account
const getAccountCsvPath = accountId => {
  return join(csvBaseDir, `account_${accountId}.csv`);
};

// Initialize CSV file for account if it doesn't exist
const initializeAccountCsv = accountId => {
  const csvPath = getAccountCsvPath(accountId);
  if (!existsSync(csvPath)) {
    writeFileSync(csvPath, '0');
  }
  return csvPath;
};

// Kill process utility - Enhanced to be more aggressive and reliable
export function killProcessOnPort(port) {
  return new Promise(resolve => {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows implementation
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve();
          return;
        }

        const lines = stdout.split('\n');
        const pidMap = new Map();

        // More precise filtering to only find processes LISTENING on the exact port
        lines.forEach(line => {
          // Only consider lines with this exact port and in LISTENING state
          if (line.includes(`LISTENING`) && line.includes(`:${port} `)) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== process.pid.toString()) {
              pidMap.set(pid, true);
            }
          }
        });

        const pids = Array.from(pidMap.keys());

        if (pids.length > 0) {
          const killPromises = pids.map(pid => {
            return new Promise(killResolve => {
              exec(`taskkill /PID ${pid} /F`, killError => {
                killResolve();
              });
            });
          });

          Promise.all(killPromises).then(() => {
            // Wait a bit to ensure processes are fully terminated
            setTimeout(() => resolve(), 1000);
          });
        } else {
          resolve();
        }
      });
    } else {
      // Unix/Linux/macOS implementation - More thorough approach
      // First try to find processes using the port
      exec(`lsof -i:${port} -t`, (error, stdout) => {
        let pids = [];

        if (!error && stdout) {
          pids = stdout
            .trim()
            .split('\n')
            .filter(pid => pid && !isNaN(pid) && pid !== process.pid.toString());
        }

        // If no processes found with lsof, try a more aggressive approach
        if (pids.length === 0) {
          // Try netstat approach (Linux)
          exec(
            `netstat -anp 2>/dev/null | grep :${port} | awk '{print $7}' | cut -d'/' -f1`,
            (netstatError, netstatStdout) => {
              if (!netstatError && netstatStdout) {
                const netstatPids = netstatStdout
                  .trim()
                  .split('\n')
                  .filter(pid => pid && !isNaN(pid) && pid !== process.pid.toString());
                pids = [...new Set([...pids, ...netstatPids])];
              }

              // If still no processes, try macOS-specific approach
              if (pids.length === 0 && process.platform === 'darwin') {
                exec(`lsof -ti:${port}`, (macError, macStdout) => {
                  if (!macError && macStdout) {
                    const macPids = macStdout
                      .trim()
                      .split('\n')
                      .filter(pid => pid && !isNaN(pid) && pid !== process.pid.toString());
                    pids = [...new Set([...pids, ...macPids])];
                  }
                  killProcesses(pids);
                });
              } else {
                killProcesses(pids);
              }
            }
          );
        } else {
          killProcesses(pids);
        }

        function killProcesses(pidsToKill) {
          if (pidsToKill.length > 0) {
            const killPromises = pidsToKill.map(pid => {
              return new Promise(killResolve => {
                // First try SIGTERM (graceful)
                exec(`kill ${pid}`, killError => {
                  if (killError) {
                    // If SIGTERM fails, use SIGKILL (force)
                    exec(`kill -9 ${pid}`, forceKillError => {
                      killResolve();
                    });
                  } else {
                    killResolve();
                  }
                });
              });
            });

            Promise.all(killPromises).then(() => {
              // Wait a bit to ensure processes are fully terminated
              setTimeout(() => resolve(), 1000);
            });
          } else {
            resolve();
          }
        }
      });
    }
  });
}

// Load existing orders from CSV for specific account
const loadExistingOrders = async accountId => {
  const csvPath = getAccountCsvPath(accountId);
  if (!existsSync(csvPath)) return {};

  // Use async file reading to avoid EBUSY errors
  const data = await new Promise((resolve, reject) => {
    readFile(csvPath, 'utf8', (err, content) => {
      if (err) {
        if (err.code === 'EBUSY' || err.code === 'EACCES') {
          resolve(''); // Return empty string if file is busy
        } else {
          reject(err);
        }
      } else {
        resolve(content);
      }
    });
  }).then(content => content.trim());
  if (!data) return {};
  let orders = {};
  const lines = data.match(/\[(.*?)\]/g) || [];
  for (const line of lines) {
    const parts = line.replace(/\[|\]/g, '').split(',');
    if (parts.length >= 8) {
      const orderId = parts[0];
      const timestamp = parts[7];
      orders[orderId] = timestamp;
    }
  }
  return orders;
};

// Queue management for file writing per account
function enqueueWrite(accountId, data, callback) {
  if (!writeQueues.has(accountId)) {
    writeQueues.set(accountId, []);
  }
  writeQueues.get(accountId).push({ data, callback });
  processQueue(accountId);
}

function processQueue(accountId) {
  const queue = writeQueues.get(accountId);
  const isWriting = writingStatus.get(accountId) || false;

  if (isWriting || !queue || queue.length === 0) return;

  const { data, callback } = queue.shift();
  writingStatus.set(accountId, true);

  const csvPath = getAccountCsvPath(accountId);
  const tmpPath = csvPath + '.tmp';

  writeFile(tmpPath, data, err => {
    if (err) {
      writingStatus.set(accountId, false);
      callback(err);
      processQueue(accountId);
      return;
    }
    rename(tmpPath, csvPath, errRename => {
      writingStatus.set(accountId, false);
      callback(errRename);
      processQueue(accountId);
    });
  });
}

// Controller for creating new orders
export const createNewOrder = (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).send('Error: No data received');
  }

  // Get authenticated account info from middleware
  const authenticatedAccountId = req.accountInfo.accountId;
  const accountType = req.accountInfo.type;

  // Extract account ID from the first order's account parameter
  const accountId = req.body.account0 || authenticatedAccountId;

  // Verify that the account in the request matches the authenticated account
  if (accountId !== authenticatedAccountId) {
    return res.status(403).json({
      error: `Account mismatch. Authenticated as ${authenticatedAccountId} but trying to create order for ${accountId}`,
    });
  }

  // Double-check that this is indeed a master account (redundant but safe)
  if (accountType !== 'master') {
    return res.status(403).json({
      error: `Only master accounts can create orders. Account ${accountId} is configured as ${accountType}`,
    });
  }

  // Validate that the master account is registered
  if (!isMasterAccountRegistered(accountId)) {
    return res.status(403).json({
      error: `Master account ${accountId} is not registered. Please register the account first.`,
    });
  }

  // Initialize CSV for this account if it doesn't exist
  initializeAccountCsv(accountId);

  const counter = req.body.counter || '0';
  let csvContent = `[${counter}]`;
  const existingOrders = loadExistingOrders(accountId);
  let i = 0;
  let ordersFound = 0;

  while (req.body[`id${i}`] !== undefined) {
    const orderId = req.body[`id${i}`];
    const symbol = req.body[`sym${i}`];
    const type = req.body[`typ${i}`];
    const lot = req.body[`lot${i}`];
    const price = req.body[`price${i}`];
    const sl = req.body[`sl${i}`];
    const tp = req.body[`tp${i}`];
    const account = req.body[`account${i}`] || accountId;

    // Create order data object for transformations
    const orderData = {
      orderId,
      symbol,
      type,
      lot,
      price,
      sl,
      tp,
      account,
    };

    // Apply transformations based on master account configuration
    const transformedOrder = applyTransformations(orderData, accountId);

    const cleanTp = transformedOrder.tp ? transformedOrder.tp.replace(/\0/g, '') : '0.00000';
    const timestamp = existingOrders[orderId] || Math.floor(Date.now() / 1000);

    const line = [
      transformedOrder.orderId,
      transformedOrder.symbol,
      transformedOrder.type,
      transformedOrder.lot,
      transformedOrder.price,
      transformedOrder.sl,
      cleanTp,
      timestamp,
      transformedOrder.account,
    ].join(',');

    csvContent += `\n[${line}]`;
    ordersFound++;
    i++;
  }

  enqueueWrite(accountId, csvContent, err => {
    if (err) {
      console.error(`Error writing CSV for account ${accountId}:`, err);
      return res.status(500).send(`Error writing CSV for account ${accountId}`);
    }
    res.status(200).send('OK');
  });
};

// Controller for getting orders
export const getOrders = (req, res) => {
  // Get authenticated account info from middleware
  const authenticatedAccountId = req.accountInfo.accountId;
  const accountType = req.accountInfo.type;

  // Get slave account ID from query parameter or use authenticated account
  const slaveId = req.query.account || authenticatedAccountId;

  // Verify that the account in the request matches the authenticated account
  if (slaveId !== authenticatedAccountId) {
    return res.status(403).json({
      error: `Account mismatch. Authenticated as ${authenticatedAccountId} but trying to get orders for ${slaveId}`,
    });
  }

  // Double-check that this is indeed a slave account (redundant but safe)
  if (accountType !== 'slave') {
    return res.status(403).json({
      error: `Only slave accounts can retrieve orders. Account ${slaveId} is configured as ${accountType}`,
    });
  }

  // Validate that the slave account is registered
  if (!isSlaveAccountRegistered(slaveId)) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('0'); // Return empty content if slave is not registered
  }

  // Get master account connection for this slave
  const masterAccount = getSlaveConnection(slaveId);

  if (!masterAccount) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('0'); // Return empty content if no master is configured
  }

  // Validate that the master account is also registered
  if (!isMasterAccountRegistered(masterAccount)) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('0'); // Return empty content if master is not registered
  }

  // Check if copier is enabled for this master account
  const copierEnabled = isCopierEnabled(masterAccount, apiKey);
  if (!copierEnabled) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('0'); // Return empty content when copier is disabled
  }

  // Get the CSV path for the master account
  const csvPath = getAccountCsvPath(masterAccount);

  readFile(csvPath, 'utf8', (err, data) => {
    if (err) {
      // If master's file doesn't exist, return empty content
      if (err.code === 'ENOENT') {
        res.setHeader('Content-Type', 'text/plain');
        return res.send('0');
      }
      return res.status(500).send(`Error reading CSV for master account ${masterAccount}`);
    }

    // Detect if there are actual order changes
    const changes = detectOrderChanges(masterAccount, data);
    if (!changes.hasChanges) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('0');
    }

    // Clean data and apply slave transformations
    data = data.replace(/\r/g, '');

    // Parse the CSV data and apply slave-specific transformations
    try {
      const lines = data.match(/\[(.*?)\]/g) || [];
      if (lines.length === 0) {
        res.setHeader('Content-Type', 'text/plain');
        return res.send('0');
      }

      let transformedContent = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i === 0) {
          // First line is the counter, keep it as is
          transformedContent += line;
          continue;
        }

        // Parse order data from CSV line
        const parts = line.replace(/\[|\]/g, '').split(',');
        if (parts.length >= 8) {
          const orderData = {
            orderId: parts[0],
            symbol: parts[1],
            type: parts[2],
            lot: parts[3],
            price: parts[4],
            sl: parts[5],
            tp: parts[6],
            account: parts[8] || masterAccount,
          };

          // Apply slave-specific transformations
          const transformedOrder = applySlaveTransformations(orderData, slaveId);

          // If transformations return null, skip this order (filtered out)
          if (transformedOrder === null) {
            continue;
          }

          // Reconstruct the CSV line with transformed data
          const transformedLine = [
            transformedOrder.orderId,
            transformedOrder.symbol,
            transformedOrder.type,
            transformedOrder.lot,
            transformedOrder.price,
            transformedOrder.sl,
            transformedOrder.tp,
            parts[7], // Keep original timestamp
            transformedOrder.account,
          ].join(',');

          transformedContent += `\n[${transformedLine}]`;
        }
      }

      // If no orders passed the filter, return only counter (master online but no orders)
      if (transformedContent === lines[0]) {
        res.setHeader('Content-Type', 'text/plain');
        return res.send(lines[0]); // Return only the counter [X]
      }

      res.setHeader('Content-Type', 'text/plain');
      res.send(transformedContent);
    } catch (parseError) {
      console.error(`Error parsing CSV data for slave ${slaveId}:`, parseError);
      res.setHeader('Content-Type', 'text/plain');
      res.send(data); // Fall back to original data if parsing fails
    }
  });
};

// The killProcessOnPort function is already exported above (line 65)
