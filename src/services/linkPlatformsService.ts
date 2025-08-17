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
      console.log('🔗 Full URL:', `${baseUrl}/api/link-platforms`);
      console.log('📡 Request headers:', {
        'Content-Type': 'application/json',
        'x-api-key': secretKey ? `${secretKey.substring(0, 10)}...` : 'Missing',
      });

      const response = await fetch(`${baseUrl}/api/link-platforms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey,
        },
      });

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        console.error('❌ Link Platforms request failed:', response.status, response.statusText);
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('❌ Failed to parse error response as JSON:', parseError);
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
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
      console.error('❌ Link Platforms service error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ Network error - is the server running?');
        console.error('❌ Trying to connect to:', `${baseUrl}/api/link-platforms`);
      }
      throw error;
    }
  },
};
