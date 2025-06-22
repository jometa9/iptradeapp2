import express from 'express';

import { getStatus } from '../controllers/statusController.js';

const router = express.Router();

router.get('/status', getStatus);

// Endpoint para validar suscripción
router.get('/validate-subscription', (req, res) => {
  const { apiKey } = req.query;

  console.log('Validating API Key:', apiKey);

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  // Por ahora, todas las API keys son inválidas para testing
  // En producción, aquí harías la validación real contra tu base de datos
  return res.status(401).json({ error: 'Invalid API Key' });
});

export default router;
