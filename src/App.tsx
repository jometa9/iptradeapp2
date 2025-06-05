import { useEffect, useState } from 'react';

import { UpdateCard } from './components/UpdateCard';
import { VersionInfo } from './components/VersionInfo';
import { UpdateTestProvider } from './context/UpdateTestContext';

function App() {
  const [serverStatus, setServerStatus] = useState<string>('checking...');

  useEffect(() => {
    const serverPort = import.meta.env.VITE_SERVER_PORT;
    const serverUrl = `http://localhost:${serverPort}/api/status`;

    fetch(serverUrl)
      .then(res => res.json())
      .then(data => setServerStatus(`${data.status} (port ${serverPort})`))
      .catch(err => setServerStatus('error: ' + err.message));
  }, []);

  return (
    <UpdateTestProvider>
      <div className="min-h-screen p-4 space-y-4">
        <UpdateCard />

        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          <h1 className="text-2xl font-bold mb-4">IPTrade App</h1>
          <div className="mb-4">
            <p className="text-gray-600">
              Server Status: <span className="font-semibold">{serverStatus}</span>
            </p>
          </div>
        </div>

        <VersionInfo />
      </div>
    </UpdateTestProvider>
  );
}

export default App;
