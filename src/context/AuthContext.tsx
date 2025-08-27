import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  secretKey: string | null;
  userInfo: UserInfo | null;
  error: string | null;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
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

// Valid subscription types
const VALID_SUBSCRIPTION_TYPES = ['free', 'premium', 'unlimited', 'managed_vps', 'admin'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Add debounce mechanism to prevent multiple simultaneous validations
  const validationInProgress = useRef<boolean>(false);
  const validationPromise = useRef<Promise<{ valid: boolean; userInfo?: UserInfo; message?: string }> | null>(null);

  // Validar licencia contra API externa
  const validateLicense = async (
    apiKey: string
  ): Promise<{ valid: boolean; userInfo?: UserInfo; message?: string }> => {
    // If validation is already in progress, wait for it
    if (validationInProgress.current && validationPromise.current) {
      console.log('⏳ Validation already in progress, waiting for result...');
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

  // Internal function that performs the actual validation
  const performValidation = async (
    apiKey: string
  ): Promise<{ valid: boolean; userInfo?: UserInfo; message?: string }> => {
    try {
      const baseEndpoint =
        import.meta.env.VITE_LICENSE_API_URL || 'http://localhost:30/api/validate-subscription';
      const url = `${baseEndpoint}?apiKey=${encodeURIComponent(apiKey)}`;

      console.log('🔍 AuthContext: Validating license with URL:', url);

      const response = await fetch(url);
      console.log('🔍 AuthContext: Response status:', response.status);

      if (!response.ok) {
        console.log('🔍 AuthContext: Response not ok, status:', response.status);
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
      console.log('🔍 AuthContext: User data received:', userData);

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
      console.error('💥 License validation error:', error);
      console.error('💥 Error details:', error);

      // Solo error de conexión real - no mock data
      const errorMessage =
        'Connection error. Check your internet connection and ensure the server is running.';
      return {
        valid: false,
        message: errorMessage,
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
        setError(validation.message || 'Invalid license or inactive subscription');
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
  const logout = async () => {
    const currentSecretKey = secretKey;

    // Clear all local state immediately
    setIsAuthenticated(false);
    setSecretKey(null);
    setUserInfo(null);
    setError(null);

    // Clear ALL data from localStorage
    try {
      // Clear auth-related data
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}_last_validation`);
      localStorage.removeItem(`${STORAGE_KEY}_user_info`);

      // Clear any other app data that might be stored
      localStorage.removeItem('secretKey'); // Used by csvFrontendService
      localStorage.removeItem('hiddenPendingAccounts'); // Used by useHiddenPendingAccounts

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
      console.error('Error clearing localStorage:', error);
    }

    // Clear backend data if we have an API key
    if (currentSecretKey) {
      try {
        const response = await fetch(
          `/api/clear-user-data?apiKey=${encodeURIComponent(currentSecretKey)}`,
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
            console.warn('⚠️ Some backend data cleanup had errors:', result.cleared.errors);
          }
        } else {
          console.error('❌ Failed to clear backend data:', response.status);
        }
      } catch (error) {
        console.error('❌ Error calling backend cleanup:', error);
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
      console.log('🔍 AuthContext: Starting authentication check...');
      const storedKey = localStorage.getItem(STORAGE_KEY);
      console.log('🔍 AuthContext: Stored key found:', !!storedKey);

      if (storedKey) {
        // Always validate against server on app startup for security
        console.log('🔍 Validating stored license on app startup...');

        try {
          const validation = await validateLicense(storedKey);
          console.log('🔍 AuthContext: Validation result:', validation);

          if (validation.valid && validation.userInfo) {
            console.log('🔍 AuthContext: Setting authenticated state');
            setSecretKey(storedKey);
            setUserInfo(validation.userInfo);
            setIsAuthenticated(true);

            // Cache the validation timestamp and user info
            const now = Date.now();
            localStorage.setItem(`${STORAGE_KEY}_last_validation`, now.toString());
            localStorage.setItem(`${STORAGE_KEY}_user_info`, JSON.stringify(validation.userInfo));

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
                    logout().catch(error => console.error('Error during automatic logout:', error));
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
            console.warn('Stored license is no longer valid:', validation.message);
          }
        } catch (error) {
          console.warn('Could not validate stored license:', error);
          // Don't remove the key on network errors, just log and continue
          // localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        console.log('🔍 AuthContext: No stored key found, user needs to login');
      }

      console.log('🔍 AuthContext: Setting isLoading to false');
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
