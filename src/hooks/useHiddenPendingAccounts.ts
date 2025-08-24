import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';

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
        const count = accountsArray.length;
        setPendingCount(count);
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

  // Handle blinking when hidden and there are pending accounts
  useEffect(() => {
    if (isHidden && pendingCount > 0) {
      setIsBlinking(true);

      const interval = setInterval(() => {
        setIsBlinking(prev => !prev);
      }, 500); // Toggle every 500ms

      return () => {
        clearInterval(interval);
        setIsBlinking(false);
      };
    } else {
      setIsBlinking(false);
    }
  }, [isHidden, pendingCount]);

  // Periodically fetch pending count when hidden
  useEffect(() => {
    if (isHidden) {
      const interval = setInterval(() => {
        fetchPendingCount();
      }, 2000); // Check every 2 seconds when hidden

      return () => {
        clearInterval(interval);
      };
    }
  }, [isHidden]);

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
