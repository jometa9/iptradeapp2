import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { SSEService } from '../services/sseService';

interface UseHiddenPendingAccountsReturn {
  isHidden: boolean;
  isBlinking: boolean;
  pendingCount: number;
  toggleHidden: () => void;
}

export const useHiddenPendingAccounts = (): UseHiddenPendingAccountsReturn => {
  const [isHidden, setIsHidden] = useState<boolean>(() => {
    const saved = localStorage.getItem('pendingAccountsHidden');
    return saved ? JSON.parse(saved) : false;
  });

  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const { secretKey } = useAuth();

  // Get pending count directly from server
  const fetchPendingCount = async () => {
    if (!secretKey) return;

    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '30';
      const baseUrl = import.meta.env.VITE_SERVER_URL || `http://localhost:${serverPort}`;

      const response = await fetch(`${baseUrl}/api/accounts/pending/cache`, {
        method: 'GET',
        headers: {
          'x-api-key': secretKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const accountsArray = Object.values(data.pendingAccounts || {});
        setPendingCount(accountsArray.length);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('pendingAccountsHidden', JSON.stringify(isHidden));
  }, [isHidden]);

  // Fetch pending count on mount and when secretKey changes
  useEffect(() => {
    fetchPendingCount();
  }, [secretKey]);

  // SSE listener for real-time pending accounts updates
  useEffect(() => {
    if (!secretKey) return;

    // Connect to SSE
    SSEService.connect(secretKey);

    const handleSSEMessage = (data: any) => {
      // Handle initial data that includes pending accounts
      if (data.type === 'initial_data' && data.accounts?.pendingAccounts) {
        const pendingArray = data.accounts.pendingAccounts;
        setPendingCount(pendingArray.length);
      }

      // Handle pending accounts updates
      if (data.type === 'pendingAccountsUpdated') {
        if (data.accounts && Array.isArray(data.accounts)) {
          setPendingCount(data.accounts.length);
        }
      }

      // Handle account converted events
      if (data.type === 'accountConverted') {
        // Refresh pending count when accounts are converted
        fetchPendingCount();
      }

      // Handle account deleted events
      if (data.type === 'accountDeleted') {
        // Refresh pending count when accounts are deleted
        fetchPendingCount();
      }
    };

    // Add listener
    const listenerId = SSEService.addListener(handleSSEMessage);

    return () => {
      SSEService.removeListener(listenerId);
    };
  }, [secretKey]);

  // Handle blinking when hidden and there are pending accounts
  useEffect(() => {
    if (isHidden && pendingCount > 0) {
      setIsBlinking(true);

      const interval = setInterval(() => {
        setIsBlinking(prev => !prev);
      }, 500); // Blink every 1.5 seconds for smoother transition

      return () => {
        clearInterval(interval);
        setIsBlinking(false);
      };
    } else {
      setIsBlinking(false);
    }
  }, [isHidden, pendingCount]);

  const toggleHidden = () => {
    setIsHidden(prev => !prev);
  };

  return {
    isHidden,
    isBlinking,
    pendingCount,
    toggleHidden,
  };
};
