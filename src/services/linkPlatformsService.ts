const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export interface LinkPlatformsResult {
  success: boolean;
  message: string;
  backgroundProcess?: boolean;
  isLinking?: boolean;
  result?: {
    mql4Folders: string[];
    mql5Folders: string[];
    ninjaTraderFolders?: string[];
    created: number;
    synced: number;
    errors: string[];
    filesCreated?: number;
    csvFiles?: string[];
  };
}

export interface LinkingStatus {
  isLinking: boolean;
  timestamp: string;
  lastResult?: any;
  lastTimestamp?: string;
}

export const linkPlatformsService = {
  async getLinkingStatus(secretKey: string): Promise<LinkingStatus> {
    try {
      const response = await fetch(`${baseUrl}/api/link-platforms/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  },

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
        const errorData = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errorData);
        } catch (parseError) {
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
        }
        throw new Error(parsedError.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  },

  async findBots(secretKey: string): Promise<LinkPlatformsResult> {
    const startTime = Date.now();
    console.log('🔍 FRONTEND SERVICE: findBots called at', new Date().toISOString());
    console.log('🔍 FRONTEND SERVICE: baseUrl:', baseUrl);
    console.log('🔍 FRONTEND SERVICE: secretKey length:', secretKey?.length || 0);
    
    try {
      const url = `${baseUrl}/api/link-platforms/find-bots`;
      console.log('🔍 FRONTEND SERVICE: Making POST request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey,
        },
      });

      const duration = Date.now() - startTime;
      console.log(`🔍 FRONTEND SERVICE: Response received after ${duration}ms`);
      console.log('🔍 FRONTEND SERVICE: Response status:', response.status);
      console.log('🔍 FRONTEND SERVICE: Response ok:', response.ok);
      console.log('🔍 FRONTEND SERVICE: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ FRONTEND SERVICE: Error response data:', errorData);
        let parsedError;
        try {
          parsedError = JSON.parse(errorData);
          console.error('❌ FRONTEND SERVICE: Parsed error:', parsedError);
        } catch (parseError) {
          console.error('❌ FRONTEND SERVICE: Error parsing response:', parseError);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
        }
        throw new Error(parsedError.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🔍 FRONTEND SERVICE: Success response:', result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ FRONTEND SERVICE: Error after ${duration}ms:`, error);
      throw error;
    }
  },
};
