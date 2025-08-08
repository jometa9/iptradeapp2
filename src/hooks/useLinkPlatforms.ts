import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { linkPlatformsService } from '../services/linkPlatformsService';
import type { LinkPlatformsResult } from '../services/linkPlatformsService';

export const useLinkPlatforms = () => {
  const { secretKey } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [lastResult, setLastResult] = useState<LinkPlatformsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkPlatforms = async () => {
    if (!secretKey) {
      setError('Authentication required');
      return;
    }

    setIsLinking(true);
    setError(null);

    try {
      console.log('🔗 Starting Link Platforms process...');
      
      const result = await linkPlatformsService.linkPlatforms(secretKey);
      
      setLastResult(result);
      
      console.log('✅ Link Platforms completed:', result);
      
      if (result.result.errors.length > 0) {
        console.warn('⚠️ Link Platforms completed with errors:', result.result.errors);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Link Platforms failed';
      setError(errorMessage);
      console.error('❌ Link Platforms error:', err);
      throw err;
    } finally {
      setIsLinking(false);
    }
  };

  return {
    linkPlatforms,
    isLinking,
    lastResult,
    error,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null)
  };
};
