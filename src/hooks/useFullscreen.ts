import { useEffect, useState } from 'react';

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const checkFullscreen = async () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          // Use Electron API to get fullscreen state
          const fullscreenState = await window.electronAPI.getFullscreenState();
          setIsFullscreen(fullscreenState);
        } catch (error) {
          // Fallback to window size check
          const isFullscreenMode =
            window.innerWidth === screen.width && window.innerHeight === screen.height;
          setIsFullscreen(isFullscreenMode);
        }
      } else {
        // Fallback for web browsers
        const browserFullscreen = document.fullscreenElement !== null;
        setIsFullscreen(browserFullscreen);
      }
    };

    // Check initially
    checkFullscreen();

    // Listen for fullscreen changes from Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onFullscreenChanged((isFullscreenState: boolean) => {
        setIsFullscreen(isFullscreenState);
      });
    }

    // Listen for resize events as fallback
    const handleResize = () => {
      if (!window.electronAPI) {
        checkFullscreen();
      }
    };

    window.addEventListener('resize', handleResize);

    // Listen for fullscreen change events (for web browsers)
    const handleFullscreenChange = () => {
      if (!window.electronAPI) {
        checkFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return isFullscreen;
};
