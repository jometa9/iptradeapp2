const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export interface LinkPlatformsResult {
  success: boolean;
  message: string;
  result: {
    mql4Folders: string[];
    mql5Folders: string[];
    created: number;
    synced: number;
    errors: string[];
    filesCreated?: number;
    csvFiles?: string[];
  };
}

export const linkPlatformsService = {
  async linkPlatforms(secretKey: string): Promise<LinkPlatformsResult> {
    try {
      const response = await fetch(`${baseUrl}/api/link-platforms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Link Platforms failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Link Platforms service error:', error);
      throw error;
    }
  }
};
