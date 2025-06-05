import React from 'react';

import { useUpdater } from '../hooks/useUpdater';

export const VersionInfo: React.FC = () => {
  const { isElectron, currentVersion } = useUpdater();

  if (!isElectron) {
    return null;
  }

  return (
    <>
      {currentVersion && (
        <p className="text-sm text-gray-500 z-50 text-center p-2">Version v{currentVersion}</p>
      )}
    </>
  );
};
