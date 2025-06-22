import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  secretKey: string | null;
  userInfo: UserInfo | null;
  error: string | null;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

interface UserInfo {
  userId: string;
  email: string;
  name: string;
  subscriptionStatus: string;
  planName: string;
  isActive: boolean;
  expiryDate: string;
  daysRemaining: number;
  statusChanged: boolean;
  subscriptionType: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const STORAGE_KEY = 'iptrade_license_key';

// Valid subscription states
const VALID_SUBSCRIPTION_STATES = ['active', 'trialing', 'admin_assigned'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validar licencia contra API externa
  const validateLicense = async (
    apiKey: string
  ): Promise<{ valid: boolean; userInfo?: UserInfo; message?: string }> => {
    try {
      const baseEndpoint = import.meta.env.VITE_LICENSE_API_URL;
      const url = `${baseEndpoint}?apiKey=${encodeURIComponent(apiKey)}`;
      console.log('Making request to:', url);
      const response = await fetch(url);

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('401 - Invalid API Key');
          return { valid: false, message: 'Invalid API Key' };
        }
        if (response.status === 404) {
          console.log('404 - User not found');
          return { valid: false, message: 'User not found' };
        }
        // Para otros errores HTTP (400, 403, 500, etc.) - indica licencia inválida
        console.log('Other HTTP error:', response.status);
        return { valid: false, message: 'Invalid license' };
      }

      const userData: UserInfo = await response.json();

      // Verificar si la suscripción es válida
      const isValidSubscription =
        VALID_SUBSCRIPTION_STATES.includes(userData.subscriptionStatus) && userData.isActive;

      if (isValidSubscription) {
        return { valid: true, userInfo: userData };
      } else {
        let message = 'Invalid subscription';

        switch (userData.subscriptionStatus) {
          case 'canceled':
            message = 'Your subscription has been canceled';
            break;
          case 'expired':
            message = 'Your subscription has expired';
            break;
          case 'past_due':
            message = 'Your subscription has overdue payments';
            break;
          default:
            message = `Subscription status: ${userData.subscriptionStatus}`;
        }

        return { valid: false, message, userInfo: userData };
      }
    } catch (error) {
      console.error('License validation error:', error);

      // Solo error de conexión real - no mock data
      return {
        valid: false,
        message:
          'Connection error. Check your internet connection and ensure the server is running.',
      };
    }
  };

  // Función de login
  const login = async (key: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = await validateLicense(key);

      if (validation.valid && validation.userInfo) {
        setSecretKey(key);
        setUserInfo(validation.userInfo);
        setIsAuthenticated(true);
        localStorage.setItem(STORAGE_KEY, key);

        // Cache the validation timestamp and user info
        const now = Date.now();
        localStorage.setItem(`${STORAGE_KEY}_last_validation`, now.toString());
        localStorage.setItem(`${STORAGE_KEY}_user_info`, JSON.stringify(validation.userInfo));

        return true;
      } else {
        setError(validation.message || 'Invalid API Key or inactive subscription');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Unexpected error during login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Función de logout
  const logout = () => {
    setIsAuthenticated(false);
    setSecretKey(null);
    setUserInfo(null);
    setError(null);
    // Clear all auth-related data from localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_last_validation`);
    localStorage.removeItem(`${STORAGE_KEY}_user_info`);
  };

  // Limpiar error
  const clearError = () => {
    setError(null);
  };

  // Verificar autenticación al iniciar la app
  useEffect(() => {
    const checkAuth = async () => {
      const storedKey = localStorage.getItem(STORAGE_KEY);

      if (storedKey) {
        // Check if we recently validated this key to avoid unnecessary API calls
        const lastValidationKey = `${STORAGE_KEY}_last_validation`;
        const lastValidation = localStorage.getItem(lastValidationKey);
        const now = Date.now();

        // Only revalidate if it's been more than 5 minutes since last validation
        if (lastValidation && now - parseInt(lastValidation) < 5 * 60 * 1000) {
          console.log('🕒 Using cached license validation (less than 5 minutes old)');
          // Try to get cached user info
          const cachedUserInfo = localStorage.getItem(`${STORAGE_KEY}_user_info`);
          if (cachedUserInfo) {
            try {
              const userInfo = JSON.parse(cachedUserInfo);
              setSecretKey(storedKey);
              setUserInfo(userInfo);
              setIsAuthenticated(true);
              setIsLoading(false);
              return;
            } catch (parseError) {
              console.warn('Failed to parse cached user info:', parseError);
            }
          }
        }

        try {
          console.log('🔄 Validating stored license...');
          const validation = await validateLicense(storedKey);

          if (validation.valid && validation.userInfo) {
            setSecretKey(storedKey);
            setUserInfo(validation.userInfo);
            setIsAuthenticated(true);

            // Cache the validation timestamp and user info
            localStorage.setItem(lastValidationKey, now.toString());
            localStorage.setItem(`${STORAGE_KEY}_user_info`, JSON.stringify(validation.userInfo));
          } else {
            // Licencia expirada o inválida
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(lastValidationKey);
            localStorage.removeItem(`${STORAGE_KEY}_user_info`);
            console.warn('Stored license is no longer valid:', validation.message);
          }
        } catch (error) {
          console.warn('Could not validate stored license:', error);
          // Don't remove the key on network errors, just log and continue
          // localStorage.removeItem(STORAGE_KEY);
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    secretKey,
    userInfo,
    error,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
