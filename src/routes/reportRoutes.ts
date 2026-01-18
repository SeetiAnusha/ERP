import express from 'express';
import * as reportController from '../controllers/reportController';

const router = express.Router();

// PPE Reports
router.get('/ppe-tracking', reportController.getPPETrackingReport);
router.get('/depreciation-schedule/:id', reportController.getDepreciationSchedule);

// Investment Reports
router.get('/investment-tracking', reportController.getInvestmentTrackingReport);

// Prepaid Expenses Reports
router.get('/prepaid-expenses', reportController.getPrepaidExpensesReport);

// Inventory Reports
router.get('/inventory-movement', reportController.getInventoryMovementReport);

export default router;
