import { Router } from 'express';
import * as cashRegisterController from '../controllers/cashRegisterController';

const router = Router();

/** Must be before /:id so "eod-report" is not parsed as an id */
router.get('/eod-report', cashRegisterController.getEodReport);

router.get('/', cashRegisterController.getAll);
router.get('/balance', cashRegisterController.getBalance);
router.get('/balance/:cashRegisterId', cashRegisterController.getCashRegisterBalance);
router.get('/pending-credit-sales/:customerId', cashRegisterController.getPendingCreditSaleInvoices);
router.get('/:id', cashRegisterController.getById);
router.post('/', cashRegisterController.create);
router.post('/shareholder-contribution', cashRegisterController.createShareholderContribution);
router.post('/loan-receipt', cashRegisterController.createLoanReceipt);
router.delete('/:id', cashRegisterController.remove);

export default router;
