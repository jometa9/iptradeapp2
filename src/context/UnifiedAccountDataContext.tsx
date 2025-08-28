import React, { createContext, useContext, useEffect, useState } from 'react';

import { useAuth } from './AuthContext';
import { useUnifiedAccountData } from '../hooks/useUnifiedAccountData';

// Create context
const UnifiedAccountDataContext = createContext<ReturnType<typeof useUnifiedAccountData> | null>(null);

// Provider component
export const UnifiedAccountDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { secretKey } = useAuth();
  const unifiedData = useUnifiedAccountData();
  const [isHidden, setIsHidden] = useState(() => {
    const saved = localStorage.getItem('pendingAccountsHidden');
    return saved ? JSON.parse(saved) : false;
  });
  const [isBlinking, setIsBlinking] = useState(false);
  
  // Effect para manejar el parpadeo cuando hay cuentas pending
  useEffect(() => {
    if (!unifiedData.data?.pendingAccounts?.length) {
      setIsBlinking(false);
      return;
    }

    const blinkInterval = setInterval(() => {
      setIsBlinking(prev => !prev);
    }, 500); // Parpadeo cada 500ms

    return () => clearInterval(blinkInterval);
  }, [unifiedData.data?.pendingAccounts?.length]);

  const toggleHidden = () => {
    setIsHidden(prev => {
      const newValue = !prev;
      localStorage.setItem('pendingAccountsHidden', JSON.stringify(newValue));
      return newValue;
    });
  };

  // Add visibility state to context value
  const contextValue = {
    ...unifiedData,
    isHidden,
    isBlinking,
    toggleHidden
  };

  if (!secretKey) {
    return <>{children}</>;
  }

  return (
    <UnifiedAccountDataContext.Provider value={contextValue}>
      {children}
    </UnifiedAccountDataContext.Provider>
  );
};

// Custom hook to use the context
export const useUnifiedAccountDataContext = () => {
  const context = useContext(UnifiedAccountDataContext);
  if (!context) {
    throw new Error('useUnifiedAccountDataContext must be used within a UnifiedAccountDataProvider');
  }
  return context;
};
