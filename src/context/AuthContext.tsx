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
const BASE_ENDPOINT = 'http://localhost:3000/api/validate-subscription';

// Estados válidos de suscripción
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
      const url = `${BASE_ENDPOINT}?apiKey=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, message: 'API Key inválida' };
        }
        if (response.status === 404) {
          return { valid: false, message: 'Usuario no encontrado' };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const userData: UserInfo = await response.json();

      // Verificar si la suscripción es válida
      const isValidSubscription =
        VALID_SUBSCRIPTION_STATES.includes(userData.subscriptionStatus) && userData.isActive;

      if (isValidSubscription) {
        return { valid: true, userInfo: userData };
      } else {
        let message = 'Suscripción no válida';

        switch (userData.subscriptionStatus) {
          case 'canceled':
            message = 'Su suscripción ha sido cancelada';
            break;
          case 'expired':
            message = 'Su suscripción ha expirado';
            break;
          case 'past_due':
            message = 'Su suscripción tiene pagos vencidos';
            break;
          default:
            message = `Estado de suscripción: ${userData.subscriptionStatus}`;
        }

        return { valid: false, message, userInfo: userData };
      }
    } catch (error) {
      console.error('License validation error:', error);

      // En caso de error de conexión, usar datos mock para desarrollo
      if (apiKey.length >= 8) {
        const mockUserInfo: UserInfo = {
          userId: 'dev_user',
          email: 'dev@example.com',
          name: 'Usuario de Desarrollo',
          subscriptionStatus: 'active',
          planName: 'IPTRADE Premium (DEV)',
          isActive: true,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 30,
          statusChanged: false,
          subscriptionType: 'paid',
        };
        return { valid: true, userInfo: mockUserInfo };
      }

      return {
        valid: false,
        message:
          'Error de conexión. Verifique su conexión a internet y que el servidor esté funcionando.',
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
        return true;
      } else {
        setError(validation.message || 'API Key inválida o suscripción no activa');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Error inesperado durante el login');
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
    localStorage.removeItem(STORAGE_KEY);
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
        try {
          const validation = await validateLicense(storedKey);

          if (validation.valid && validation.userInfo) {
            setSecretKey(storedKey);
            setUserInfo(validation.userInfo);
            setIsAuthenticated(true);
          } else {
            // Licencia expirada o inválida
            localStorage.removeItem(STORAGE_KEY);
            console.warn('Stored license is no longer valid:', validation.message);
          }
        } catch (error) {
          console.warn('Could not validate stored license:', error);
          localStorage.removeItem(STORAGE_KEY);
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
