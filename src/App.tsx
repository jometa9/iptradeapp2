import { useState, useEffect } from 'react'

function App() {
  const [serverStatus, setServerStatus] = useState<string>('checking...');

  useEffect(() => {
    // Detectar si estamos en desarrollo o producción
    const isDev = window.location.hostname === 'localhost' && window.location.port === '5174';
    const serverPort = isDev ? 3001 : 3000;
    const serverUrl = `http://localhost:${serverPort}/api/status`;
    
    // Verificar el estado del servidor local
    fetch(serverUrl)
      .then(res => res.json())
      .then(data => setServerStatus(`${data.status} (port ${serverPort})`))
      .catch(err => setServerStatus('error: ' + err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">IPTrade App</h1>
        <div className="mb-4">
          <p className="text-gray-600">Server Status: <span className="font-semibold">{serverStatus}</span></p>
        </div>
      </div>
    </div>
  )
}

export default App
