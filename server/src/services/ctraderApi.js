import dotenv from 'dotenv';
import { join } from 'path';
import WebSocket from 'ws';

import CtraderAuthService from './ctraderAuth.js';

// Ensure environment variables are loaded
dotenv.config({ path: join(process.cwd(), 'server', '.env') });

class CtraderApiService {
  constructor() {
    this.connections = new Map(); // userId -> WebSocket connection
    this.keepAliveInterval = 10000; // 10 seconds as per cTrader documentation

    // Conservative WebSocket endpoints (based on official documentation structure)
    this.wsEndpoints = {
      live: 'wss://live.ctraderapi.com:5035',
      demo: 'wss://demo.ctraderapi.com:5035',
    };

    console.log(`🌐 cTrader WebSocket Live: ${this.wsEndpoints.live}`);
    console.log(`🌐 cTrader WebSocket Demo: ${this.wsEndpoints.demo}`);
    console.log(`⏰ Keep alive interval: ${this.keepAliveInterval}ms`);

    // Verify cTrader credentials
    this.verifyCredentials();
  }

  // Verify cTrader credentials are configured
  verifyCredentials() {
    const clientId = process.env.CTRADER_CLIENT_ID;
    const clientSecret = process.env.CTRADER_CLIENT_SECRET;

    console.log(`🔍 Verifying cTrader credentials...`);
    console.log(`📋 CTRADER_CLIENT_ID: ${clientId ? '✅ configured' : '❌ missing'}`);
    console.log(`📋 CTRADER_CLIENT_SECRET: ${clientSecret ? '✅ configured' : '❌ missing'}`);

    if (!clientId || !clientSecret) {
      console.error(`❌ cTrader credentials not properly configured!`);
      console.error(
        `Please ensure CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET are set in server/.env`
      );
    } else {
      console.log(`✅ cTrader credentials verified`);
    }
  }

  // Get all user accounts via WebSocket + Protobuf (OFFICIAL METHOD)
  async getAllUserAccountsWebSocket(userId, useDemo = true) {
    try {
      console.log(`🔍 Getting all accounts via WebSocket+Protobuf for user ${userId}`);

      const accessToken = await CtraderAuthService.getValidAccessToken(userId);
      if (!accessToken) {
        throw new Error('No access token available for user');
      }

      // Check if we already have a connection
      let connection = this.connections.get(userId);

      // Create connection if it doesn't exist or is not connected
      if (!connection || !connection.connected) {
        console.log(`🔌 Creating new WebSocket connection for user ${userId}`);
        connection = await this.createConnection(userId, useDemo);

        if (!connection || !connection.connected) {
          throw new Error('Failed to establish WebSocket connection');
        }

        // Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Send Application Auth message first
      console.log(`🔐 Sending Application Auth request`);
      await this.sendApplicationAuth(userId);

      // Wait for application auth to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Request accounts list using access token
      console.log(`📋 Requesting accounts list with access token`);
      await this.requestAccountsListByAccessToken(userId);

      // Wait for response and return accounts
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout waiting for accounts response for user ${userId}`);
          // Return stored accounts if available
          const storedAccounts = CtraderAuthService.getUserAccounts(userId);
          resolve(storedAccounts);
        }, 10000); // 10 second timeout

        // Listen for accounts response
        const checkAccounts = () => {
          const conn = this.connections.get(userId);
          if (conn && conn.accounts && conn.accounts.length > 0) {
            clearTimeout(timeout);
            console.log(`✅ Received ${conn.accounts.length} accounts via WebSocket`);
            // Update stored accounts
            CtraderAuthService.updateUserAccounts(userId, conn.accounts);
            resolve(conn.accounts);
          } else {
            // Check again in 500ms
            setTimeout(checkAccounts, 500);
          }
        };

        // Start checking
        setTimeout(checkAccounts, 1000);
      });
    } catch (error) {
      console.error(`❌ Failed to get accounts via WebSocket for user ${userId}:`, error);
      // Fallback to stored accounts
      const storedAccounts = CtraderAuthService.getUserAccounts(userId);
      if (storedAccounts.length > 0) {
        console.log(`📋 Returning ${storedAccounts.length} stored accounts as fallback`);
        return storedAccounts;
      }
      throw error;
    }
  }

  // Process accounts list response from WebSocket
  processAccountsFromProtobuf(accountsData, isDemo = true) {
    try {
      if (!accountsData || !Array.isArray(accountsData)) {
        console.log(`📋 No accounts data received`);
        return [];
      }

      return accountsData.map(account => ({
        accountId: account.ctidTraderAccountId || account.accountId,
        accountNumber: account.traderLogin || account.accountNumber,
        brokerName: account.brokerName || 'Unknown Broker',
        depositAssetId: account.depositAssetId || 'USD',
        tradingMode: account.tradingMode || 'HEDGED',
        accountType: account.accountType || 'HEDGED',
        live: !isDemo,
        environment: isDemo ? 'DEMO' : 'LIVE',
        balance: account.balance || 0,
        balanceVersion: account.balanceVersion || 0,
      }));
    } catch (error) {
      console.error(`❌ Error processing accounts from protobuf:`, error);
      return [];
    }
  }

  // Create WebSocket connection for user using correct cTrader Open API protocol
  async createConnection(userId, useDemo = true) {
    try {
      console.log(`🔌 Creating cTrader WebSocket connection for user ${userId}`);

      // Choose endpoint based on demo/live preference
      const endpoint = useDemo ? this.wsEndpoints.demo : this.wsEndpoints.live;
      console.log(`🌐 Connecting to: ${endpoint}`);

      // Create WebSocket connection with correct endpoint
      const wsOptions = {};

      // In development, we might need to handle SSL certificate issues
      if (process.env.NODE_ENV === 'development') {
        wsOptions.rejectUnauthorized = false;
      }

      const ws = new WebSocket(endpoint, wsOptions);

      // Setup connection handlers
      this.setupConnectionHandlers(ws, userId);

      // Store connection
      this.connections.set(userId, {
        ws,
        userId,
        connected: false,
        lastHeartbeat: Date.now(),
        accounts: [],
        isDemo: useDemo,
        applicationAuthorized: false,
        accountsAuthorized: [],
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error(`⏰ Connection timeout for user ${userId} after 15 seconds`);
          this.connections.delete(userId);
          reject(new Error('Connection timeout'));
        }, 15000);

        ws.on('open', () => {
          clearTimeout(timeout);
          console.log(`✅ cTrader WebSocket connected for user ${userId}`);
          const connection = this.connections.get(userId);
          if (connection) {
            connection.connected = true;
            connection.lastHeartbeat = Date.now();
          }
          resolve(connection);
        });

        ws.on('error', error => {
          clearTimeout(timeout);
          console.error(`❌ cTrader WebSocket error for user ${userId}:`, error);
          this.connections.delete(userId);
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

      // Test different message formats to see which one works
      console.log(`🔬 Testing different auth message formats...`);

      const authMessage = {
        clientMsgId: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        payloadType: 2100, // ProtoOAApplicationAuthReq
        payload: {
          clientId: process.env.CTRADER_CLIENT_ID,
          clientSecret: process.env.CTRADER_CLIENT_SECRET,
        },
      };

      console.log(`🔐 Sending application authentication for user ${userId}`);
      console.log(`🔍 Auth payload:`, JSON.stringify(authMessage.payload, null, 2));
      console.log(`🔍 ClientId length: ${process.env.CTRADER_CLIENT_ID?.length}`);
      console.log(`🔍 ClientSecret length: ${process.env.CTRADER_CLIENT_SECRET?.length}`);

      this.sendMessage(userId, authMessage);

      // Set a timeout to detect if we don't get a response
      setTimeout(() => {
        const conn = this.connections.get(userId);
        if (conn?.connected) {
          console.log(`⚠️  No authentication response received after 5 seconds`);
          console.log(`💡 This suggests the credentials or message format might be incorrect`);
        }
      }, 5000);
    } catch (error) {
      console.error(`Failed to send application auth for user ${userId}:`, error);
    }
  }

  // Handle incoming messages
  handleMessage(userId, message) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    console.log(`📨 cTrader message for user ${userId}:`, message.payloadType);
    if (message.payload && Object.keys(message.payload).length > 0) {
      console.log(`📋 Message payload:`, JSON.stringify(message.payload, null, 2));
    }

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
      case 2142: // ProtoOAGetAccountListByAccessTokenRes
        this.handleAccountsListByAccessTokenResponse(userId, message.payload);
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
      case 85: // ProtoErrorRes - Error response
        this.handleErrorResponse(userId, message.payload);
        break;
      default:
        console.log(`🔄 Unhandled message type ${message.payloadType} for user ${userId}`);
        if (message.payload) {
          console.log(`🔍 Payload details:`, JSON.stringify(message.payload, null, 2));
        }
    }
  }

  // Handle application authentication response
  handleApplicationAuthResponse(userId, payload) {
    console.log(`✅ Application authenticated for user ${userId}`);
    this.requestAccountsListByAccessToken(userId);
  }

  // Handle account authentication response
  handleAccountAuthResponse(userId, payload) {
    console.log(`✅ Account authenticated for user ${userId}:`, payload.ctidTraderAccountId);
  }

  // Handle accounts list response (legacy)
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

  // Handle accounts list by access token response
  async handleAccountsListByAccessTokenResponse(userId, payload) {
    console.log(`📋 Received accounts list by access token for user ${userId}`);
    console.log(`📋 Raw payload:`, JSON.stringify(payload, null, 2));

    try {
      const connection = this.connections.get(userId);
      if (!connection) {
        console.warn(`⚠️ No connection found for user ${userId}`);
        return;
      }

      const accountsData = payload.ctidTraderAccount || payload.account || [];

      if (accountsData.length > 0) {
        // Process accounts using the new method
        const isDemo = connection.isDemo || true;
        connection.accounts = this.processAccountsFromProtobuf(accountsData, isDemo);

        console.log(`✅ Updated connection with ${connection.accounts.length} accounts`);
        console.log(
          `📋 Accounts:`,
          connection.accounts.map(
            acc => `${acc.brokerName} ${acc.accountNumber} (${acc.environment})`
          )
        );

        // Store accounts in auth service too
        CtraderAuthService.updateUserAccounts(userId, connection.accounts);

        // Authenticate the first account automatically
        if (connection.accounts.length > 0) {
          const accessToken = await CtraderAuthService.getValidAccessToken(userId);
          if (accessToken) {
            console.log(
              `🔐 Auto-authenticating first account: ${connection.accounts[0].accountId}`
            );
            this.authenticateAccountWithToken(
              userId,
              connection.accounts[0].accountId,
              accessToken
            );
          }
        }
      } else {
        console.log(`⚠️ No accounts received in response for user ${userId}`);
        console.log(`📋 Available payload fields:`, Object.keys(payload));
      }
    } catch (error) {
      console.error(`❌ Error handling accounts list response for user ${userId}:`, error);
    }
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

  // Handle error response
  handleErrorResponse(userId, payload) {
    console.error(`❌ cTrader error for user ${userId}:`, payload);

    if (payload?.errorCode) {
      console.error(`📍 Error code: ${payload.errorCode}`);
    }

    if (payload?.description) {
      console.error(`📝 Error description: ${payload.description}`);
    }

    // Check if this is a critical error that should disconnect the user
    if (
      payload?.errorCode === 'INVALID_CLIENT_CREDENTIALS' ||
      payload?.errorCode === 'UNAUTHORIZED' ||
      payload?.errorCode === 'INVALID_ACCESS_TOKEN'
    ) {
      console.error(`🚨 Critical authentication error, disconnecting user ${userId}`);
      this.disconnect(userId);
    }
  }

  // Request accounts list (legacy method)
  requestAccountsList(userId) {
    const message = {
      clientMsgId: `accounts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payloadType: 2140, // ProtoOAAccountsListReq
      payload: {},
    };
    this.sendMessage(userId, message);
  }

  // Request accounts list by access token (used after app authentication)
  async requestAccountsListByAccessToken(userId) {
    try {
      console.log(`🔍 Getting access token for user ${userId}...`);
      const accessToken = await CtraderAuthService.getValidAccessToken(userId);

      if (!accessToken) {
        console.error(`❌ No access token available for user ${userId}`);
        return;
      }

      console.log(
        `✅ Access token obtained for user ${userId}: ${accessToken.substring(0, 10)}...`
      );

      const message = {
        clientMsgId: `acc_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        payloadType: 2149, // ProtoOAGetAccountListByAccessTokenReq
        payload: {
          accessToken: accessToken,
        },
      };

      console.log(`📋 Requesting accounts list by access token for user ${userId}`);
      console.log(`📋 Message payload:`, JSON.stringify(message.payload, null, 2));

      const sent = this.sendMessage(userId, message);
      if (sent) {
        console.log(`✅ Accounts list request sent successfully for user ${userId}`);
      } else {
        console.error(`❌ Failed to send accounts list request for user ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to request accounts list for user ${userId}:`, error);
      console.error(`Error details:`, error.stack);
    }
  }

  // Authenticate trading account (legacy method)
  authenticateAccount(userId, accountId) {
    const message = {
      clientMsgId: `acc_auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payloadType: 2102, // ProtoOAAccountAuthReq
      payload: {
        ctidTraderAccountId: accountId,
      },
    };
    this.sendMessage(userId, message);
  }

  // Authenticate trading account with access token
  authenticateAccountWithToken(userId, accountId, accessToken) {
    const message = {
      clientMsgId: `acc_auth_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payloadType: 2102, // ProtoOAAccountAuthReq
      payload: {
        ctidTraderAccountId: accountId,
        accessToken: accessToken,
      },
    };

    console.log(`🔐 Authenticating account ${accountId} for user ${userId}`);
    this.sendMessage(userId, message);
  }

  // Send message through WebSocket
  sendMessage(userId, message) {
    const connection = this.connections.get(userId);
    if (!connection?.ws || connection.ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message to user ${userId}: connection not open`);
      console.error(`Connection state:`, {
        hasConnection: !!connection,
        hasWs: !!connection?.ws,
        readyState: connection?.ws?.readyState,
        readyStateText: this.getReadyStateText(connection?.ws?.readyState),
      });
      return false;
    }

    try {
      const messageString = JSON.stringify(message);
      console.log(`📤 Sending message to user ${userId}:`, message.payloadType);
      console.log(`📤 Message details:`, messageString);
      connection.ws.send(messageString);
      return true;
    } catch (error) {
      console.error(`Error sending message to user ${userId}:`, error);
      return false;
    }
  }

  // Helper to get readable WebSocket state
  getReadyStateText(readyState) {
    switch (readyState) {
      case 0:
        return 'CONNECTING';
      case 1:
        return 'OPEN';
      case 2:
        return 'CLOSING';
      case 3:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  // Place new order
  async placeOrder(userId, accountId, orderData) {
    const message = {
      clientMsgId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      clientMsgId: `modify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      clientMsgId: `cancel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      clientMsgId: `close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
          clientMsgId: `heartbeat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    // Clean up dead connections after a short delay
    setTimeout(() => {
      const conn = this.connections.get(userId);
      if (conn && (!conn.ws || conn.ws.readyState === WebSocket.CLOSED)) {
        console.log(`🧹 Cleaning up dead connection for user ${userId}`);
        this.connections.delete(userId);
      }
    }, 5000); // 5 seconds delay
  }

  // Get connection status
  getConnectionStatus(userId) {
    const connection = this.connections.get(userId);
    const isAuthenticated = CtraderAuthService.isUserAuthenticated(userId);
    const storedAccounts = CtraderAuthService.getUserAccounts(userId);

    if (connection && connection.connected && connection.ws.readyState === WebSocket.OPEN) {
      return {
        connected: true,
        accounts: connection.accounts.length > 0 ? connection.accounts : storedAccounts,
        lastHeartbeat: connection.lastHeartbeat,
        apiType: 'WebSocket',
        isRecentlyActive: Date.now() - connection.lastHeartbeat < 60000, // Active if heartbeat within 1 minute
      };
    }

    return {
      connected: false,
      accounts: storedAccounts,
      lastHeartbeat: null,
      apiType: 'REST',
      isRecentlyActive: false,
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
