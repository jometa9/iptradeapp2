import React from 'react';

import { CardDescription, CardHeader, CardTitle } from './ui/card';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <CardHeader className="text-center space-y-4 flex flex-col items-center">
          <img src="/iconShadow025.png" alt="IPTRADE" className="w-16 h-16 text-blue-600" />
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">IPTRADE APP</CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Validating your API Key...
            </CardDescription>
          </div>
        </CardHeader>
      </div>
    </div>
  );
};
