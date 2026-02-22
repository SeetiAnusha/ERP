import { Router } from 'express';
import * as accountsReceivableController from '../controllers/accountsReceivableController';

const router = Router();

router.get('/', accountsReceivableController.getAllAccountsReceivable);
router.get('/pending', accountsReceivableController.getPendingAccountsReceivable);
router.get('/:id', accountsReceivableController.getAccountsReceivableById);
router.post('/', accountsReceivableController.createAccountsReceivable);
router.post('/:id/record-payment', accountsReceivableController.recordPayment);
router.delete('/:id', accountsReceivableController.deleteAccountsReceivable);

export default router;
