import { spawn } from 'child_process';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Mt5ApiService {
  constructor() {
    this.connections = new Map(); // userId -> connection info
    this.pythonScriptPath = join(__dirname, '..', 'python', 'mt5_connector.py');
    this.ensurePythonScript();

    console.log(`🐍 MT5 Python script path: ${this.pythonScriptPath}`);
  }

  // Ensure Python script exists
  ensurePythonScript() {
    const scriptDir = join(__dirname, '..', 'python');
    if (!fs.existsSync(scriptDir)) {
      fs.mkdirSync(scriptDir, { recursive: true });
    }

    if (!fs.existsSync(this.pythonScriptPath)) {
      this.createPythonScript();
    }
  }

  // Create the Python script for MT5 integration
  createPythonScript() {
    const pythonScript = `
import MetaTrader5 as mt5
import json
import sys
import time
from datetime import datetime
import pandas as pd

class MT5Connector:
    def __init__(self):
        self.connected = False
        self.account_info = None

    def initialize(self, terminal_path=None):
        """Initialize connection to MT5 terminal"""
        try:
            if terminal_path:
                if not mt5.initialize(path=terminal_path):
                    print(json.dumps({"error": "Failed to initialize MT5", "code": mt5.last_error()}))
                    return False
            else:
                if not mt5.initialize():
                    print(json.dumps({"error": "Failed to initialize MT5", "code": mt5.last_error()}))
                    return False

            self.connected = True
            print(json.dumps({"success": True, "message": "MT5 initialized successfully"}))
            return True
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return False

    def login(self, account, password, server):
        """Login to trading account"""
        try:
            if not mt5.login(account, password=password, server=server):
                error = mt5.last_error()
                print(json.dumps({"error": "Login failed", "code": error}))
                return False

            self.account_info = mt5.account_info()
            if self.account_info is None:
                print(json.dumps({"error": "Failed to get account info"}))
                return False

            account_data = {
                "login": self.account_info.login,
                "trade_mode": self.account_info.trade_mode,
                "name": self.account_info.name,
                "server": self.account_info.server,
                "currency": self.account_info.currency,
                "leverage": self.account_info.leverage,
                "balance": self.account_info.balance,
                "equity": self.account_info.equity,
                "margin": self.account_info.margin,
                "margin_free": self.account_info.margin_free,
                "margin_level": self.account_info.margin_level
            }

            print(json.dumps({"success": True, "account": account_data}))
            return True
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return False

    def get_account_info(self):
        """Get current account information"""
        try:
            account_info = mt5.account_info()
            if account_info is None:
                print(json.dumps({"error": "Failed to get account info"}))
                return None

            account_data = {
                "login": account_info.login,
                "trade_mode": account_info.trade_mode,
                "name": account_info.name,
                "server": account_info.server,
                "currency": account_info.currency,
                "leverage": account_info.leverage,
                "balance": account_info.balance,
                "equity": account_info.equity,
                "margin": account_info.margin,
                "margin_free": account_info.margin_free,
                "margin_level": account_info.margin_level,
                "profit": account_info.profit
            }

            print(json.dumps({"success": True, "account": account_data}))
            return account_data
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return None

    def get_positions(self):
        """Get current open positions"""
        try:
            positions = mt5.positions_get()
            if positions is None:
                print(json.dumps({"error": "Failed to get positions", "positions": []}))
                return []

            positions_list = []
            for pos in positions:
                position_data = {
                    "ticket": pos.ticket,
                    "time": pos.time,
                    "time_msc": pos.time_msc,
                    "time_update": pos.time_update,
                    "time_update_msc": pos.time_update_msc,
                    "type": pos.type,
                    "magic": pos.magic,
                    "identifier": pos.identifier,
                    "reason": pos.reason,
                    "volume": pos.volume,
                    "price_open": pos.price_open,
                    "sl": pos.sl,
                    "tp": pos.tp,
                    "price_current": pos.price_current,
                    "swap": pos.swap,
                    "profit": pos.profit,
                    "symbol": pos.symbol,
                    "comment": pos.comment,
                    "external_id": pos.external_id
                }
                positions_list.append(position_data)

            print(json.dumps({"success": True, "positions": positions_list}))
            return positions_list
        except Exception as e:
            print(json.dumps({"error": str(e), "positions": []}))
            return []

    def get_orders(self):
        """Get current pending orders"""
        try:
            orders = mt5.orders_get()
            if orders is None:
                print(json.dumps({"error": "Failed to get orders", "orders": []}))
                return []

            orders_list = []
            for order in orders:
                order_data = {
                    "ticket": order.ticket,
                    "time_setup": order.time_setup,
                    "time_setup_msc": order.time_setup_msc,
                    "time_expiration": order.time_expiration,
                    "type": order.type,
                    "type_time": order.type_time,
                    "type_filling": order.type_filling,
                    "state": order.state,
                    "magic": order.magic,
                    "position_id": order.position_id,
                    "position_by_id": order.position_by_id,
                    "reason": order.reason,
                    "volume_initial": order.volume_initial,
                    "volume_current": order.volume_current,
                    "price_open": order.price_open,
                    "sl": order.sl,
                    "tp": order.tp,
                    "price_current": order.price_current,
                    "price_stoplimit": order.price_stoplimit,
                    "symbol": order.symbol,
                    "comment": order.comment,
                    "external_id": order.external_id
                }
                orders_list.append(order_data)

            print(json.dumps({"success": True, "orders": orders_list}))
            return orders_list
        except Exception as e:
            print(json.dumps({"error": str(e), "orders": []}))
            return []

    def place_order(self, symbol, order_type, volume, price=None, sl=None, tp=None, comment="", magic=0):
        """Place a trading order"""
        try:
            # Prepare the trade request
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": float(volume),
                "type": int(order_type),
                "magic": int(magic),
                "comment": comment,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }

            # Add price for pending orders
            if price is not None:
                request["price"] = float(price)
                request["action"] = mt5.TRADE_ACTION_PENDING

            # Add stop loss and take profit
            if sl is not None:
                request["sl"] = float(sl)
            if tp is not None:
                request["tp"] = float(tp)

            # Send the order
            result = mt5.order_send(request)
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                print(json.dumps({"error": "Order failed", "retcode": result.retcode, "comment": result.comment}))
                return False

            order_result = {
                "retcode": result.retcode,
                "deal": result.deal,
                "order": result.order,
                "volume": result.volume,
                "price": result.price,
                "bid": result.bid,
                "ask": result.ask,
                "comment": result.comment,
                "request_id": result.request_id
            }

            print(json.dumps({"success": True, "result": order_result}))
            return True
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return False

    def close_position(self, ticket):
        """Close a position by ticket"""
        try:
            positions = mt5.positions_get(ticket=ticket)
            if not positions:
                print(json.dumps({"error": "Position not found"}))
                return False

            position = positions[0]

            # Determine opposite order type
            if position.type == mt5.POSITION_TYPE_BUY:
                order_type = mt5.ORDER_TYPE_SELL
            else:
                order_type = mt5.ORDER_TYPE_BUY

            # Close request
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": position.symbol,
                "volume": position.volume,
                "type": order_type,
                "position": ticket,
                "magic": position.magic,
                "comment": "Close position",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }

            result = mt5.order_send(request)
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                print(json.dumps({"error": "Failed to close position", "retcode": result.retcode}))
                return False

            print(json.dumps({"success": True, "message": "Position closed"}))
            return True
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return False

    def get_symbol_info(self, symbol):
        """Get symbol information"""
        try:
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info is None:
                print(json.dumps({"error": f"Symbol {symbol} not found"}))
                return None

            symbol_data = {
                "name": symbol_info.name,
                "basis": symbol_info.basis,
                "category": symbol_info.category,
                "currency_base": symbol_info.currency_base,
                "currency_profit": symbol_info.currency_profit,
                "currency_margin": symbol_info.currency_margin,
                "digits": symbol_info.digits,
                "trade_tick_value": symbol_info.trade_tick_value,
                "trade_tick_value_profit": symbol_info.trade_tick_value_profit,
                "trade_tick_value_loss": symbol_info.trade_tick_value_loss,
                "trade_tick_size": symbol_info.trade_tick_size,
                "trade_contract_size": symbol_info.trade_contract_size,
                "volume_min": symbol_info.volume_min,
                "volume_max": symbol_info.volume_max,
                "volume_step": symbol_info.volume_step,
                "spread": symbol_info.spread,
                "spread_float": symbol_info.spread_float,
                "trade_mode": symbol_info.trade_mode
            }

            print(json.dumps({"success": True, "symbol": symbol_data}))
            return symbol_data
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return None

    def shutdown(self):
        """Shutdown MT5 connection"""
        try:
            mt5.shutdown()
            self.connected = False
            print(json.dumps({"success": True, "message": "MT5 shutdown successfully"}))
        except Exception as e:
            print(json.dumps({"error": str(e)}))

def main():
    connector = MT5Connector()

    # Listen for commands
    while True:
        try:
            line = input()
            if not line:
                break

            command = json.loads(line)
            action = command.get('action')

            if action == 'initialize':
                connector.initialize(command.get('terminal_path'))
            elif action == 'login':
                connector.login(
                    command.get('account'),
                    command.get('password'),
                    command.get('server')
                )
            elif action == 'get_account_info':
                connector.get_account_info()
            elif action == 'get_positions':
                connector.get_positions()
            elif action == 'get_orders':
                connector.get_orders()
            elif action == 'place_order':
                connector.place_order(
                    command.get('symbol'),
                    command.get('order_type'),
                    command.get('volume'),
                    command.get('price'),
                    command.get('sl'),
                    command.get('tp'),
                    command.get('comment', ''),
                    command.get('magic', 0)
                )
            elif action == 'close_position':
                connector.close_position(command.get('ticket'))
            elif action == 'get_symbol_info':
                connector.get_symbol_info(command.get('symbol'))
            elif action == 'shutdown':
                connector.shutdown()
                break
            else:
                print(json.dumps({"error": "Unknown action"}))

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
`;

    fs.writeFileSync(this.pythonScriptPath, pythonScript);
    console.log(`✅ Created MT5 Python script at: ${this.pythonScriptPath}`);
  }

  // Initialize MT5 connection for a user
  async initializeMT5(userId, terminalPath = null) {
    try {
      console.log(`🚀 Initializing MT5 for user ${userId}`);

      // Start Python process
      const pythonProcess = spawn('python', [this.pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Store connection
      this.connections.set(userId, {
        process: pythonProcess,
        connected: false,
        accounts: [],
        lastActivity: Date.now(),
      });

      // Setup process handlers
      this.setupProcessHandlers(userId, pythonProcess);

      // Initialize MT5
      const initCommand = {
        action: 'initialize',
        terminal_path: terminalPath,
      };

      const result = await this.sendCommand(userId, initCommand);
      if (result.success) {
        const connection = this.connections.get(userId);
        connection.connected = true;
        console.log(`✅ MT5 initialized successfully for user ${userId}`);
        return { success: true, message: 'MT5 initialized successfully' };
      } else {
        throw new Error(result.error || 'Failed to initialize MT5');
      }
    } catch (error) {
      console.error(`❌ Failed to initialize MT5 for user ${userId}:`, error);
      this.connections.delete(userId);
      throw error;
    }
  }

  // Setup Python process handlers
  setupProcessHandlers(userId, pythonProcess) {
    pythonProcess.stderr.on('data', data => {
      console.error(`MT5 Python stderr for user ${userId}:`, data.toString());
    });

    pythonProcess.on('exit', code => {
      console.log(`MT5 Python process exited for user ${userId} with code: ${code}`);
      this.connections.delete(userId);
    });

    pythonProcess.on('error', error => {
      console.error(`MT5 Python process error for user ${userId}:`, error);
      this.connections.delete(userId);
    });
  }

  // Send command to Python process
  async sendCommand(userId, command) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(userId);
      if (!connection || !connection.process) {
        reject(new Error('No MT5 connection found for user'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000); // 30 seconds timeout

      // Listen for response
      const responseHandler = data => {
        try {
          const response = JSON.parse(data.toString().trim());
          clearTimeout(timeout);
          connection.process.stdout.removeListener('data', responseHandler);
          resolve(response);
        } catch (error) {
          // Keep listening if JSON parse fails (might be partial data)
        }
      };

      connection.process.stdout.on('data', responseHandler);

      // Send command
      connection.process.stdin.write(JSON.stringify(command) + '\n');
      connection.lastActivity = Date.now();
    });
  }

  // Login to MT5 account
  async loginToAccount(userId, account, password, server) {
    try {
      console.log(`🔐 Logging into MT5 account ${account} for user ${userId}`);

      const loginCommand = {
        action: 'login',
        account: parseInt(account),
        password: password,
        server: server,
      };

      const result = await this.sendCommand(userId, loginCommand);
      if (result.success) {
        const connection = this.connections.get(userId);
        connection.accounts.push(result.account);
        console.log(`✅ Successfully logged into MT5 account ${account}`);
        return result;
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error(`❌ Failed to login to MT5 account:`, error);
      throw error;
    }
  }

  // Get account information
  async getAccountInfo(userId) {
    try {
      const result = await this.sendCommand(userId, { action: 'get_account_info' });
      return result;
    } catch (error) {
      console.error(`❌ Failed to get account info for user ${userId}:`, error);
      throw error;
    }
  }

  // Get positions
  async getPositions(userId) {
    try {
      const result = await this.sendCommand(userId, { action: 'get_positions' });
      return result;
    } catch (error) {
      console.error(`❌ Failed to get positions for user ${userId}:`, error);
      throw error;
    }
  }

  // Get orders
  async getOrders(userId) {
    try {
      const result = await this.sendCommand(userId, { action: 'get_orders' });
      return result;
    } catch (error) {
      console.error(`❌ Failed to get orders for user ${userId}:`, error);
      throw error;
    }
  }

  // Place order
  async placeOrder(
    userId,
    symbol,
    orderType,
    volume,
    price = null,
    sl = null,
    tp = null,
    comment = '',
    magic = 0
  ) {
    try {
      const orderCommand = {
        action: 'place_order',
        symbol: symbol,
        order_type: orderType,
        volume: volume,
        price: price,
        sl: sl,
        tp: tp,
        comment: comment,
        magic: magic,
      };

      const result = await this.sendCommand(userId, orderCommand);
      return result;
    } catch (error) {
      console.error(`❌ Failed to place order for user ${userId}:`, error);
      throw error;
    }
  }

  // Close position
  async closePosition(userId, ticket) {
    try {
      const result = await this.sendCommand(userId, {
        action: 'close_position',
        ticket: ticket,
      });
      return result;
    } catch (error) {
      console.error(`❌ Failed to close position for user ${userId}:`, error);
      throw error;
    }
  }

  // Get symbol information
  async getSymbolInfo(userId, symbol) {
    try {
      const result = await this.sendCommand(userId, {
        action: 'get_symbol_info',
        symbol: symbol,
      });
      return result;
    } catch (error) {
      console.error(`❌ Failed to get symbol info for user ${userId}:`, error);
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus(userId) {
    const connection = this.connections.get(userId);
    if (!connection) {
      return {
        connected: false,
        accounts: [],
        lastActivity: null,
      };
    }

    return {
      connected: connection.connected,
      accounts: connection.accounts,
      lastActivity: connection.lastActivity,
    };
  }

  // Disconnect user
  async disconnect(userId) {
    try {
      const connection = this.connections.get(userId);
      if (connection && connection.process) {
        // Send shutdown command
        await this.sendCommand(userId, { action: 'shutdown' });

        // Kill process if still running
        setTimeout(() => {
          if (connection.process && !connection.process.killed) {
            connection.process.kill();
          }
        }, 5000);
      }

      this.connections.delete(userId);
      console.log(`🔌 Disconnected MT5 for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error disconnecting MT5 for user ${userId}:`, error);
      // Force cleanup
      this.connections.delete(userId);
    }
  }

  // Check if user is connected
  isConnected(userId) {
    const connection = this.connections.get(userId);
    return connection && connection.connected;
  }

  // Get all connected users
  getConnectedUsers() {
    return Array.from(this.connections.keys()).filter(userId => this.isConnected(userId));
  }

  // Cleanup inactive connections
  cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [userId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > inactiveTimeout) {
        console.log(`🧹 Cleaning up inactive MT5 connection for user ${userId}`);
        this.disconnect(userId);
      }
    }
  }
}

// Create singleton instance
const Mt5ApiServiceInstance = new Mt5ApiService();

// Cleanup inactive connections every 10 minutes
setInterval(
  () => {
    Mt5ApiServiceInstance.cleanupInactiveConnections();
  },
  10 * 60 * 1000
);

export default Mt5ApiServiceInstance;
