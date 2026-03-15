// Simple routes for testing
import express from 'express';
import * as customerCreditAwarePaymentControllerSimple from '../controllers/customerCreditAwarePaymentControllerSimple';

const router = express.Router();

// Process customer credit-aware payment (simplified)
router.post('/process-simple', customerCreditAwarePaymentControllerSimple.processCustomerCreditAwarePaymentSimple);

export default router;