import { createServer } from './standalone.js';

// Configurar servidor para desarrollo en puerto diferente
const { app } = createServer();
const DEV_PORT = 3001;

app.listen(DEV_PORT, (err) => {
  if (err) {
    console.error('[DEV] Failed to start development server:', err);
    process.exit(1);
  } else {
    console.log('=== IPTRADE DEV SERVER STARTED ===');
    console.log(`Development server running on port ${DEV_PORT}`);
    console.log(`Available at: http://localhost:${DEV_PORT}`);
  }
}); 