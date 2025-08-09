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
          console.log('🖥️ Electron platform detected:', platform);

          // Map Electron platform to our OS type
          switch (platform) {
            case 'win32':
              setOs('windows');
              break;
            case 'darwin':
              setOs('macos');
              break;
            case 'linux':
              setOs('linux');
              break;
            default:
              setOs('unknown');
          }
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
