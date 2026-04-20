/**
 * Opening Balance Routes
 */

import express from 'express';
import * as openingBalanceController from '../../controllers/accounting/openingBalanceController';

const router = express.Router();

// Create opening balances
router.post('/', openingBalanceController.createOpeningBalances);

// Get opening balances
router.get('/', openingBalanceController.getOpeningBalances);

// Delete opening balances
router.delete('/:entryNumber', openingBalanceController.deleteOpeningBalances);

export default router;
