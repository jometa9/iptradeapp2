import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  secretKey: string | null;
  userInfo: UserInfo | null;
  error: string | null;
  login: (secretKey: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  onSubscriptionChange: (
    callback: (previousSubscription: string, currentSubscription: string) => void
  ) => void;
}

interface UserInfo {
  userId: string;
  email: string;
  name: string;
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
const TOKEN_STORAGE_KEY = 'iptrade_web_token';

// Valid subscription types
const VALID_SUBSCRIPTION_TYPES = ['free', 'premium', 'unlimited', 'managed_vps', 'admin'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionChangeCallback, setSubscriptionChangeCallback] = useState<
    ((previousSubscription: string, currentSubscription: string) => void) | null
  >(null);

  // Add debounce mechanism to prevent multiple simultaneous validations
  const validationInProgress = useRef<boolean>(false);
  const validationPromise = useRef<Promise<{
    valid: boolean;
    userInfo?: UserInfo;
    message?: string;
  }> | null>(null);

  // Add subscription change polling
  const subscriptionPollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Validar licencia contra API externa
  const validateLicense = async (
    apiKey: string
  ): Promise<{ valid: boolean; userInfo?: UserInfo; message?: string }> => {
    // If validation is already in progress, wait for it
    if (validationInProgress.current && validationPromise.current) {
      return await validationPromise.current;
    }

    // Start new validation
    validationInProgress.current = true;
    validationPromise.current = performValidation(apiKey);

    try {
      const result = await validationPromise.current;
      return result;
    } finally {
      validationInProgress.current = false;
      validationPromise.current = null;
    }
  };

  // Start subscription polling (check every hour)
  const startSubscriptionPolling = (apiKey: string) => {
    // Clear any existing polling
    if (subscriptionPollingInterval.current) {
      clearInterval(subscriptionPollingInterval.current);
    }

    // Start new polling (check every hour)
    subscriptionPollingInterval.current = setInterval(
      async () => {
        const validation = await performValidation(apiKey);
        if (validation.valid && validation.userInfo) {
          const oldSubscription = userInfo?.subscriptionType;
          const newSubscription = validation.userInfo.subscriptionType;

          // Update user info with new subscription data
          setUserInfo(validation.userInfo);
          localStorage.setItem(`${STORAGE_KEY}_user_info`, JSON.stringify(validation.userInfo));
          localStorage.setItem(`${STORAGE_KEY}_last_validation`, Date.now().toString());

          // If subscription type changed, notify
          if (oldSubscription && newSubscription && oldSubscription !== newSubscription) {
            if (subscriptionChangeCallback) {
              subscriptionChangeCallback(oldSubscription, newSubscription);
            }
          }
        }
      },
      60 * 60 * 1000
    ); // 1 hour
  };

  // Stop subscription polling
  const stopSubscriptionPolling = () => {
    if (subscriptionPollingInterval.current) {
      clearInterval(subscriptionPollingInterval.current);
      subscriptionPollingInterval.current = null;
    }
  };

  // Internal function that performs the actual validation
  const performValidation = async (
    apiKey: string
  ): Promise<{ valid: boolean; userInfo?: UserInfo; message?: string }> => {
    try {
      const baseEndpoint =
        import.meta.env.VITE_LICENSE_API_URL || 'http://localhost:30/api/validate-subscription';
      const url = `${baseEndpoint}?apiKey=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, message: 'Invalid license key' };
        }
        if (response.status === 404) {
          return { valid: false, message: 'User not found' };
        }
        // Para otros errores HTTP (400, 403, 500, etc.) - indica licencia inválida
        return { valid: false, message: 'Invalid license' };
      }

      const userData: UserInfo = await response.json();

      // Validate that we have the required fields
      if (!userData.userId || !userData.email || !userData.name || !userData.subscriptionType) {
        return { valid: false, message: 'Invalid user data format' };
      }

      // Validate subscription type
      if (!VALID_SUBSCRIPTION_TYPES.includes(userData.subscriptionType)) {
        return { valid: false, message: 'Invalid subscription type' };
      }

      return { valid: true, userInfo: userData };
    } catch (error) {
      // Solo error de conexión real - no mock data
      const errorMessage =
        'Connection error. Check your internet connection and ensure the server is running.';
      return {
        valid: false,
        message: errorMessage,
      };
    }
  };

  // Función de login con API key
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

        // Start subscription change polling (check every 5 minutes)
        startSubscriptionPolling(key);

        return true;
      } else {
        setError(validation.message || 'Invalid license or inactive subscription');
        return false;
      }
    } catch (error) {
      setError('Unexpected error during login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Función de login con token JWT del sitio web
  const loginWithToken = async (token: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate token against local server endpoint
      const baseUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:30'
          : `${window.location.protocol}//${window.location.hostname}:30`;

      const response = await fetch(`${baseUrl}/api/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Token validation failed' }));
        setError(errorData.error || 'Invalid or expired token');
        return false;
      }

      const validation = await response.json();

      if (validation.valid && validation.userData) {
        const userData = validation.userData;

        // Store both token and API key for compatibility
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.setItem(STORAGE_KEY, userData.apiKey);

        setSecretKey(userData.apiKey);
        setUserInfo(userData);
        setIsAuthenticated(true);

        // Cache the validation timestamp and user info
        const now = Date.now();
        localStorage.setItem(`${STORAGE_KEY}_last_validation`, now.toString());
        localStorage.setItem(`${STORAGE_KEY}_user_info`, JSON.stringify(userData));

        // Start subscription change polling using the API key
        startSubscriptionPolling(userData.apiKey);

        return true;
      } else {
        setError('Invalid token response');
        return false;
      }
    } catch (error) {
      console.error('Token login error:', error);
      setError('Connection error during web authentication');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register subscription change callback
  const registerSubscriptionChangeCallback = (
    callback: (previousSubscription: string, currentSubscription: string) => void
  ) => {
    setSubscriptionChangeCallback(() => callback);
  };

  // Función de logout
  const logout = async () => {
    const currentSecretKey = secretKey;

    // Stop subscription polling
    stopSubscriptionPolling();

    // Clear all local state immediately
    setIsAuthenticated(false);
    setSecretKey(null);
    setUserInfo(null);
    setError(null);

    // Clear ALL data from localStorage
    try {
      // Clear auth-related data
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY); // Clear web token
      localStorage.removeItem(`${STORAGE_KEY}_last_validation`);
      localStorage.removeItem(`${STORAGE_KEY}_user_info`);

      // Clear any other app data that might be stored
      localStorage.removeItem('secretKey'); // Used by csvFrontendService
      localStorage.removeItem('hiddenPendingAccounts'); // Cleanup old data

      // Clear all localStorage keys that might contain user data
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('iptrade_') || key.includes('user') || key.includes('account'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      // Silent error handling
    }

    // Clear backend data if we have an API key
    if (currentSecretKey) {
      try {
        const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:30';
        const response = await fetch(
          `${baseUrl}/api/clear-user-data?apiKey=${encodeURIComponent(currentSecretKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.hasErrors) {
            // Silent error handling
          }
        } else {
          // Silent error handling
        }
      } catch (error) {
        // Silent error handling
        // Don't prevent logout if backend cleanup fails
      }
    }
  };

  // Limpiar error
  const clearError = () => {
    setError(null);
  };

  // Verify authentication when starting the app
  useEffect(() => {
    const checkAuth = async () => {
      // Primero verificar si hay datos preservados de un reinicio
      const preservedKey = localStorage.getItem('iptrade_restart_preserve_key');
      const preservedUser = localStorage.getItem('iptrade_restart_preserve_user');

      let storedKey = localStorage.getItem(STORAGE_KEY);

      // Si hay datos preservados, restaurarlos
      if (preservedKey && preservedUser) {
        try {
          const userData = JSON.parse(preservedUser);

          // Restaurar datos de sesión
          localStorage.setItem(STORAGE_KEY, preservedKey);
          localStorage.setItem(`${STORAGE_KEY}_user_info`, preservedUser);
          localStorage.setItem(`${STORAGE_KEY}_last_validation`, Date.now().toString());

          // Limpiar datos temporales
          localStorage.removeItem('iptrade_restart_preserve_key');
          localStorage.removeItem('iptrade_restart_preserve_user');

          // Establecer estado inmediatamente
          setSecretKey(preservedKey);
          setUserInfo(userData);
          setIsAuthenticated(true);

          // Iniciar polling de suscripción
          startSubscriptionPolling(preservedKey);

          setIsLoading(false);
          return;
        } catch (error) {
          // Limpiar datos corruptos
          localStorage.removeItem('iptrade_restart_preserve_key');
          localStorage.removeItem('iptrade_restart_preserve_user');
        }
      }

      // Continuar con el flujo normal de autenticación
      storedKey = localStorage.getItem(STORAGE_KEY);

      if (storedKey) {
        // Always validate against server on app startup for security

        try {
          const validation = await validateLicense(storedKey);

          if (validation.valid && validation.userInfo) {
            setSecretKey(storedKey);
            setUserInfo(validation.userInfo);
            setIsAuthenticated(true);

            // Cache the validation timestamp and user info
            const now = Date.now();
            localStorage.setItem(`${STORAGE_KEY}_last_validation`, now.toString());
            localStorage.setItem(`${STORAGE_KEY}_user_info`, JSON.stringify(validation.userInfo));

            // Start subscription change polling
            startSubscriptionPolling(storedKey);

            // Set up timer for next validation in 12 hours
            setTimeout(
              () => {
                validateLicense(storedKey).then(validation => {
                  if (validation.valid && validation.userInfo) {
                    setUserInfo(validation.userInfo);
                    localStorage.setItem(`${STORAGE_KEY}_last_validation`, Date.now().toString());
                    localStorage.setItem(
                      `${STORAGE_KEY}_user_info`,
                      JSON.stringify(validation.userInfo)
                    );
                  } else {
                    // License expired, logout user
                    logout().catch(error => {
                      // Silent error handling
                    });
                  }
                });
              },
              12 * 60 * 60 * 1000
            );
          } else {
            // Licencia expirada o inválida
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(`${STORAGE_KEY}_last_validation`);
            localStorage.removeItem(`${STORAGE_KEY}_user_info`);
          }
        } catch (error) {
          // Don't remove the key on network errors, just log and continue
          // localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        // No stored key found, user needs to login
      }

      setIsLoading(false);
      setIsLoading(false);
    };

    checkAuth();

    // Cleanup function to stop polling when component unmounts
    return () => {
      stopSubscriptionPolling();
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    secretKey,
    userInfo,
    error,
    login,
    loginWithToken,
    logout,
    clearError,
    onSubscriptionChange: registerSubscriptionChangeCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
