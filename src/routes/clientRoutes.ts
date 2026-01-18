import { Router } from 'express';
import * as clientController from '../controllers/clientController';

const router = Router();

router.get('/', clientController.getAll);
router.get('/:id', clientController.getById);
router.post('/', clientController.create);
router.put('/:id', clientController.update);
router.delete('/:id', clientController.remove);

export default router;
