import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import { join } from 'path';

// Ensure environment variables are loaded
dotenv.config({ path: join(process.cwd(), 'server', '.env') });

const configBaseDir = join(process.cwd(), 'server', 'config');
const ctraderTokensFilePath = join(configBaseDir, 'ctrader_tokens.json');

// Initialize config directory
const initializeCtraderConfig = () => {
  if (!existsSync(configBaseDir)) {
    mkdirSync(configBaseDir, { recursive: true });
  }

  if (!existsSync(ctraderTokensFilePath)) {
    const defaultConfig = {
      userTokens: {}, // userId -> { accessToken, refreshToken, expiresAt, accounts: [] }
    };
    writeFileSync(ctraderTokensFilePath, JSON.stringify(defaultConfig, null, 2));
  }
};

// Load tokens config
const loadTokensConfig = () => {
  try {
    initializeCtraderConfig();
    const data = readFileSync(ctraderTokensFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading cTrader tokens config:', error);
    return { userTokens: {} };
  }
};

// Save tokens config
const saveTokensConfig = config => {
  try {
    writeFileSync(ctraderTokensFilePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving cTrader tokens config:', error);
    return false;
  }
};

class CtraderAuthService {
  constructor() {
    // Don't initialize here - initialize lazily when needed
    this._initialized = false;
  }

  _ensureInitialized() {
    if (!this._initialized) {
      this.clientId = process.env.CTRADER_CLIENT_ID;
      this.clientSecret = process.env.CTRADER_CLIENT_SECRET;
      this.redirectUri =
        process.env.CTRADER_REDIRECT_URI || 'http://localhost:3000/api/ctrader/auth/callback';
      this.authUrl =
        process.env.CTRADER_AUTH_URL ||
        'https://id.ctrader.com/my/settings/openapi/grantingaccess/';
      this.tokenUrl = process.env.CTRADER_TOKEN_URL || 'https://openapi.ctrader.com/apps/token';
      this.scope = process.env.CTRADER_SCOPE || 'trading';

      if (!this.clientId || !this.clientSecret) {
        console.warn('⚠️  cTrader credentials not configured. OAuth will not work.');
      }

      this._initialized = true;
    }
  }

  // Generate OAuth authorization URL
  generateAuthUrl(userId, state = null) {
    this._ensureInitialized();

    if (!this.clientId) {
      throw new Error('cTrader Client ID not configured');
    }

    const authState = state || crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      product: 'web',
      state: `${userId}:${authState}`,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code, state) {
    try {
      this._ensureInitialized();

      if (!this.clientId || !this.clientSecret) {
        throw new Error('cTrader credentials not configured');
      }

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code,
      });

      const response = await axios.get(`${this.tokenUrl}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const tokenData = response.data;

      // Parse userId from state
      const [userId] = state.split(':');

      // Save tokens (using cTrader API response format)
      const config = loadTokensConfig();
      config.userTokens[userId] = {
        accessToken: tokenData.accessToken || tokenData.access_token,
        refreshToken: tokenData.refreshToken || tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expiresIn || tokenData.expires_in) * 1000,
        tokenType: tokenData.tokenType || tokenData.token_type || 'Bearer',
        scope: tokenData.scope,
        accounts: [], // Will be populated when accounts are fetched
        createdAt: new Date().toISOString(),
      };

      saveTokensConfig(config);

      return {
        success: true,
        userId,
        tokenData: config.userTokens[userId],
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code');
    }
  }

  // Refresh access token
  async refreshToken(userId) {
    try {
      this._ensureInitialized();

      const config = loadTokensConfig();
      const userTokens = config.userTokens[userId];

      if (!userTokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: userTokens.refreshToken,
      });

      const response = await axios.get(`${this.tokenUrl}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const tokenData = response.data;

      // Update tokens (using cTrader API response format)
      config.userTokens[userId] = {
        ...userTokens,
        accessToken: tokenData.accessToken || tokenData.access_token,
        refreshToken: tokenData.refreshToken || tokenData.refresh_token || userTokens.refreshToken,
        expiresAt: Date.now() + (tokenData.expiresIn || tokenData.expires_in) * 1000,
        updatedAt: new Date().toISOString(),
      };

      saveTokensConfig(config);

      return config.userTokens[userId];
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh token');
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(userId) {
    const config = loadTokensConfig();
    const userTokens = config.userTokens[userId];

    if (!userTokens) {
      throw new Error('User not authenticated with cTrader');
    }

    // Check if token is expired (with 5 minutes buffer)
    const isExpired = userTokens.expiresAt < Date.now() + 5 * 60 * 1000;

    if (isExpired) {
      console.log(`Token expired for user ${userId}, refreshing...`);
      const refreshedTokens = await this.refreshToken(userId);
      return refreshedTokens.accessToken;
    }

    return userTokens.accessToken;
  }

  // Check if user is authenticated
  isUserAuthenticated(userId) {
    const config = loadTokensConfig();
    return !!config.userTokens[userId]?.accessToken;
  }

  // Get user's cTrader accounts
  getUserAccounts(userId) {
    const config = loadTokensConfig();
    return config.userTokens[userId]?.accounts || [];
  }

  // Update user's cTrader accounts
  updateUserAccounts(userId, accounts) {
    const config = loadTokensConfig();
    if (config.userTokens[userId]) {
      config.userTokens[userId].accounts = accounts;
      config.userTokens[userId].accountsUpdatedAt = new Date().toISOString();
      saveTokensConfig(config);
      return true;
    }
    return false;
  }

  // Revoke user tokens
  revokeUserTokens(userId) {
    const config = loadTokensConfig();
    if (config.userTokens[userId]) {
      delete config.userTokens[userId];
      saveTokensConfig(config);
      return true;
    }
    return false;
  }

  // Generate JWT for authenticated user
  generateUserJWT(userId, ctraderData) {
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    return jwt.sign(
      {
        userId,
        ctrader: {
          authenticated: true,
          accountsCount: ctraderData.accounts?.length || 0,
        },
      },
      jwtSecret,
      { expiresIn: '7d' }
    );
  }
}

export default new CtraderAuthService();
