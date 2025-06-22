import dotenv from 'dotenv';

import { killProcessOnPort } from './controllers/ordersController.js';
import { createServer } from './standalone.js';

// Load environment variables
dotenv.config();

const { app } = createServer();
const DEV_PORT = process.env.PORT || 3000;

// Debug: Let's see what PORT is actually being used
console.log('🔧 DEV MODE Environment variables:');
console.log('- process.env.PORT:', process.env.PORT);
console.log('- Final DEV_PORT:', DEV_PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);

async function startDevServer() {
  console.log(`🚀 Starting IPTRADE DEV Server on port ${DEV_PORT}...`);

  // Kill any existing processes on this port
  await killProcessOnPort(DEV_PORT);

  // Wait a moment to ensure port is fully free
  await new Promise(resolve => setTimeout(resolve, 500));

  const startServerAttempt = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(DEV_PORT, () => {
        console.log('🎉 === IPTRADE DEV SERVER STARTED ===');
        console.log(`📡 Development server running on port ${DEV_PORT}`);
        console.log(`🔗 Available at: http://localhost:${DEV_PORT}`);
        console.log(`🔗 Health check: http://localhost:${DEV_PORT}/api/status`);
        resolve(server);
      });

      server.on('error', async err => {
        if (err.code === 'EADDRINUSE') {
          console.log(
            `⚠️  Port ${DEV_PORT} is still in use (attempt ${attempt}/3), cleaning again...`
          );

          if (attempt < 3) {
            // Try to kill processes again and retry
            await killProcessOnPort(DEV_PORT);
            setTimeout(() => {
              startServerAttempt(attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 2000);
          } else {
            console.error(`❌ Unable to start dev server on port ${DEV_PORT} after 3 attempts`);
            console.error('Please check if another application is using this port');
            reject(err);
          }
        } else {
          console.error('❌ [DEV SERVER FAILED TO START]', err);
          reject(err);
        }
      });
    });
  };

  try {
    await startServerAttempt();
  } catch (error) {
    console.error('💥 Failed to start dev server:', error.message);
    process.exit(1);
  }
}

startDevServer();
