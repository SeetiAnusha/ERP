import express from 'express';
import * as fiscalPeriodController from '../../controllers/accounting/fiscalPeriodController';

const router = express.Router();

// Get all fiscal periods (with pagination support)
router.get('/', fiscalPeriodController.getAllFiscalPeriods);

// Get current open period
router.get('/current', fiscalPeriodController.getCurrentPeriod);

// Get fiscal period by ID
router.get('/:id', fiscalPeriodController.getFiscalPeriodById);

// Get periods by fiscal year
router.get('/year/:year', fiscalPeriodController.getPeriodsByYear);

// Create fiscal period
router.post('/', fiscalPeriodController.createFiscalPeriod);

// Close fiscal period
router.post('/:id/close', fiscalPeriodController.closeFiscalPeriod);

// Reopen fiscal period
router.post('/:id/reopen', fiscalPeriodController.reopenFiscalPeriod);

// Lock fiscal period
router.post('/:id/lock', fiscalPeriodController.lockFiscalPeriod);

// Generate monthly periods for a fiscal year
router.post('/generate/:year', fiscalPeriodController.generateMonthlyPeriods);

export default router;
