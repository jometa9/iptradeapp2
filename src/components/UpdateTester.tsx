import React, { useEffect, useState } from 'react';

import { Pause, Play, RotateCcw, TestTube, X } from 'lucide-react';

import type { TestState } from '../context/UpdateTestContext';
import { useUpdateTest } from '../context/UpdateTestContext';
import { useUpdater } from '../hooks/useUpdater';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const getNextPatchVersion = (version: string): string => {
  try {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  } catch {
    return '1.0.1';
  }
};

export const UpdateTester: React.FC = () => {
  const { isTestMode, testState, setTestState, enableTestMode, disableTestMode } = useUpdateTest();
  const { currentVersion } = useUpdater();
  const [isAnimating, setIsAnimating] = useState(false);

  const isDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnimating && testState?.isDownloading) {
      interval = setInterval(() => {
        setTestState((prev: TestState | null) => {
          if (!prev || prev.downloadProgress >= 100) {
            setIsAnimating(false);
            return prev
              ? {
                  ...prev,
                  isDownloading: false,
                  isUpdateReady: true,
                  downloadProgress: 100,
                }
              : null;
          }

          const nextProgress = Math.min(prev.downloadProgress + 2, 100);
          return {
            ...prev,
            downloadProgress: nextProgress,
          };
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isAnimating, testState?.isDownloading, setTestState]);

  if (!isDev) {
    return null;
  }

  const handleTestState = (state: string) => {
    const baseCurrentVersion = currentVersion || '1.0.0';
    const baseNewVersion = getNextPatchVersion(baseCurrentVersion);

    const baseState = {
      currentVersion: baseCurrentVersion,
      newVersion: baseNewVersion,
      downloadProgress: 0,
      error: null,
      isUpdateAvailable: false,
      isDownloading: false,
      isUpdateReady: false,
    };

    switch (state) {
      case 'available':
        setTestState({
          ...baseState,
          isUpdateAvailable: true,
        });
        break;
      case 'downloading':
        setIsAnimating(true);
        setTestState({
          ...baseState,
          isUpdateAvailable: true,
          isDownloading: true,
          downloadProgress: 0,
        });
        break;
      case 'ready':
        setTestState({
          ...baseState,
          isUpdateReady: true,
          downloadProgress: 100,
        });
        break;
      case 'error':
        setTestState({
          ...baseState,
          error: 'Error downloading update. Check your internet connection.',
        });
        break;
      case 'reset':
        disableTestMode();
        setIsAnimating(false);
        break;
    }
  };

  const getCurrentStateText = () => {
    if (!isTestMode || !testState) return 'Inactive';
    if (testState.error) return 'Error';
    if (testState.isUpdateReady) return 'Ready to Install';
    if (testState.isDownloading) return `Downloading ${Math.round(testState.downloadProgress)}%`;
    if (testState.isUpdateAvailable) return 'Available';
    return 'Unknown';
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <Card className="bg-slate-900 text-white border-slate-700 shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Update Tester
            </div>
            <Button
              onClick={() => handleTestState('reset')}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </Button>
          </CardTitle>
          <div className="text-xs text-gray-400">
            Current state:{' '}
            <span className="text-blue-400 font-medium">{getCurrentStateText()}</span>
            {testState?.isDownloading && (
              <div className="mt-1 text-xs text-yellow-400">
                Progress: {Math.round(testState.downloadProgress)}%
                <span className="text-gray-500 ml-1">
                  ({testState.downloadProgress < 100 ? 'Animating...' : 'Complete!'})
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {!isTestMode ? (
            <Button
              onClick={enableTestMode}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Testing
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleTestState('available')}
                  variant="secondary"
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Available
                </Button>
                <Button
                  onClick={() => handleTestState('downloading')}
                  variant="secondary"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isAnimating}
                >
                  {isAnimating ? <Pause className="h-4 w-4" /> : 'Download'}
                </Button>
                <Button
                  onClick={() => handleTestState('ready')}
                  variant="secondary"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Ready
                </Button>
                <Button
                  onClick={() => handleTestState('error')}
                  variant="secondary"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Error
                </Button>
              </div>

              <Button
                onClick={() => handleTestState('reset')}
                variant="outline"
                size="sm"
                className="w-full border-gray-600 text-gray-300 hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </>
          )}

          <div className="text-xs text-gray-500 pt-2 border-t border-slate-700">
            Changes apply to the real UpdateCard above
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
