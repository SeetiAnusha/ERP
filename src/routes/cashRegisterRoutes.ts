import { Router } from 'express';
import * as cashRegisterController from '../controllers/cashRegisterController';

const router = Router();

router.get('/', cashRegisterController.getAll);
router.get('/balance', cashRegisterController.getBalance);
router.get('/balance/:cashRegisterId', cashRegisterController.getCashRegisterBalance);
router.get('/pending-invoices/:customerId', cashRegisterController.getPendingInvoices);
router.get('/:id', cashRegisterController.getById);
router.post('/', cashRegisterController.create);
router.delete('/:id', cashRegisterController.remove);

export default router;
