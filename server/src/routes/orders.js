import express from 'express';

import { createNewOrder, getOrders } from '../controllers/ordersController.js';

const router = express.Router();

// POST endpoint for creating new orders
router.post('/neworder', createNewOrder);

// GET endpoint for retrieving orders
router.get('/neworder', getOrders);

export default router;
