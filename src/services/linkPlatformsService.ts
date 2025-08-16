const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:30';

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
      console.log('🌐 Making Link Platforms request to:', `${baseUrl}/api/link-platforms`);
      console.log('🔑 Using API key:', secretKey ? 'Present' : 'Missing');

      const response = await fetch(`${baseUrl}/api/link-platforms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey,
        },
      });

      if (!response.ok) {
        console.error('❌ Link Platforms request failed:', response.status, response.statusText);
        const errorData = await response.json();
        console.error('❌ Error details:', errorData);

        // Handle the case where Link Platforms is already running
        if (response.status === 409) {
          throw new Error(errorData.message || 'Link Platforms is already running');
        }

        throw new Error(errorData.message || 'Link Platforms failed');
      }

      console.log('✅ Link Platforms request successful, status:', response.status);
      const result = await response.json();
      console.log('📊 Link Platforms result:', result);
      return result;
    } catch (error) {
      console.error('Link Platforms service error:', error);
      throw error;
    }
  },
};
