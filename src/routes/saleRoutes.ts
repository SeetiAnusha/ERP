import { Router } from 'express';
import * as saleController from '../controllers/saleController';

const router = Router();

router.get('/', saleController.getAll);
router.get('/:id', saleController.getById);
router.post('/', saleController.create);
router.put('/:id', saleController.update);
router.post('/:id/collect-payment', saleController.collectPayment);
router.delete('/:id', saleController.remove);

export default router;
