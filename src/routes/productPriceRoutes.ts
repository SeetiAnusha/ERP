import { Router } from 'express';
import * as productPriceController from '../controllers/productPriceController';

const router = Router();

router.get('/product/:productId', productPriceController.getPriceHistory);
router.get('/product/:productId/current', productPriceController.getCurrentPrice);
router.post('/', productPriceController.create);
router.put('/:id', productPriceController.update);
router.delete('/:id', productPriceController.remove);
router.post('/update-active-status', productPriceController.updatePriceActiveStatus);

export default router;
