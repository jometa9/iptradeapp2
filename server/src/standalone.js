import cors from 'cors';
import express from 'express';

import accountsRoutes from './routes/accounts.js';
import configRoutes from './routes/config.js';
import copierStatusRoutes from './routes/copierStatus.js';
// import ctraderRoutes from './routes/ctrader.js';
import orderRoutes from './routes/orders.js';
import slaveConfigRoutes from './routes/slaveConfig.js';
import statusRoutes from './routes/status.js';
import tradingConfigRoutes from './routes/tradingConfig.js';

export function createServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes (same as index.js)
  app.use('/api', statusRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', configRoutes);
  app.use('/api', tradingConfigRoutes);
  app.use('/api', copierStatusRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/slave-config', slaveConfigRoutes);
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
    const server = app.listen(PORT, err => {
      if (err) {
        console.error('[SERVER FAILED TO START]', err);
        reject(err);
      } else {
        console.log('=== IPTRADE SERVER STARTED ===');
        console.log(`Server running on port ${PORT}`);
        resolve(server);
      }
    });
  });
}
