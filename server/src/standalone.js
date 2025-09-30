import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';

import accountsRoutes from './routes/accounts.js';
import configRoutes from './routes/config.js';
import copierStatusRoutes from './routes/copierStatus.js';
import csvRoutes from './routes/csvRoutes.js';
// import ctraderRoutes from './routes/ctrader.js';
import eventRoutes from './routes/events.js';
import linkPlatformsRoutes from './routes/linkPlatforms.js';
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

export function createServer() {
  const app = express();
  const PORT = process.env.PORT || 30;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Swagger API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  // Routes (same as index.js)
  app.use('/api', statusRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', configRoutes);
  app.use('/api', tradingConfigRoutes);

  // Keep these for now for compatibility
  app.use('/api', copierStatusRoutes);
  app.use('/api', csvRoutes);
  app.use('/api', eventRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/slave-config', slaveConfigRoutes);
  app.use('/api/link-platforms', linkPlatformsRoutes);
  // app.use('/api/ctrader', ctraderRoutes);

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  return { app, PORT };
}

export function startServer() {
  const { app, PORT } = createServer();

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`✅ [PRODUCTION] Server started successfully on port ${PORT}`);
      resolve(server);
    });

    server.on('error', (err) => {
      console.error('❌ [PRODUCTION] Server error:', err);
      reject(err);
    });
  });
}
