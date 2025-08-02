import express from 'express';

import { getClientEvents, registerClient, unregisterClient } from '../controllers/eventNotifier.js';

const router = express.Router();

/**
 * @swagger
 * /events/register:
 *   post:
 *     summary: Register client for real-time events
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: client_123
 *     responses:
 *       200:
 *         description: Client registered successfully
 */
router.post('/register', (req, res) => {
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  registerClient(clientId);

  res.json({
    message: 'Client registered for events',
    clientId,
    status: 'success',
  });
});

/**
 * @swagger
 * /events/unregister:
 *   post:
 *     summary: Unregister client from real-time events
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: client_123
 *     responses:
 *       200:
 *         description: Client unregistered successfully
 */
router.post('/unregister', (req, res) => {
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  unregisterClient(clientId);

  res.json({
    message: 'Client unregistered from events',
    clientId,
    status: 'success',
  });
});

/**
 * @swagger
 * /events/poll:
 *   get:
 *     summary: Poll for new events (DEPRECATED - Use SSE instead)
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: lastEventId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: timeout
 *         required: false
 *         schema:
 *           type: number
 *           default: 30000
 *     responses:
 *       200:
 *         description: Events retrieved
 */
router.get('/poll', (req, res) => {
  // DEPRECATED: Use SSE endpoint /csv/events instead
  res.status(410).json({
    error: 'This endpoint is deprecated. Use /csv/events for Server-Sent Events instead.',
    message: 'Use SSE endpoint for real-time updates',
  });
});

/**
 * @swagger
 * /events/immediate:
 *   get:
 *     summary: Get immediate events without waiting
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: lastEventId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Events retrieved immediately
 */
router.get('/immediate', (req, res) => {
  const { clientId, lastEventId } = req.query;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  const events = getClientEvents(clientId, lastEventId);

  res.json({
    events,
    hasEvents: events.length > 0,
    clientId,
    status: 'success',
  });
});

export default router;
