import React from 'react';

import { Dashboard } from './components/Dashboard';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';

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
  return <Dashboard />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
