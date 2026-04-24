import express from 'express';
import inventoryController from '../controllers/inventoryController';

const router = express.Router();

/**
 * GET /api/inventory/as-of-date
 * Get inventory snapshot as of a specific date
 * Query params: asOfDate, page, limit, search
 */
router.get('/as-of-date', inventoryController.getInventoryAsOfDate);

export default router;
