import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';

export interface TestState {
  isUpdateAvailable: boolean;
  isDownloading: boolean;
  isUpdateReady: boolean;
  downloadProgress: number;
  error: string | null;
  currentVersion: string;
  newVersion: string;
}

interface UpdateTestContextType {
  isTestMode: boolean;
  testState: TestState | null;
  setTestState: (state: TestState | null | ((prev: TestState | null) => TestState | null)) => void;
  enableTestMode: () => void;
  disableTestMode: () => void;
}

const UpdateTestContext = createContext<UpdateTestContextType | undefined>(undefined);

export const useUpdateTest = () => {
  const context = useContext(UpdateTestContext);
  if (context === undefined) {
    throw new Error('useUpdateTest must be used within an UpdateTestProvider');
  }
  return context;
};

interface UpdateTestProviderProps {
  children: ReactNode;
}

export const UpdateTestProvider: React.FC<UpdateTestProviderProps> = ({ children }) => {
  const [isTestMode, setIsTestMode] = useState(false);
  const [testState, setTestState] = useState<TestState | null>(null);

  const isDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const enableTestMode = () => {
    if (isDev) {
      setIsTestMode(true);
    }
  };

  const disableTestMode = () => {
    setIsTestMode(false);
    setTestState(null);
  };

  const value = {
    isTestMode: isTestMode && isDev,
    testState,
    setTestState,
    enableTestMode,
    disableTestMode,
  };

  return <UpdateTestContext.Provider value={value}>{children}</UpdateTestContext.Provider>;
};
