import { Router } from 'express';
import * as investmentController from '../controllers/investmentController';

const router = Router();

router.get('/', investmentController.getAll);
router.get('/:id', investmentController.getById);
router.post('/', investmentController.create);
router.put('/:id', investmentController.update);
router.delete('/:id', investmentController.remove);

export default router;
