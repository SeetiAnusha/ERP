import { Router } from 'express';
import * as customerCreditAwarePaymentController from '../controllers/customerCreditAwarePaymentController';

const router = Router();

// Get customer payment preview (shows credit usage before actual payment)
router.post('/preview', customerCreditAwarePaymentController.getCustomerPaymentPreview);

// Process customer credit-aware payment (full featured)
router.post('/process', customerCreditAwarePaymentController.processCustomerPayment);

// Process simple customer payment (no existing credit usage - for debugging/testing)
router.post('/process-simple', customerCreditAwarePaymentController.processSimpleCustomerPayment);

export default router;