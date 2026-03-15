import { Router } from 'express';
import * as customerCreditAwarePaymentController from '../controllers/customerCreditAwarePaymentController';
import * as customerCreditAwarePaymentControllerSimple from '../controllers/customerCreditAwarePaymentControllerSimple';

const router = Router();

// Get customer payment preview (shows credit usage before actual payment)
router.post('/preview', customerCreditAwarePaymentController.getCustomerPaymentPreview);

// Process customer credit-aware payment
router.post('/process', customerCreditAwarePaymentController.processCustomerPayment);

// Process customer credit-aware payment (simplified version for debugging)
router.post('/process-simple', customerCreditAwarePaymentControllerSimple.processCustomerCreditAwarePaymentSimple);

export default router;