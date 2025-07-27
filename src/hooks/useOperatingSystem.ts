import { useEffect, useState } from 'react';

export type OperatingSystem = 'windows' | 'macos' | 'linux' | 'unknown';

export const useOperatingSystem = () => {
  const [os, setOs] = useState<OperatingSystem>('unknown');

  useEffect(() => {
    const detectOS = async () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          // Use Electron API to get OS
          const platform = await window.electronAPI.getPlatform();
          setOs(platform as OperatingSystem);
        } catch (error) {
          // Fallback to user agent detection
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes('win')) {
            setOs('windows');
          } else if (userAgent.includes('mac')) {
            setOs('macos');
          } else if (userAgent.includes('linux')) {
            setOs('linux');
          } else {
            setOs('unknown');
          }
        }
      } else {
        // Fallback for web browsers
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) {
          setOs('windows');
        } else if (userAgent.includes('mac')) {
          setOs('macos');
        } else if (userAgent.includes('linux')) {
          setOs('linux');
        } else {
          setOs('unknown');
        }
      }
    };

    detectOS();
  }, []);

  return os;
};
