import express from 'express';
import * as accountBalanceController from '../../controllers/accounting/accountBalanceController';

const router = express.Router();

// Get all account balances (with pagination support)
router.get('/', accountBalanceController.getAllAccountBalances);

// Get current period balances
router.get('/current', accountBalanceController.getCurrentPeriodBalances);

// Get balance summary by account type
router.get('/summary', accountBalanceController.getBalanceSummaryByType);

// Get balances by account type
router.get('/type/:accountType', accountBalanceController.getBalancesByAccountType);

// Get balance by account ID
router.get('/account/:accountId', accountBalanceController.getBalanceByAccountId);

export default router;
