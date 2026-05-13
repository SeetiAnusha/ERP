import { Router } from 'express';
import * as fixedAssetController from '../controllers/fixedAssetController';

const router = Router();

router.get('/categories', fixedAssetController.getCategoryDefaults);
router.post('/run-depreciation', fixedAssetController.runDepreciation);
router.get('/', fixedAssetController.getAll);
router.get('/:id', fixedAssetController.getById);
router.post('/', fixedAssetController.create);
router.put('/:id', fixedAssetController.update);
router.delete('/:id', fixedAssetController.remove);

export default router;
