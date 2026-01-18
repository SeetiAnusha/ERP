import { Router } from 'express';
import * as supplierController from '../controllers/supplierController';

const router = Router();

router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getById);
router.post('/', supplierController.create);
router.put('/:id', supplierController.update);
router.delete('/:id', supplierController.remove);

export default router;
