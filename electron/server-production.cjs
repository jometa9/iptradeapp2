const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 7777;

// Middleware básico
app.use(cors());
app.use(express.json());

// Rutas básicas
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', version: '1.2.3' });
});

// SSE endpoint para eventos del frontend
app.get('/api/csv/events/frontend', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Enviar estado inicial
  res.write(
    `data: ${JSON.stringify({
      type: 'initial_data',
      copierStatus: { globalStatus: false },
    })}\n\n`
  );

  // Mantener la conexión viva
  const interval = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Endpoint para limpiar cache de auto-link
app.post('/api/clear-auto-link-cache', (req, res) => {
  try {
    const cacheFile = path.join(process.cwd(), 'config', 'auto_link_cache.json');
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Endpoint para obtener configuración
app.get('/api/config', (req, res) => {
  try {
    const configPath = path.join(process.cwd(), 'config', 'app_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json(config);
    } else {
      res.json({
        server: {
          port: 30,
          environment: 'production',
        },
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// Endpoint para obtener cuentas CSV
app.get('/api/csv/accounts', (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), 'csv_data');
    if (!fs.existsSync(csvPath)) {
      return res.json([]);
    }

    const files = fs.readdirSync(csvPath).filter(file => file.endsWith('.csv'));
    const accounts = [];

    files.forEach(file => {
      const filePath = path.join(csvPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach(line => {
        if (line.startsWith('[TYPE]')) {
          const parts = line.split(' ').filter(part => part.trim());
          if (parts.length >= 3) {
            accounts.push({
              platform: parts[1],
              accountId: parts[2],
              file: file,
            });
          }
        }
      });
    });

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read CSV files' });
  }
});

// Endpoint para obtener estado del copier
app.get('/api/copier-status', (req, res) => {
  res.json({
    globalStatus: false,
    accounts: [],
  });
});

// Endpoint para obtener órdenes
app.get('/api/orders', (req, res) => {
  res.json([]);
});

// Endpoint para obtener configuraciones de trading
app.get('/api/trading-config', (req, res) => {
  res.json({});
});

// Endpoint para obtener configuraciones de esclavos
app.get('/api/slave-config', (req, res) => {
  res.json([]);
});

// Endpoint para vincular plataformas
app.post('/api/link-platforms', (req, res) => {
  res.json({ message: 'Platform linking not available in production mode' });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`🚀 [PRODUCTION] Server running on port ${port}`);
  console.log(`🌐 Server available at: http://localhost:${port}`);
});
