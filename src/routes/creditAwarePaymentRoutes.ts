import { Router } from 'express';
import * as creditAwarePaymentController from '../controllers/creditAwarePaymentController';

const router = Router();

// Get payment preview (shows credit usage before actual payment)
router.post('/preview', creditAwarePaymentController.getPaymentPreview);

// Process credit-aware payment
router.post('/process', creditAwarePaymentController.processPayment);

export default router;