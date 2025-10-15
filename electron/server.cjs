const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 00;

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
  res.write(`data: ${JSON.stringify({
    type: 'initial_data',
    copierStatus: { globalStatus: false }
  })}\n\n`);

  // Mantener la conexión viva
  const interval = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
