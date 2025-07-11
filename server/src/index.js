import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import swaggerUi from 'swagger-ui-express';

import { killProcessOnPort } from './controllers/ordersController.js';
import accountsRoutes from './routes/accounts.js';
import configRoutes from './routes/config.js';
import copierStatusRoutes from './routes/copierStatus.js';
// import ctraderRoutes from './routes/ctrader.js';
// import mt5Routes from './routes/mt5.js';
import orderRoutes from './routes/orders.js';
import slaveConfigRoutes from './routes/slaveConfig.js';
import statusRoutes from './routes/status.js';
import tradingConfigRoutes from './routes/tradingConfig.js';
import swaggerDocs from './swaggerConfig.js';

// Load environment variables from root .env only
// Try to load from current directory first, then from parent directory
const rootEnvPath = join(process.cwd(), '.env');
const parentEnvPath = join(process.cwd(), '..', '.env');

// Check which path exists and load it
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
} else {
  console.warn('⚠️ No .env file found in current or parent directory');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Let's see what environment variables are loaded
console.log('Environment variables:');
console.log('- process.env.PORT:', process.env.PORT);
console.log('- Final PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
// console.log(
//   '- CTRADER_CLIENT_ID:',
//   process.env.CTRADER_CLIENT_ID ? 'configured ✅' : 'NOT configured ❌'
// );
// console.log(
//   '- CTRADER_CLIENT_SECRET:',
//   process.env.CTRADER_CLIENT_SECRET ? 'configured ✅' : 'NOT configured ❌'
// );

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', statusRoutes);
app.use('/api', orderRoutes);
app.use('/api', configRoutes);
app.use('/api', tradingConfigRoutes);
app.use('/api', copierStatusRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/slave-config', slaveConfigRoutes);
// app.use('/api/ctrader', ctraderRoutes);
// app.use('/api/mt5', mt5Routes);

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;

async function startServer() {
  console.log(`🚀 Starting IPTRADE Server on port ${PORT}...`);

  // Kill any existing processes on this port
  await killProcessOnPort(PORT);

  // Wait a moment to ensure port is fully free
  await new Promise(resolve => setTimeout(resolve, 500));

  const startServerAttempt = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(PORT, () => {
        console.log('🎉 === IPTRADE SERVER STARTED ===');
        console.log(`📡 Server running on http://127.0.0.1:${PORT}`);
        console.log(`🔗 Health check: http://127.0.0.1:${PORT}/api/status`);
        resolve(server);
      });

      server.on('error', async err => {
        if (err.code === 'EADDRINUSE') {
          console.log(`⚠️  Port ${PORT} is still in use (attempt ${attempt}/3), cleaning again...`);

          if (attempt < 3) {
            // Try to kill processes again and retry
            await killProcessOnPort(PORT);
            setTimeout(() => {
              startServerAttempt(attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 2000);
          } else {
            console.error(`❌ Unable to start server on port ${PORT} after 3 attempts`);
            console.error('Please check if another application is using this port');
            reject(err);
          }
        } else {
          console.error('❌ [SERVER FAILED TO START]', err);
          reject(err);
        }
      });
    });
  };

  try {
    await startServerAttempt();
  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('server.js')) {
  startServer();
}
