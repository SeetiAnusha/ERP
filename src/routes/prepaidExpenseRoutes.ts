import { Router } from 'express';
import * as prepaidExpenseController from '../controllers/prepaidExpenseController';

const router = Router();

router.get('/', prepaidExpenseController.getAll);
router.get('/:id', prepaidExpenseController.getById);
router.post('/', prepaidExpenseController.create);
router.put('/:id', prepaidExpenseController.update);
router.delete('/:id', prepaidExpenseController.remove);

export default router;
