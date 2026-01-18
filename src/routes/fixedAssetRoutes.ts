import { Router } from 'express';
import * as fixedAssetController from '../controllers/fixedAssetController';

const router = Router();

router.get('/', fixedAssetController.getAll);
router.get('/:id', fixedAssetController.getById);
router.post('/', fixedAssetController.create);
router.put('/:id', fixedAssetController.update);
router.delete('/:id', fixedAssetController.remove);

export default router;
