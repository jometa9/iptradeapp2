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
};
