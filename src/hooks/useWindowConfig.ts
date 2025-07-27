import { useEffect, useState } from 'react';

import { WindowConfig } from '../types/electron';

export const useWindowConfig = () => {
  const [windowConfig, setWindowConfig] = useState<WindowConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getWindowConfig = async () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const config = await window.electronAPI.getWindowConfig();
          setWindowConfig(config);
        } catch (error) {
          console.error('Error getting window config:', error);
          // Fallback configuration
          setWindowConfig({
            platform: 'unknown',
            isMacOS: false,
            hasTitleBar: false,
            hasFrame: false,
            hasMenuBar: false,
          });
        }
      } else {
        // Fallback for web browsers
        setWindowConfig({
          platform: 'web',
          isMacOS: false,
          hasTitleBar: false,
          hasFrame: false,
          hasMenuBar: false,
        });
      }
      setLoading(false);
    };

    getWindowConfig();
  }, []);

  return { windowConfig, loading };
};
