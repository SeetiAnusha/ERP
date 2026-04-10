import express from 'express';
import * as creditCardFeeController from '../controllers/creditCardFeeController';

const router = express.Router();

// Get all fees with filters
router.get('/', creditCardFeeController.getAllFees);

// Get fee statistics for dashboard
router.get('/statistics', creditCardFeeController.getFeeStatistics);

// Get fee by ID
router.get('/:id', creditCardFeeController.getFeeById);

// Record new fee
router.post('/', creditCardFeeController.recordFee);

// Update fee status
router.patch('/:id/status', creditCardFeeController.updateFeeStatus);

// Delete fee
router.delete('/:id', creditCardFeeController.deleteFee);

export default router;
