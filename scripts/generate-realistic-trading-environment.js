// @ts-check
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE_URL = 'http://localhost:3000/api';
const API_KEY = 'IPTRADE_APIKEY';
const accountsConfigPath = join(__dirname, '..', 'server', 'config', 'registered_accounts.json');

const PLATFORMS = ['MT4', 'MT5'];
const BROKERS = ['IC Markets', 'XM', 'Pepperstone', 'FTMO', 'Admiral Markets', 'OANDA'];

function randomId(prefix) {
  return `${prefix}_${Math.floor(Math.random() * 900000 + 100000)}`;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadAccountsConfig() {
  if (!existsSync(accountsConfigPath)) {
    return { masterAccounts: {}, slaveAccounts: {}, pendingAccounts: {}, connections: {} };
  }
  return JSON.parse(readFileSync(accountsConfigPath, 'utf8'));
}

function saveAccountsConfig(config) {
  writeFileSync(accountsConfigPath, JSON.stringify(config, null, 2));
}

async function registerPendingAccount(accountId) {
  try {
    const res = await fetch(`${API_BASE_URL}/orders/account-type`, {
      method: 'GET',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      console.log(`✅ Registered pending: ${accountId}`);
      return true;
    } else {
      const txt = await res.text();
      console.error(`❌ Failed to register: ${accountId} (${txt})`);
      return false;
    }
  } catch (e) {
    console.error(`❌ Error registering: ${accountId}`, e.message);
    return false;
  }
}

async function pingAccount(accountId) {
  try {
    const res = await fetch(`${API_BASE_URL}/accounts/ping`, {
      method: 'POST',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'online', lastActivity: new Date().toISOString() }),
    });
    if (res.ok) {
      console.log(`📡 Ping: ${accountId}`);
      return true;
    } else {
      const txt = await res.text();
      console.error(`❌ Ping failed: ${accountId} (${txt})`);
      return false;
    }
  } catch (e) {
    console.error(`❌ Error pinging: ${accountId}`, e.message);
    return false;
  }
}

async function simulateOrderRequest(accountId) {
  try {
    const res = await fetch(`${API_BASE_URL}/orders/neworder`, {
      method: 'GET',
      headers: {
        'x-account-id': accountId,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      const txt = await res.text();
      console.log(`📥 Order check for ${accountId}: ${txt.slice(0, 40)}...`);
      return true;
    } else {
      const txt = await res.text();
      console.error(`❌ Order check failed: ${accountId} (${txt})`);
      return false;
    }
  } catch (e) {
    console.error(`❌ Error checking orders: ${accountId}`, e.message);
    return false;
  }
}

export async function main() {
  const config = loadAccountsConfig();
  if (!config.pendingAccounts) config.pendingAccounts = {};
  const pendingAccounts = {};
  for (let i = 0; i < 8; i++) {
    const platform = randomChoice(PLATFORMS);
    const broker = randomChoice(BROKERS);
    const id = randomId(platform);
    pendingAccounts[id] = {
      id,
      name: `${platform} Test Account ${i + 1}`,
      description: `Simulated ${platform} account for testing`,
      firstSeen: new Date(Date.now() - Math.random() * 3600_000).toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'pending',
      platform,
      broker,
    };
  }
  // Add to config
  let added = 0;
  for (const [id, acc] of Object.entries(pendingAccounts)) {
    if (
      !config.masterAccounts?.[id] &&
      !config.slaveAccounts?.[id] &&
      !config.pendingAccounts?.[id]
    ) {
      config.pendingAccounts[id] = acc;
      added++;
    }
  }
  saveAccountsConfig(config);
  console.log(`🚀 Added ${added} pending accounts.`);

  // Register and simulate activity
  for (const id of Object.keys(pendingAccounts)) {
    await registerPendingAccount(id);
    await pingAccount(id);
    await simulateOrderRequest(id);
  }
  console.log('✅ Simulación de entorno realista completada.');
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
