import React, { useEffect, useState } from 'react';

import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';

interface MT5Account {
  account: string;
  server: string;
  name: string;
  isDemo: boolean;
  lastUsed: string;
  hasCredentials: boolean;
}

interface MT5Position {
  ticket: number;
  symbol: string;
  type: number;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  comment: string;
  magic: number;
}

interface MT5Order {
  ticket: number;
  symbol: string;
  type: number;
  volume_initial: number;
  price_open: number;
  sl: number;
  tp: number;
  comment: string;
  magic: number;
}

interface MT5AccountInfo {
  login: number;
  name: string;
  server: string;
  currency: string;
  leverage: number;
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  profit: number;
}

interface MT5ConnectionStatus {
  connected: boolean;
  accounts: MT5Account[];
  lastActivity: number | null;
}

const MT5Manager: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<MT5ConnectionStatus>({
    connected: false,
    accounts: [],
    lastActivity: null,
  });
  const [storedAccounts, setStoredAccounts] = useState<MT5Account[]>([]);
  const [accountInfo, setAccountInfo] = useState<MT5AccountInfo | null>(null);
  const [positions, setPositions] = useState<MT5Position[]>([]);
  const [orders, setOrders] = useState<MT5Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [loginForm, setLoginForm] = useState({
    account: '',
    password: '',
    server: '',
    saveCredentials: false,
  });
  const [terminalPath, setTerminalPath] = useState('');
  const [orderForm, setOrderForm] = useState({
    symbol: 'EURUSD',
    orderType: 0, // 0 = BUY, 1 = SELL
    volume: 0.01,
    price: '',
    sl: '',
    tp: '',
    comment: '',
    magic: 0,
  });

  const userId = 'default-user'; // In a real app, get this from auth context

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load initial data
  useEffect(() => {
    fetchConnectionStatus();
    fetchStoredAccounts();
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch(`/api/mt5/status/${userId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setConnectionStatus(data.connection);
        if (data.connection.connected) {
          fetchAccountInfo();
          fetchPositions();
          fetchOrders();
        }
      }
    } catch (error) {
      console.error('Error fetching connection status:', error);
    }
  };

  const fetchStoredAccounts = async () => {
    try {
      const response = await fetch(`/api/mt5/accounts/${userId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setStoredAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching stored accounts:', error);
    }
  };

  const fetchAccountInfo = async () => {
    try {
      const response = await fetch(`/api/mt5/account/${userId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setAccountInfo(data.account);
      }
    } catch (error) {
      console.error('Error fetching account info:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await fetch(`/api/mt5/positions/${userId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setPositions(data.positions);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`/api/mt5/orders/${userId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const initializeMT5 = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mt5/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          terminalPath: terminalPath || null,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('MT5 initialized successfully');
        fetchConnectionStatus();
      } else {
        setError(data.error || 'Failed to initialize MT5');
      }
    } catch (error) {
      setError(`Failed to initialize MT5: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loginToMT5 = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mt5/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...loginForm,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Successfully logged into MT5 account');
        fetchConnectionStatus();
        fetchStoredAccounts();
        fetchAccountInfo();
        fetchPositions();
        fetchOrders();
        setLoginForm({
          account: '',
          password: '',
          server: '',
          saveCredentials: false,
        });
      } else {
        setError(data.error || 'Failed to login to MT5');
      }
    } catch (error) {
      setError(`Failed to login to MT5: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithStored = async (account: string, server: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mt5/login/stored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          account,
          server,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Successfully logged in with stored credentials');
        fetchConnectionStatus();
        fetchAccountInfo();
        fetchPositions();
        fetchOrders();
      } else {
        setError(data.error || 'Failed to login with stored credentials');
      }
    } catch (error) {
      setError(`Failed to login with stored credentials: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectMT5 = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/mt5/disconnect/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Disconnected from MT5');
        setConnectionStatus({ connected: false, accounts: [], lastActivity: null });
        setAccountInfo(null);
        setPositions([]);
        setOrders([]);
      } else {
        setError(data.error || 'Failed to disconnect from MT5');
      }
    } catch (error) {
      setError(`Failed to disconnect from MT5: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const placeOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mt5/order/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...orderForm,
          price: orderForm.price ? parseFloat(orderForm.price) : null,
          sl: orderForm.sl ? parseFloat(orderForm.sl) : null,
          tp: orderForm.tp ? parseFloat(orderForm.tp) : null,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Order placed successfully');
        fetchPositions();
        fetchOrders();
        setOrderForm({
          symbol: 'EURUSD',
          orderType: 0,
          volume: 0.01,
          price: '',
          sl: '',
          tp: '',
          comment: '',
          magic: 0,
        });
      } else {
        setError(data.error || 'Failed to place order');
      }
    } catch (error) {
      setError(`Failed to place order: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closePosition = async (ticket: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mt5/position/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ticket,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Position closed successfully');
        fetchPositions();
        fetchAccountInfo();
      } else {
        setError(data.error || 'Failed to close position');
      }
    } catch (error) {
      setError(`Failed to close position: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const removeStoredAccount = async (account: string, server: string) => {
    try {
      const response = await fetch('/api/mt5/accounts/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          account,
          server,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Account removed successfully');
        fetchStoredAccounts();
      } else {
        setError(data.error || 'Failed to remove account');
      }
    } catch (error) {
      setError(`Failed to remove account: ${error}`);
    }
  };

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const getOrderTypeText = (type: number) => {
    const types = ['Buy', 'Sell', 'Buy Limit', 'Sell Limit', 'Buy Stop', 'Sell Stop'];
    return types[type] || `Type ${type}`;
  };

  const getPositionTypeText = (type: number) => {
    return type === 0 ? 'Buy' : 'Sell';
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>MetaTrader 5 Connection</span>
            <Badge variant={connectionStatus.connected ? 'default' : 'destructive'}>
              {connectionStatus.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </CardTitle>
          <CardDescription>Manage your MetaTrader 5 connection and accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!connectionStatus.connected ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="terminalPath">MT5 Terminal Path (optional)</Label>
                  <Input
                    id="terminalPath"
                    placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                    value={terminalPath}
                    onChange={e => setTerminalPath(e.target.value)}
                  />
                </div>
                <Button onClick={initializeMT5} disabled={isLoading} className="w-full">
                  {isLoading ? 'Initializing...' : 'Initialize MT5'}
                </Button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">MT5 is connected and ready for trading</p>
                  {connectionStatus.lastActivity && (
                    <p className="text-xs text-gray-500">
                      Last activity: {new Date(connectionStatus.lastActivity).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={disconnectMT5} disabled={isLoading}>
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="accounts">Stored Accounts</TabsTrigger>
        </TabsList>

        {/* Login Tab */}
        <TabsContent value="login" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Login to MT5 Account</CardTitle>
              <CardDescription>Enter your MT5 account credentials to connect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account">Account Number</Label>
                  <Input
                    id="account"
                    placeholder="12345678"
                    value={loginForm.account}
                    onChange={e => setLoginForm({ ...loginForm, account: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="server">Server</Label>
                  <Input
                    id="server"
                    placeholder="BrokerName-Demo"
                    value={loginForm.server}
                    onChange={e => setLoginForm({ ...loginForm, server: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="saveCredentials"
                  checked={loginForm.saveCredentials}
                  onCheckedChange={checked =>
                    setLoginForm({ ...loginForm, saveCredentials: checked })
                  }
                />
                <Label htmlFor="saveCredentials">Save credentials for future use</Label>
              </div>
              <Button
                onClick={loginToMT5}
                disabled={
                  isLoading ||
                  !connectionStatus.connected ||
                  !loginForm.account ||
                  !loginForm.password ||
                  !loginForm.server
                }
                className="w-full"
              >
                {isLoading ? 'Logging in...' : 'Login to MT5'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4">
          {accountInfo ? (
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Current account details and balance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Account</Label>
                    <p className="text-lg font-bold">{accountInfo.login}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Name</Label>
                    <p className="text-lg">{accountInfo.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Server</Label>
                    <p className="text-lg">{accountInfo.server}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Balance</Label>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(accountInfo.balance, accountInfo.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Equity</Label>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(accountInfo.equity, accountInfo.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Profit</Label>
                    <p
                      className={`text-lg font-bold ${accountInfo.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(accountInfo.profit, accountInfo.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Margin</Label>
                    <p className="text-lg">
                      {formatCurrency(accountInfo.margin, accountInfo.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Free Margin</Label>
                    <p className="text-lg">
                      {formatCurrency(accountInfo.margin_free, accountInfo.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Margin Level</Label>
                    <p className="text-lg">{accountInfo.margin_level.toFixed(2)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">
                  No account information available. Please login to an MT5 account first.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trading Tab */}
        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Place Order</CardTitle>
              <CardDescription>Place a new trading order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    value={orderForm.symbol}
                    onChange={e => setOrderForm({ ...orderForm, symbol: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="orderType">Order Type</Label>
                  <Select
                    value={orderForm.orderType.toString()}
                    onValueChange={value =>
                      setOrderForm({ ...orderForm, orderType: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Buy</SelectItem>
                      <SelectItem value="1">Sell</SelectItem>
                      <SelectItem value="2">Buy Limit</SelectItem>
                      <SelectItem value="3">Sell Limit</SelectItem>
                      <SelectItem value="4">Buy Stop</SelectItem>
                      <SelectItem value="5">Sell Stop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="volume">Volume</Label>
                  <Input
                    id="volume"
                    type="number"
                    step="0.01"
                    value={orderForm.volume}
                    onChange={e =>
                      setOrderForm({ ...orderForm, volume: parseFloat(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price (optional)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.00001"
                    value={orderForm.price}
                    onChange={e => setOrderForm({ ...orderForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="magic">Magic Number</Label>
                  <Input
                    id="magic"
                    type="number"
                    value={orderForm.magic}
                    onChange={e => setOrderForm({ ...orderForm, magic: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sl">Stop Loss</Label>
                  <Input
                    id="sl"
                    type="number"
                    step="0.00001"
                    value={orderForm.sl}
                    onChange={e => setOrderForm({ ...orderForm, sl: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="tp">Take Profit</Label>
                  <Input
                    id="tp"
                    type="number"
                    step="0.00001"
                    value={orderForm.tp}
                    onChange={e => setOrderForm({ ...orderForm, tp: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="comment">Comment</Label>
                <Input
                  id="comment"
                  value={orderForm.comment}
                  onChange={e => setOrderForm({ ...orderForm, comment: e.target.value })}
                />
              </div>
              <Button
                onClick={placeOrder}
                disabled={isLoading || !connectionStatus.connected || !accountInfo}
                className="w-full"
              >
                {isLoading ? 'Placing Order...' : 'Place Order'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open Positions ({positions.length})</CardTitle>
              <CardDescription>Your current open positions</CardDescription>
            </CardHeader>
            <CardContent>
              {positions.length > 0 ? (
                <div className="space-y-2">
                  {positions.map(position => (
                    <div key={position.ticket} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                          <div>
                            <Label className="text-sm font-medium">Symbol</Label>
                            <p className="text-lg font-bold">{position.symbol}</p>
                            <Badge variant={position.type === 0 ? 'default' : 'destructive'}>
                              {getPositionTypeText(position.type)}
                            </Badge>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Volume</Label>
                            <p className="text-lg">{position.volume}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Open Price</Label>
                            <p className="text-lg">{position.price_open}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Current Price</Label>
                            <p className="text-lg">{position.price_current}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Profit</Label>
                            <p
                              className={`text-lg font-bold ${position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {position.profit.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Swap</Label>
                            <p className="text-lg">{position.swap.toFixed(2)}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Ticket</Label>
                            <p className="text-lg">{position.ticket}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Magic</Label>
                            <p className="text-lg">{position.magic}</p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => closePosition(position.ticket)}
                          disabled={isLoading}
                        >
                          Close
                        </Button>
                      </div>
                      {position.comment && (
                        <div className="mt-2">
                          <Label className="text-sm font-medium">Comment</Label>
                          <p className="text-sm text-gray-600">{position.comment}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No open positions</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Orders ({orders.length})</CardTitle>
              <CardDescription>Your pending orders</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length > 0 ? (
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.ticket} className="p-4 border rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Symbol</Label>
                          <p className="text-lg font-bold">{order.symbol}</p>
                          <Badge variant="outline">{getOrderTypeText(order.type)}</Badge>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Volume</Label>
                          <p className="text-lg">{order.volume_initial}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Price</Label>
                          <p className="text-lg">{order.price_open}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Ticket</Label>
                          <p className="text-lg">{order.ticket}</p>
                        </div>
                        {order.sl !== 0 && (
                          <div>
                            <Label className="text-sm font-medium">Stop Loss</Label>
                            <p className="text-lg">{order.sl}</p>
                          </div>
                        )}
                        {order.tp !== 0 && (
                          <div>
                            <Label className="text-sm font-medium">Take Profit</Label>
                            <p className="text-lg">{order.tp}</p>
                          </div>
                        )}
                      </div>
                      {order.comment && (
                        <div className="mt-2">
                          <Label className="text-sm font-medium">Comment</Label>
                          <p className="text-sm text-gray-600">{order.comment}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No pending orders</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stored Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stored MT5 Accounts</CardTitle>
              <CardDescription>Manage your saved MT5 account credentials</CardDescription>
            </CardHeader>
            <CardContent>
              {storedAccounts.length > 0 ? (
                <div className="space-y-4">
                  {storedAccounts.map((account, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{account.name}</h3>
                            <Badge variant={account.isDemo ? 'secondary' : 'default'}>
                              {account.isDemo ? 'Demo' : 'Live'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            Account: {account.account} | Server: {account.server}
                          </p>
                          <p className="text-xs text-gray-500">
                            Last used: {new Date(account.lastUsed).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => loginWithStored(account.account, account.server)}
                            disabled={isLoading || !connectionStatus.connected}
                          >
                            Login
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeStoredAccount(account.account, account.server)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No stored accounts. Login to an account and save credentials to see them here.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MT5Manager;
