import express from 'express';
import * as creditBalanceController from '../controllers/creditBalanceController';

const router = express.Router();

// Get all credit balances (with pagination support)
router.get('/', creditBalanceController.getAllCreditBalances);

// Get all active credit balances
router.get('/active', creditBalanceController.getAllActiveCreditBalances);

// Get credit balance by ID
router.get('/:id', creditBalanceController.getCreditBalanceById);

// Get credit balances for a specific entity (client or supplier)
router.get('/entity/:entityType/:entityId', creditBalanceController.getCreditBalancesByEntity);

// Get available credit balance for a specific entity
router.get('/available/:entityType/:entityId', creditBalanceController.getAvailableCreditBalance);

// Validate payment amount (check for overpayment)
router.post('/validate-payment', creditBalanceController.validatePaymentAmount);

export default router;