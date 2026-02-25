import { Router } from 'express';
import * as bankRegisterController from '../controllers/bankRegisterController';

const router = Router();

router.get('/', bankRegisterController.getAll);
router.get('/:id', bankRegisterController.getById);
router.post('/', bankRegisterController.create);
router.delete('/:id', bankRegisterController.remove);

export default router;
