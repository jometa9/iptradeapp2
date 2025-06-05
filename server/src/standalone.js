import cors from 'cors';
import express from 'express';

import statusRoutes from './routes/status.js';

export function createServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api', statusRoutes);

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
