import Mt5ApiService from '../services/mt5Api.js';
import Mt5AuthService from '../services/mt5Auth.js';

// Initialize MT5 connection
export const initializeMT5 = async (req, res) => {
  try {
    const { userId, terminalPath } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    const result = await Mt5ApiService.initializeMT5(userId, terminalPath);

    res.json({
      message: 'MT5 initialized successfully',
      userId,
      connected: true,
      status: 'success',
      ...result,
    });
  } catch (error) {
    console.error('Error initializing MT5:', error);
    res.status(500).json({
      error: 'Failed to initialize MT5',
      details: error.message,
    });
  }
};

// Login to MT5 account
export const loginToMT5Account = async (req, res) => {
  try {
    const { userId, account, password, server, saveCredentials = false } = req.body;

    if (!userId || !account || !password || !server) {
      return res.status(400).json({
        error: 'userId, account, password, and server are required',
      });
    }

    // Check if MT5 is initialized
    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not initialized. Please initialize MT5 first.',
      });
    }

    const result = await Mt5ApiService.loginToAccount(userId, account, password, server);

    if (result.success) {
      // Save credentials if requested
      if (saveCredentials) {
        const accountData = {
          account: account,
          password: password,
          server: server,
          name: result.account?.name || `Account ${account}`,
          isDemo: server.toLowerCase().includes('demo'),
        };

        Mt5AuthService.storeAccountCredentials(userId, accountData);
      }

      res.json({
        message: 'Successfully logged into MT5 account',
        userId,
        account: result.account,
        credentialsSaved: saveCredentials,
        status: 'success',
      });
    } else {
      res.status(401).json({
        error: 'Failed to login to MT5 account',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error logging into MT5 account:', error);
    res.status(500).json({
      error: 'Failed to login to MT5 account',
      details: error.message,
    });
  }
};

// Login with stored credentials
export const loginWithStoredCredentials = async (req, res) => {
  try {
    const { userId, account, server } = req.body;

    if (!userId || !account || !server) {
      return res.status(400).json({
        error: 'userId, account, and server are required',
      });
    }

    // Get stored credentials
    const credentials = Mt5AuthService.getAccountCredentials(userId, account, server);
    if (!credentials) {
      return res.status(404).json({
        error: 'No stored credentials found for this account',
      });
    }

    // Check if MT5 is initialized
    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not initialized. Please initialize MT5 first.',
      });
    }

    const result = await Mt5ApiService.loginToAccount(
      userId,
      credentials.account,
      credentials.password,
      credentials.server
    );

    if (result.success) {
      res.json({
        message: 'Successfully logged into MT5 account with stored credentials',
        userId,
        account: result.account,
        status: 'success',
      });
    } else {
      res.status(401).json({
        error: 'Failed to login with stored credentials',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error logging in with stored credentials:', error);
    res.status(500).json({
      error: 'Failed to login with stored credentials',
      details: error.message,
    });
  }
};

// Get account information
export const getAccountInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not connected',
      });
    }

    const result = await Mt5ApiService.getAccountInfo(userId);

    if (result.success) {
      res.json({
        message: 'Account information retrieved successfully',
        account: result.account,
        status: 'success',
      });
    } else {
      res.status(500).json({
        error: 'Failed to get account information',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error getting account info:', error);
    res.status(500).json({
      error: 'Failed to get account information',
      details: error.message,
    });
  }
};

// Get positions
export const getPositions = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not connected',
      });
    }

    const result = await Mt5ApiService.getPositions(userId);

    if (result.success) {
      res.json({
        message: 'Positions retrieved successfully',
        positions: result.positions,
        count: result.positions.length,
        status: 'success',
      });
    } else {
      res.status(500).json({
        error: 'Failed to get positions',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error getting positions:', error);
    res.status(500).json({
      error: 'Failed to get positions',
      details: error.message,
    });
  }
};

// Get orders
export const getOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not connected',
      });
    }

    const result = await Mt5ApiService.getOrders(userId);

    if (result.success) {
      res.json({
        message: 'Orders retrieved successfully',
        orders: result.orders,
        count: result.orders.length,
        status: 'success',
      });
    } else {
      res.status(500).json({
        error: 'Failed to get orders',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      error: 'Failed to get orders',
      details: error.message,
    });
  }
};

// Place order
export const placeOrder = async (req, res) => {
  try {
    const { userId, symbol, orderType, volume, price, sl, tp, comment, magic } = req.body;

    if (!userId || !symbol || orderType === undefined || !volume) {
      return res.status(400).json({
        error: 'userId, symbol, orderType, and volume are required',
      });
    }

    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not connected',
      });
    }

    const result = await Mt5ApiService.placeOrder(
      userId,
      symbol,
      orderType,
      volume,
      price,
      sl,
      tp,
      comment || '',
      magic || 0
    );

    if (result.success) {
      res.json({
        message: 'Order placed successfully',
        result: result.result,
        status: 'success',
      });
    } else {
      res.status(400).json({
        error: 'Failed to place order',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      error: 'Failed to place order',
      details: error.message,
    });
  }
};

// Close position
export const closePosition = async (req, res) => {
  try {
    const { userId, ticket } = req.body;

    if (!userId || !ticket) {
      return res.status(400).json({
        error: 'userId and ticket are required',
      });
    }

    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not connected',
      });
    }

    const result = await Mt5ApiService.closePosition(userId, ticket);

    if (result.success) {
      res.json({
        message: 'Position closed successfully',
        status: 'success',
      });
    } else {
      res.status(400).json({
        error: 'Failed to close position',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error closing position:', error);
    res.status(500).json({
      error: 'Failed to close position',
      details: error.message,
    });
  }
};

// Get symbol information
export const getSymbolInfo = async (req, res) => {
  try {
    const { userId, symbol } = req.params;

    if (!userId || !symbol) {
      return res.status(400).json({
        error: 'userId and symbol are required',
      });
    }

    if (!Mt5ApiService.isConnected(userId)) {
      return res.status(400).json({
        error: 'MT5 not connected',
      });
    }

    const result = await Mt5ApiService.getSymbolInfo(userId, symbol);

    if (result.success) {
      res.json({
        message: 'Symbol information retrieved successfully',
        symbol: result.symbol,
        status: 'success',
      });
    } else {
      res.status(404).json({
        error: 'Symbol not found',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error getting symbol info:', error);
    res.status(500).json({
      error: 'Failed to get symbol information',
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

    const status = Mt5ApiService.getConnectionStatus(userId);
    const storedAccounts = Mt5AuthService.getUserAccounts(userId);
    const userStats = Mt5AuthService.getUserStats(userId);

    res.json({
      userId,
      connection: status,
      storedAccounts,
      stats: userStats,
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

// Disconnect from MT5
export const disconnectFromMT5 = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    await Mt5ApiService.disconnect(userId);

    res.json({
      message: 'Disconnected from MT5 successfully',
      userId,
      status: 'success',
    });
  } catch (error) {
    console.error('Error disconnecting from MT5:', error);
    res.status(500).json({
      error: 'Failed to disconnect from MT5',
      details: error.message,
    });
  }
};

// Get stored accounts
export const getStoredAccounts = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    const accounts = Mt5AuthService.getUserAccounts(userId);
    const stats = Mt5AuthService.getUserStats(userId);

    res.json({
      message: 'Stored accounts retrieved successfully',
      accounts,
      stats,
      status: 'success',
    });
  } catch (error) {
    console.error('Error getting stored accounts:', error);
    res.status(500).json({
      error: 'Failed to get stored accounts',
      details: error.message,
    });
  }
};

// Remove stored account
export const removeStoredAccount = (req, res) => {
  try {
    const { userId, account, server } = req.body;

    if (!userId || !account || !server) {
      return res.status(400).json({
        error: 'userId, account, and server are required',
      });
    }

    const success = Mt5AuthService.removeAccount(userId, account, server);

    if (success) {
      res.json({
        message: 'Account removed successfully',
        status: 'success',
      });
    } else {
      res.status(404).json({
        error: 'Account not found',
      });
    }
  } catch (error) {
    console.error('Error removing stored account:', error);
    res.status(500).json({
      error: 'Failed to remove stored account',
      details: error.message,
    });
  }
};

// Update user preferences
export const updateUserPreferences = (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    const success = Mt5AuthService.updateUserPreferences(userId, preferences);

    if (success) {
      res.json({
        message: 'Preferences updated successfully',
        preferences: Mt5AuthService.getUserPreferences(userId),
        status: 'success',
      });
    } else {
      res.status(500).json({
        error: 'Failed to update preferences',
      });
    }
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({
      error: 'Failed to update user preferences',
      details: error.message,
    });
  }
};

// Register MT5 master account
export const registerMT5Master = async (req, res) => {
  try {
    const { userId, account, server, name } = req.body;

    if (!userId || !account || !server) {
      return res.status(400).json({
        error: 'userId, account, and server are required',
      });
    }

    // Store as master account (you might want to extend this functionality)
    const accountData = {
      account: account,
      server: server,
      name: name || `Master ${account}`,
      isDemo: server.toLowerCase().includes('demo'),
      role: 'master',
    };

    const success = Mt5AuthService.storeAccountCredentials(userId, accountData);

    if (success) {
      res.json({
        message: 'MT5 master account registered successfully',
        account: accountData,
        status: 'success',
      });
    } else {
      res.status(500).json({
        error: 'Failed to register master account',
      });
    }
  } catch (error) {
    console.error('Error registering MT5 master account:', error);
    res.status(500).json({
      error: 'Failed to register MT5 master account',
      details: error.message,
    });
  }
};

// Register MT5 slave account
export const registerMT5Slave = async (req, res) => {
  try {
    const { userId, account, server, name, masterAccount } = req.body;

    if (!userId || !account || !server) {
      return res.status(400).json({
        error: 'userId, account, and server are required',
      });
    }

    // Store as slave account
    const accountData = {
      account: account,
      server: server,
      name: name || `Slave ${account}`,
      isDemo: server.toLowerCase().includes('demo'),
      role: 'slave',
      masterAccount: masterAccount,
    };

    const success = Mt5AuthService.storeAccountCredentials(userId, accountData);

    if (success) {
      res.json({
        message: 'MT5 slave account registered successfully',
        account: accountData,
        status: 'success',
      });
    } else {
      res.status(500).json({
        error: 'Failed to register slave account',
      });
    }
  } catch (error) {
    console.error('Error registering MT5 slave account:', error);
    res.status(500).json({
      error: 'Failed to register MT5 slave account',
      details: error.message,
    });
  }
};

// Export user data
export const exportUserData = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required',
      });
    }

    const userData = Mt5AuthService.exportUserData(userId);

    if (userData) {
      res.json({
        message: 'User data exported successfully',
        data: userData,
        status: 'success',
      });
    } else {
      res.status(404).json({
        error: 'No user data found',
      });
    }
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({
      error: 'Failed to export user data',
      details: error.message,
    });
  }
};
