import express from 'express';
import * as generalLedgerController from '../../controllers/accounting/generalLedgerController';

const router = express.Router();

router.get('/', generalLedgerController.getAllGLEntries);
router.get('/:sourceModule/:sourceTransactionNumber', generalLedgerController.getGLEntriesByTransaction);

export default router;
