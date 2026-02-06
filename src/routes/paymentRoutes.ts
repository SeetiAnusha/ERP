import { Router } from 'express';
import * as paymentController from '../controllers/paymentController';

const router = Router();

router.get('/', paymentController.getAll);
router.get('/:id', paymentController.getById);
router.post('/', paymentController.create);
router.put('/:id', paymentController.update);
router.delete('/:id', paymentController.remove);
router.get('/outstanding/purchases/:supplierId', paymentController.getOutstandingPurchases);
router.get('/outstanding/sales/:clientId', paymentController.getOutstandingSales);
router.get('/credits/supplier/:supplierId', paymentController.getSupplierCredits);
router.get('/credits/client/:clientId', paymentController.getClientCredits);

export default router;
