import React, { createContext, useContext, useEffect, useState } from 'react';

import { useAuth } from './AuthContext';
import { useUnifiedAccountData } from '../hooks/useUnifiedAccountData';

// Create context
const UnifiedAccountDataContext = createContext<ReturnType<typeof useUnifiedAccountData> | null>(null);

// Provider component
export const UnifiedAccountDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { secretKey } = useAuth();
  const unifiedData = useUnifiedAccountData();

  // Log to track provider instances
  console.log('🔧 [UnifiedAccountDataProvider] Provider rendered, secretKey:', !!secretKey);

  // Only provide data if authenticated
  if (!secretKey) {
    return <>{children}</>;
  }

  return (
    <UnifiedAccountDataContext.Provider value={unifiedData}>
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
