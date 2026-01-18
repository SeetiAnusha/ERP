import { Router } from 'express';
import * as purchaseController from '../controllers/purchaseController';

const router = Router();

router.get('/', purchaseController.getAll);
router.get('/:id', purchaseController.getById);
router.post('/', purchaseController.create);
router.put('/:id', purchaseController.update);
router.post('/:id/collect-payment', purchaseController.collectPayment);
router.delete('/:id', purchaseController.remove);

export default router;
