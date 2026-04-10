import express from 'express';
import * as chartOfAccountsController from '../../controllers/accounting/chartOfAccountsController';

const router = express.Router();

router.get('/', chartOfAccountsController.getAllAccounts);
router.get('/:id', chartOfAccountsController.getAccountById);
router.post('/', chartOfAccountsController.createAccount);
router.post('/initialize', chartOfAccountsController.initializeDefaultAccounts);
router.put('/:id', chartOfAccountsController.updateAccount);
router.delete('/:id', chartOfAccountsController.deleteAccount);

export default router;
