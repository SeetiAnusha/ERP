import { Router } from 'express';
import * as accountsPayableController from '../controllers/accountsPayableController';

const router = Router();

router.get('/', accountsPayableController.getAllAccountsPayable);
router.get('/pending', accountsPayableController.getPendingAccountsPayable);
router.get('/:id', accountsPayableController.getAccountsPayableById);
router.post('/', accountsPayableController.createAccountsPayable);
router.post('/:id/record-payment', accountsPayableController.recordPayment);
router.delete('/:id', accountsPayableController.deleteAccountsPayable);

export default router;
