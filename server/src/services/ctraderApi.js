import WebSocket from 'ws';

import CtraderAuthService from './ctraderAuth.js';

class CtraderApiService {
  constructor() {
    this.connections = new Map(); // userId -> WebSocket connection
    this.apiUrl = process.env.CTRADER_API_URL || 'wss://api.ctraderapi.com/apps/trading';
    this.keepAliveInterval = 30000; // 30 seconds
  }

  // Create WebSocket connection for user
  async createConnection(userId) {
    try {
      // Get valid access token
      const accessToken = await CtraderAuthService.getValidAccessToken(userId);

      // Create WebSocket connection with authorization
      const ws = new WebSocket(this.apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Setup connection handlers
      this.setupConnectionHandlers(ws, userId);

      // Store connection
      this.connections.set(userId, {
        ws,
        userId,
        connected: false,
        lastHeartbeat: Date.now(),
        accounts: [],
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          console.log(`✅ cTrader WebSocket connected for user ${userId}`);
          this.connections.get(userId).connected = true;
          resolve(this.connections.get(userId));
        });

        ws.on('error', error => {
          clearTimeout(timeout);
          console.error(`❌ cTrader WebSocket error for user ${userId}:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`Failed to create cTrader connection for user ${userId}:`, error);
      throw error;
    }
  }

  // Setup WebSocket event handlers
  setupConnectionHandlers(ws, userId) {
    ws.on('open', () => {
      console.log(`cTrader WebSocket opened for user ${userId}`);
      this.startKeepAlive(userId);
      this.sendApplicationAuth(userId);
    });

    ws.on('message', data => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(userId, message);
      } catch (error) {
        console.error(`Error parsing message for user ${userId}:`, error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`cTrader WebSocket closed for user ${userId}:`, code, reason);
      this.handleDisconnection(userId);
    });

    ws.on('error', error => {
      console.error(`cTrader WebSocket error for user ${userId}:`, error);
      this.handleDisconnection(userId);
    });
  }

  // Send application authentication
  async sendApplicationAuth(userId) {
    try {
      const connection = this.connections.get(userId);
      if (!connection?.ws) return;

      const accessToken = await CtraderAuthService.getValidAccessToken(userId);

      const authMessage = {
        payloadType: 2100, // ProtoOAApplicationAuthReq
        payload: {
          clientId: process.env.CTRADER_CLIENT_ID,
          clientSecret: process.env.CTRADER_CLIENT_SECRET,
        },
      };

      this.sendMessage(userId, authMessage);
    } catch (error) {
      console.error(`Failed to send application auth for user ${userId}:`, error);
    }
  }

  // Handle incoming messages
  handleMessage(userId, message) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    console.log(`📨 cTrader message for user ${userId}:`, message.payloadType);

    switch (message.payloadType) {
      case 2101: // ProtoOAApplicationAuthRes
        this.handleApplicationAuthResponse(userId, message.payload);
        break;
      case 2103: // ProtoOAAccountAuthRes
        this.handleAccountAuthResponse(userId, message.payload);
        break;
      case 2141: // ProtoOAAccountsListRes
        this.handleAccountsListResponse(userId, message.payload);
        break;
      case 2131: // ProtoOAExecutionEvent
        this.handleExecutionEvent(userId, message.payload);
        break;
      case 2133: // ProtoOAOrderEvent
        this.handleOrderEvent(userId, message.payload);
        break;
      case 50: // ProtoHeartbeatEvent
        this.handleHeartbeat(userId);
        break;
      default:
        console.log(`🔄 Unhandled message type ${message.payloadType} for user ${userId}`);
    }
  }

  // Handle application authentication response
  handleApplicationAuthResponse(userId, payload) {
    console.log(`✅ Application authenticated for user ${userId}`);
    this.requestAccountsList(userId);
  }

  // Handle account authentication response
  handleAccountAuthResponse(userId, payload) {
    console.log(`✅ Account authenticated for user ${userId}:`, payload.ctidTraderAccountId);
  }

  // Handle accounts list response
  handleAccountsListResponse(userId, payload) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    const accounts = payload.ctidTraderAccount || [];
    connection.accounts = accounts.map(account => ({
      accountId: account.ctidTraderAccountId,
      accountNumber: account.traderLogin,
      brokerName: account.brokerName,
      depositAssetId: account.depositAssetId,
      tradingMode: account.tradingMode,
      accountType: account.accountType,
      live: account.live,
    }));

    // Update stored accounts in auth service
    CtraderAuthService.updateUserAccounts(userId, connection.accounts);

    console.log(`📋 Updated accounts for user ${userId}:`, connection.accounts.length);
  }

  // Handle execution events (trades)
  handleExecutionEvent(userId, payload) {
    console.log(`🔄 Execution event for user ${userId}:`, payload);
    // Here you would implement your copy trading logic
    // This is where trades from master accounts would be detected and copied
  }

  // Handle order events
  handleOrderEvent(userId, payload) {
    console.log(`📋 Order event for user ${userId}:`, payload);
    // Handle order status changes, modifications, cancellations
  }

  // Handle heartbeat
  handleHeartbeat(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.lastHeartbeat = Date.now();
    }
  }

  // Request accounts list
  requestAccountsList(userId) {
    const message = {
      payloadType: 2140, // ProtoOAAccountsListReq
      payload: {},
    };
    this.sendMessage(userId, message);
  }

  // Authenticate trading account
  authenticateAccount(userId, accountId) {
    const message = {
      payloadType: 2102, // ProtoOAAccountAuthReq
      payload: {
        ctidTraderAccountId: accountId,
      },
    };
    this.sendMessage(userId, message);
  }

  // Send message through WebSocket
  sendMessage(userId, message) {
    const connection = this.connections.get(userId);
    if (!connection?.ws || connection.ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message to user ${userId}: connection not open`);
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to user ${userId}:`, error);
      return false;
    }
  }

  // Place new order
  async placeOrder(userId, accountId, orderData) {
    const message = {
      payloadType: 2126, // ProtoOANewOrderReq
      payload: {
        ctidTraderAccountId: accountId,
        symbolId: orderData.symbolId,
        orderType: orderData.orderType,
        tradeSide: orderData.tradeSide,
        volume: orderData.volume,
        limitPrice: orderData.limitPrice,
        stopPrice: orderData.stopPrice,
        timeInForce: orderData.timeInForce || 'GOOD_TILL_CANCEL',
        stopLoss: orderData.stopLoss,
        takeProfit: orderData.takeProfit,
        comment: orderData.comment,
      },
    };

    return this.sendMessage(userId, message);
  }

  // Modify existing order
  async modifyOrder(userId, accountId, orderId, modifications) {
    const message = {
      payloadType: 2128, // ProtoOAAmendOrderReq
      payload: {
        ctidTraderAccountId: accountId,
        orderId: orderId,
        ...modifications,
      },
    };

    return this.sendMessage(userId, message);
  }

  // Cancel order
  async cancelOrder(userId, accountId, orderId) {
    const message = {
      payloadType: 2130, // ProtoOACancelOrderReq
      payload: {
        ctidTraderAccountId: accountId,
        orderId: orderId,
      },
    };

    return this.sendMessage(userId, message);
  }

  // Close position
  async closePosition(userId, accountId, positionId, volume) {
    const message = {
      payloadType: 2132, // ProtoOAClosePositionReq
      payload: {
        ctidTraderAccountId: accountId,
        positionId: positionId,
        volume: volume,
      },
    };

    return this.sendMessage(userId, message);
  }

  // Start keep-alive mechanism
  startKeepAlive(userId) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    connection.keepAliveTimer = setInterval(() => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          payloadType: 51, // ProtoHeartbeatEvent
          payload: {},
        };
        this.sendMessage(userId, heartbeat);
      }
    }, this.keepAliveInterval);
  }

  // Handle disconnection
  handleDisconnection(userId) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    if (connection.keepAliveTimer) {
      clearInterval(connection.keepAliveTimer);
    }

    connection.connected = false;
    console.log(`🔌 User ${userId} disconnected from cTrader`);
  }

  // Get connection status
  getConnectionStatus(userId) {
    const connection = this.connections.get(userId);
    return {
      connected: connection?.connected || false,
      accounts: connection?.accounts || [],
      lastHeartbeat: connection?.lastHeartbeat,
    };
  }

  // Disconnect user
  disconnect(userId) {
    const connection = this.connections.get(userId);
    if (connection?.ws) {
      connection.ws.close();
    }
    this.connections.delete(userId);
  }

  // Get user accounts
  getUserAccounts(userId) {
    const connection = this.connections.get(userId);
    return connection?.accounts || [];
  }
}

export default new CtraderApiService();
