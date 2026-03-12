import { Router } from 'express';
import * as expenseController from '../controllers/expenseController';

const router = Router();

router.get('/', expenseController.getAllExpenses);
router.get('/processing-fees', expenseController.getProcessingFeeExpenses);
router.get('/date-range', expenseController.getExpensesByDateRange);
router.get('/:id', expenseController.getExpenseById);
router.post('/', expenseController.createExpense);
router.delete('/:id', expenseController.deleteExpense);

export default router;