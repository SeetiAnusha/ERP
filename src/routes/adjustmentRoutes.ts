import { Router } from 'express';
import * as adjustmentController from '../controllers/adjustmentController';

const router = Router();

router.get('/', adjustmentController.getAll);
router.get('/:id', adjustmentController.getById);
router.post('/', adjustmentController.create);
router.put('/:id', adjustmentController.update);
router.delete('/:id', adjustmentController.remove);

export default router;
