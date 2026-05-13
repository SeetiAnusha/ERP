/**
 * Prepaid Expense Routes
 * 
 * API endpoints for prepaid expense management
 * 
 * @author Senior Developer
 * @version 1.0.0
 */

import express from 'express';
import * as prepaidExpenseController from '../controllers/prepaidExpenseController';

const router = express.Router();

// Summary and special endpoints (must be before :id routes)
router.get('/summary', prepaidExpenseController.getSummary);
router.get('/expiring-soon', prepaidExpenseController.getExpiringSoon);
router.post('/amortize-all', prepaidExpenseController.amortizeAll);

// CRUD operations
router.post('/', prepaidExpenseController.create);
router.get('/', prepaidExpenseController.getAll);
router.get('/:id', prepaidExpenseController.getById);
router.put('/:id', prepaidExpenseController.update);
router.delete('/:id', prepaidExpenseController.remove);

// Amortization
router.post('/:id/amortize', prepaidExpenseController.amortize);

export default router;
