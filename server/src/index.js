import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';

// import mt5Routes from './routes/mt5.js';
import linkPlatformsController from './controllers/linkPlatformsController.js';
import { killProcessOnPort } from './controllers/ordersController.js';
import accountsRoutes from './routes/accounts.js';
import configRoutes from './routes/config.js';
import copierStatusRoutes from './routes/copierStatus.js';
import csvRoutes from './routes/csvRoutes.js';
// import ctraderRoutes from './routes/ctrader.js';
import eventRoutes from './routes/events.js';
import linkPlatformsRoutes from './routes/linkPlatforms.js';
import orderRoutes from './routes/orders.js';
import restartRoutes from './routes/restart.js';
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
const PORT = process.env.PORT || 30;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', statusRoutes);
app.use('/api', orderRoutes);
app.use('/api', configRoutes);
app.use('/api', tradingConfigRoutes);
app.use('/api', copierStatusRoutes);
app.use('/api', csvRoutes);
app.use('/api', eventRoutes);
app.use('/api', restartRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/slave-config', slaveConfigRoutes);
app.use('/api/link-platforms', linkPlatformsRoutes);
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

  // Kill any existing processes on this port
  await killProcessOnPort(PORT);

  // Wait a moment to ensure port is fully free
  await new Promise(resolve => setTimeout(resolve, 500));

  const startServerAttempt = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(PORT, () => {
        (async () => {
          try {
            const result = await linkPlatformsController.findAndSyncMQLFoldersOptimized();
          } catch (err) {
            console.error('❌ Auto Link Platforms failed on start:', err);
          }
        })();
        resolve(server);
      });

      server.on('error', async err => {
        if (err.code === 'EADDRINUSE') {
          (`⚠️  Port ${PORT} is still in use (attempt ${attempt}/3), cleaning again...`);

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
