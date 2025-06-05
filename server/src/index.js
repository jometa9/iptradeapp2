import cors from 'cors';
import express from 'express';

import statusRoutes from './routes/status.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', statusRoutes);

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('server.js')) {
  app
    .listen(PORT, () => {
      console.log('=== IPTRADE SERVER STARTED ===');
      console.log(`Server running on port ${PORT}`);
    })
    .on('error', err => {
      console.error('[SERVER FAILED TO START]', err);
      process.exit(1);
    });
}
