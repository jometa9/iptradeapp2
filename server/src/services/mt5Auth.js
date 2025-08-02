import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Mt5AuthService {
  constructor() {
    this.accountsFile = join(process.cwd(), 'config', 'mt5_accounts.json');
    this.ensureConfigDirectory();
    this.loadAccounts();
  }

  // Ensure config directory exists
  ensureConfigDirectory() {
    const configDir = join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  // Load stored accounts
  loadAccounts() {
    try {
      if (fs.existsSync(this.accountsFile)) {
        const data = fs.readFileSync(this.accountsFile, 'utf8');
        this.accounts = JSON.parse(data);
      } else {
        this.accounts = {};
        this.saveAccounts();
      }
    } catch (error) {
      console.error('Error loading MT5 accounts:', error);
      this.accounts = {};
    }
  }

  // Save accounts to file
  saveAccounts() {
    try {
      fs.writeFileSync(this.accountsFile, JSON.stringify(this.accounts, null, 2));
    } catch (error) {
      console.error('Error saving MT5 accounts:', error);
    }
  }

  // Store account credentials (encrypted in production)
  storeAccountCredentials(userId, accountData) {
    try {
      if (!this.accounts[userId]) {
        this.accounts[userId] = {
          accounts: [],
          lastLogin: null,
          preferences: {
            autoConnect: false,
            defaultTerminalPath: null,
          },
        };
      }

      // Check if account already exists
      const existingIndex = this.accounts[userId].accounts.findIndex(
        acc => acc.account === accountData.account && acc.server === accountData.server
      );

      const accountEntry = {
        account: accountData.account,
        password: accountData.password, // In production, encrypt this
        server: accountData.server,
        name: accountData.name || `Account ${accountData.account}`,
        isDemo: accountData.isDemo || false,
        storedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // Update existing account
        this.accounts[userId].accounts[existingIndex] = accountEntry;
      } else {
        // Add new account
        this.accounts[userId].accounts.push(accountEntry);
      }

      this.accounts[userId].lastLogin = new Date().toISOString();
      this.saveAccounts();

      return true;
    } catch (error) {
      console.error('Error storing MT5 account credentials:', error);
      return false;
    }
  }

  // Get stored accounts for user
  getUserAccounts(userId) {
    try {
      const userData = this.accounts[userId];
      if (!userData || !userData.accounts) {
        return [];
      }

      // Return accounts without sensitive data
      return userData.accounts.map(acc => ({
        account: acc.account,
        server: acc.server,
        name: acc.name,
        isDemo: acc.isDemo,
        lastUsed: acc.lastUsed,
        hasCredentials: true,
      }));
    } catch (error) {
      console.error('Error getting user accounts:', error);
      return [];
    }
  }

  // Get account credentials for login
  getAccountCredentials(userId, account, server) {
    try {
      const userData = this.accounts[userId];
      if (!userData || !userData.accounts) {
        return null;
      }

      const accountData = userData.accounts.find(
        acc => acc.account === account && acc.server === server
      );

      if (accountData) {
        // Update last used
        accountData.lastUsed = new Date().toISOString();
        this.saveAccounts();
        return {
          account: accountData.account,
          password: accountData.password, // In production, decrypt this
          server: accountData.server,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting account credentials:', error);
      return null;
    }
  }

  // Remove account
  removeAccount(userId, account, server) {
    try {
      const userData = this.accounts[userId];
      if (!userData || !userData.accounts) {
        return false;
      }

      const initialLength = userData.accounts.length;
      userData.accounts = userData.accounts.filter(
        acc => !(acc.account === account && acc.server === server)
      );

      if (userData.accounts.length < initialLength) {
        this.saveAccounts();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error removing account:', error);
      return false;
    }
  }

  // Update user preferences
  updateUserPreferences(userId, preferences) {
    try {
      if (!this.accounts[userId]) {
        this.accounts[userId] = {
          accounts: [],
          lastLogin: null,
          preferences: {},
        };
      }

      this.accounts[userId].preferences = {
        ...this.accounts[userId].preferences,
        ...preferences,
      };

      this.saveAccounts();
      return true;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return false;
    }
  }

  // Get user preferences
  getUserPreferences(userId) {
    try {
      const userData = this.accounts[userId];
      if (!userData) {
        return {
          autoConnect: false,
          defaultTerminalPath: null,
        };
      }

      return (
        userData.preferences || {
          autoConnect: false,
          defaultTerminalPath: null,
        }
      );
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        autoConnect: false,
        defaultTerminalPath: null,
      };
    }
  }

  // Check if user has any stored accounts
  hasStoredAccounts(userId) {
    try {
      const userData = this.accounts[userId];
      return userData && userData.accounts && userData.accounts.length > 0;
    } catch (error) {
      console.error('Error checking stored accounts:', error);
      return false;
    }
  }

  // Get user statistics
  getUserStats(userId) {
    try {
      const userData = this.accounts[userId];
      if (!userData) {
        return {
          totalAccounts: 0,
          lastLogin: null,
          demoAccounts: 0,
          liveAccounts: 0,
        };
      }

      const accounts = userData.accounts || [];
      return {
        totalAccounts: accounts.length,
        lastLogin: userData.lastLogin,
        demoAccounts: accounts.filter(acc => acc.isDemo).length,
        liveAccounts: accounts.filter(acc => !acc.isDemo).length,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalAccounts: 0,
        lastLogin: null,
        demoAccounts: 0,
        liveAccounts: 0,
      };
    }
  }

  // Clean up old accounts
  cleanupOldAccounts() {
    try {
      const now = new Date();
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days

      let cleaned = false;
      for (const userId in this.accounts) {
        const userData = this.accounts[userId];
        if (userData.accounts) {
          const initialLength = userData.accounts.length;
          userData.accounts = userData.accounts.filter(acc => {
            const lastUsed = new Date(acc.lastUsed);
            return now - lastUsed < maxAge;
          });

          if (userData.accounts.length < initialLength) {
            cleaned = true;
          }
        }
      }

      if (cleaned) {
        this.saveAccounts();
      }
    } catch (error) {
      console.error('Error cleaning up old accounts:', error);
    }
  }

  // Export user data
  exportUserData(userId) {
    try {
      const userData = this.accounts[userId];
      if (!userData) {
        return null;
      }

      // Return data without sensitive information
      return {
        accounts: userData.accounts.map(acc => ({
          account: acc.account,
          server: acc.server,
          name: acc.name,
          isDemo: acc.isDemo,
          lastUsed: acc.lastUsed,
          storedAt: acc.storedAt,
        })),
        preferences: userData.preferences,
        lastLogin: userData.lastLogin,
        stats: this.getUserStats(userId),
      };
    } catch (error) {
      console.error('Error exporting user data:', error);
      return null;
    }
  }

  // Import user data
  importUserData(userId, data) {
    try {
      if (!data || !data.accounts) {
        return false;
      }

      // Validate data structure
      const validAccounts = data.accounts.filter(
        acc => acc.account && acc.server && typeof acc.account === 'string'
      );

      if (validAccounts.length === 0) {
        return false;
      }

      this.accounts[userId] = {
        accounts: validAccounts.map(acc => ({
          ...acc,
          password: '', // Will need to be set manually
          storedAt: new Date().toISOString(),
        })),
        preferences: data.preferences || {
          autoConnect: false,
          defaultTerminalPath: null,
        },
        lastLogin: new Date().toISOString(),
      };

      this.saveAccounts();
      return true;
    } catch (error) {
      console.error('Error importing user data:', error);
      return false;
    }
  }

  // Clear all user data (for logout)
  clearUserData(userId) {
    try {
      if (this.accounts[userId]) {
        delete this.accounts[userId];
        this.saveAccounts();
        console.log(
          `🗑️ Cleared all MT5 data for user: ${userId ? userId.substring(0, 8) : 'unknown'}...`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error clearing MT5 user data:', error);
      return false;
    }
  }
}

// Create singleton instance
const Mt5AuthServiceInstance = new Mt5AuthService();

// Cleanup old accounts every 24 hours
setInterval(
  () => {
    Mt5AuthServiceInstance.cleanupOldAccounts();
  },
  24 * 60 * 60 * 1000
);

export default Mt5AuthServiceInstance;
