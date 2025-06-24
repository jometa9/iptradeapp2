import CtraderApiService from '../services/ctraderApi.js';
import CtraderAuthService from '../services/ctraderAuth.js';

// Initiate cTrader OAuth authentication
export const initiateAuth = (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    // Check if cTrader credentials are configured
    if (!process.env.CTRADER_CLIENT_ID || !process.env.CTRADER_CLIENT_SECRET) {
      console.error('cTrader credentials not configured in environment variables');
      return res.status(500).json({
        error: 'cTrader API not configured',
        details: 'Please configure CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET in server/.env file',
      });
    }

    // Generate OAuth URL
    const authUrl = CtraderAuthService.generateAuthUrl(userId);

    res.json({
      message: 'cTrader authentication URL generated',
      authUrl,
      status: 'success',
    });
  } catch (error) {
    console.error('Error initiating cTrader auth:', error);
    res.status(500).json({
      error: 'Failed to initiate cTrader authentication',
      details: error.message,
    });
  }
};

// Handle OAuth callback
export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('OAuth error:', error);
      return res.status(400).json({
        error: 'OAuth authentication failed',
        details: error,
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'Missing authorization code or state',
      });
    }

    // Exchange code for tokens
    const result = await CtraderAuthService.exchangeCodeForToken(code, state);

    if (result.success) {
      // Generate JWT for the user
      const jwt = CtraderAuthService.generateUserJWT(result.userId, result.tokenData);

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/dashboard?ctrader_auth=success&token=${jwt}`);
    } else {
      res.status(400).json({
        error: 'Failed to exchange authorization code',
      });
    }
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(
      `${frontendUrl}/dashboard?ctrader_auth=error&message=${encodeURIComponent(error.message)}`
    );
  }
};

// Get user's cTrader authentication status
export const getAuthStatus = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    const isAuthenticated = CtraderAuthService.isUserAuthenticated(userId);
    const accounts = CtraderAuthService.getUserAccounts(userId);
    const connectionStatus = CtraderApiService.getConnectionStatus(userId);

    // If authenticated but not connected, and we have stored accounts but no live accounts,
    // suggest reconnection
    const shouldReconnect =
      isAuthenticated &&
      !connectionStatus.connected &&
      accounts.length > 0 &&
      connectionStatus.accounts.length === 0;

    res.json({
      userId,
      authenticated: isAuthenticated,
      accounts: connectionStatus.accounts.length > 0 ? connectionStatus.accounts : accounts,
      connection: connectionStatus,
      shouldReconnect,
      status: 'success',
    });
  } catch (error) {
    console.error('Error getting auth status:', error);
    res.status(500).json({
      error: 'Failed to get authentication status',
      details: error.message,
    });
  }
};

// Connect to cTrader API
export const connectToApi = async (req, res) => {
  try {
    const { userId, useDemo = true } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    // Check if user is authenticated
    if (!CtraderAuthService.isUserAuthenticated(userId)) {
      return res.status(401).json({
        error: 'User not authenticated with cTrader',
      });
    }

    console.log(`🚀 Connecting to cTrader API for user ${userId} (Demo: ${useDemo})`);

    // Get accounts via WebSocket + Protobuf (OFFICIAL METHOD)
    const accounts = await CtraderApiService.getAllUserAccountsWebSocket(userId, useDemo);
    console.log(`✅ Retrieved ${accounts.length} accounts via WebSocket+Protobuf`);

    if (accounts.length > 0) {
      // Check connection status
      const connectionStatus = CtraderApiService.getConnectionStatus(userId);

      res.json({
        message: 'Successfully connected to cTrader API and retrieved accounts',
        userId,
        connected: connectionStatus.connected,
        connectionType: connectionStatus.connected ? 'WebSocket + Protobuf' : 'Stored Accounts',
        accountsFound: accounts.length,
        accounts: accounts,
        connectionDetails: connectionStatus,
        status: 'success',
      });
    } else {
      res.status(404).json({
        error: 'No cTrader accounts found',
        message: 'User is authenticated but has no accessible trading accounts',
        userId,
        suggestion: 'Please ensure you have demo/live accounts set up with your broker',
      });
    }
  } catch (error) {
    console.error('Error connecting to cTrader API:', error);
    res.status(500).json({
      error: 'Failed to connect to cTrader API',
      details: error.message,
      suggestion: 'Please check your authentication status and try again',
    });
  }
};

// Disconnect from cTrader API
export const disconnectFromApi = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    CtraderApiService.disconnect(userId);

    res.json({
      message: 'Successfully disconnected from cTrader API',
      userId,
      connected: false,
      status: 'success',
    });
  } catch (error) {
    console.error('Error disconnecting from cTrader API:', error);
    res.status(500).json({
      error: 'Failed to disconnect from cTrader API',
      details: error.message,
    });
  }
};

// Get user's cTrader accounts
export const getCtraderAccounts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    // Get accounts from auth service (stored)
    const storedAccounts = CtraderAuthService.getUserAccounts(userId);

    // Get accounts from active connection (if connected)
    const liveAccounts = CtraderApiService.getUserAccounts(userId);

    // Use live accounts if available, otherwise use stored
    const accounts = liveAccounts.length > 0 ? liveAccounts : storedAccounts;

    res.json({
      userId,
      accounts,
      total: accounts.length,
      status: 'success',
    });
  } catch (error) {
    console.error('Error getting cTrader accounts:', error);
    res.status(500).json({
      error: 'Failed to get cTrader accounts',
      details: error.message,
    });
  }
};

// Authenticate specific account for trading
export const authenticateAccount = async (req, res) => {
  try {
    const { userId, accountId } = req.body;

    if (!userId || !accountId) {
      return res.status(400).json({
        error: 'userId and accountId are required',
      });
    }

    // Check if user is connected
    const connectionStatus = CtraderApiService.getConnectionStatus(userId);
    if (!connectionStatus.connected) {
      return res.status(400).json({
        error: 'User not connected to cTrader API',
      });
    }

    // Authenticate the account
    CtraderApiService.authenticateAccount(userId, accountId);

    res.json({
      message: 'Account authentication request sent',
      userId,
      accountId,
      status: 'success',
    });
  } catch (error) {
    console.error('Error authenticating account:', error);
    res.status(500).json({
      error: 'Failed to authenticate account',
      details: error.message,
    });
  }
};

// Register cTrader account as master
export const registerCtraderMaster = async (req, res) => {
  try {
    const { userId, accountId, name, description } = req.body;

    if (!userId || !accountId) {
      return res.status(400).json({
        error: 'userId and accountId are required',
      });
    }

    // Get account details from cTrader
    const accounts = CtraderAuthService.getUserAccounts(userId);
    const account = accounts.find(acc => acc.accountId === accountId);

    if (!account) {
      return res.status(404).json({
        error: 'cTrader account not found',
      });
    }

    // Create master account data
    const masterAccountData = {
      masterAccountId: `ctrader_${accountId}`,
      name: name || `${account.brokerName} - ${account.accountNumber}`,
      description: description || `cTrader account ${account.accountNumber}`,
      broker: account.brokerName,
      platform: 'cTrader',
      ctraderData: {
        userId,
        accountId,
        accountNumber: account.accountNumber,
        live: account.live,
        tradingMode: account.tradingMode,
      },
    };

    // Here you would call your existing registerMasterAccount function
    // For now, we'll return the data structure
    res.json({
      message: 'cTrader master account prepared',
      masterAccount: masterAccountData,
      status: 'success',
    });
  } catch (error) {
    console.error('Error registering cTrader master:', error);
    res.status(500).json({
      error: 'Failed to register cTrader master account',
      details: error.message,
    });
  }
};

// Register cTrader account as slave
export const registerCtraderSlave = async (req, res) => {
  try {
    const { userId, accountId, name, description, masterAccountId } = req.body;

    if (!userId || !accountId) {
      return res.status(400).json({
        error: 'userId and accountId are required',
      });
    }

    // Get account details from cTrader
    const accounts = CtraderAuthService.getUserAccounts(userId);
    const account = accounts.find(acc => acc.accountId === accountId);

    if (!account) {
      return res.status(404).json({
        error: 'cTrader account not found',
      });
    }

    // Create slave account data
    const slaveAccountData = {
      slaveAccountId: `ctrader_${accountId}`,
      name: name || `${account.brokerName} - ${account.accountNumber}`,
      description: description || `cTrader account ${account.accountNumber}`,
      broker: account.brokerName,
      platform: 'cTrader',
      masterAccountId,
      ctraderData: {
        userId,
        accountId,
        accountNumber: account.accountNumber,
        live: account.live,
        tradingMode: account.tradingMode,
      },
    };

    // Here you would call your existing registerSlaveAccount function
    res.json({
      message: 'cTrader slave account prepared',
      slaveAccount: slaveAccountData,
      status: 'success',
    });
  } catch (error) {
    console.error('Error registering cTrader slave:', error);
    res.status(500).json({
      error: 'Failed to register cTrader slave account',
      details: error.message,
    });
  }
};

// Revoke cTrader authentication
export const revokeAuth = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    // Disconnect from API
    CtraderApiService.disconnect(userId);

    // Revoke tokens
    const revoked = CtraderAuthService.revokeUserTokens(userId);

    if (revoked) {
      res.json({
        message: 'cTrader authentication revoked successfully',
        userId,
        status: 'success',
      });
    } else {
      res.status(404).json({
        error: 'User tokens not found',
      });
    }
  } catch (error) {
    console.error('Error revoking cTrader auth:', error);
    res.status(500).json({
      error: 'Failed to revoke cTrader authentication',
      details: error.message,
    });
  }
};

// Get connection status
export const getConnectionStatus = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    const status = CtraderApiService.getConnectionStatus(userId);

    res.json({
      userId,
      ...status,
      status: 'success',
    });
  } catch (error) {
    console.error('Error getting connection status:', error);
    res.status(500).json({
      error: 'Failed to get connection status',
      details: error.message,
    });
  }
};

// Refresh accounts via REST API
export const refreshAccounts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    // Check if user is authenticated
    if (!CtraderAuthService.isUserAuthenticated(userId)) {
      return res.status(401).json({
        error: 'User not authenticated with cTrader',
      });
    }

    console.log(`🔄 Refreshing accounts for user ${userId}`);

    // Get fresh accounts via WebSocket + Protobuf
    const accounts = await CtraderApiService.getAllUserAccountsWebSocket(userId, true); // Default to demo

    res.json({
      message: 'Accounts refreshed successfully',
      userId,
      accountsFound: accounts.length,
      accounts: accounts,
      refreshedAt: new Date().toISOString(),
      status: 'success',
    });
  } catch (error) {
    console.error('Error refreshing accounts:', error);
    res.status(500).json({
      error: 'Failed to refresh accounts',
      details: error.message,
    });
  }
};
