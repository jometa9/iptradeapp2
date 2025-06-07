import React from 'react';

import { Loader2, Shield } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">IPTrade App</h2>
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Validando autenticación...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
