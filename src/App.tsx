import React from 'react';

import { Dashboard } from './components/Dashboard';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UnifiedAccountDataProvider } from './context/UnifiedAccountDataContext';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('🔍 App: isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  if (isLoading) {
    console.log('🔍 App: Showing LoadingScreen');
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log('🔍 App: Showing LoginScreen');
    return <LoginScreen />;
  }

  console.log('🔍 App: Showing Dashboard');
  return (
    <UnifiedAccountDataProvider>
      <Dashboard />
    </UnifiedAccountDataProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
