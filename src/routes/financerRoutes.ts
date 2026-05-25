import { Router } from 'express';
import * as financerController from '../controllers/financerController';
import { asyncHandler } from '../middleware/errorMiddleware';

const router = Router();

/**
 * Financer Routes - Enhanced for Shareholder, Financier, and Related Party Management
 * 
 * Routes:
 * - GET    /api/financers                      - Get all financers (with optional filters)
 * - GET    /api/financers/summary              - Get summary statistics
 * - GET    /api/financers/shareholders         - Get active shareholders for dropdown
 * - GET    /api/financers/financiers           - Get active financiers for dropdown
 * - GET    /api/financers/shareholder-lenders  - Get active shareholder lenders for dropdown
 * - GET    /api/financers/related-party-lenders - Get active related party lenders for dropdown
 * - GET    /api/financers/:id                  - Get financer by ID
 * - POST   /api/financers                      - Create new financer
 * - PUT    /api/financers/:id                  - Update financer
 * - DELETE /api/financers/:id                  - Delete financer (soft delete)
 * - POST   /api/financers/:id/contributions    - Record contribution
 */

// Summary and specific type endpoints must come before /:id to avoid route conflict
router.get('/summary', asyncHandler(financerController.getFinancerSummary));
router.get('/shareholders', asyncHandler(financerController.getActiveShareholders));
router.get('/financiers', asyncHandler(financerController.getActiveFinanciers));
router.get('/shareholder-lenders', asyncHandler(financerController.getActiveShareholderLenders));
router.get('/related-party-lenders', asyncHandler(financerController.getActiveRelatedPartyLenders));

// CRUD operations
router.get('/', asyncHandler(financerController.getAllFinancers));
router.get('/:id', asyncHandler(financerController.getFinancerById));
router.post('/', asyncHandler(financerController.createFinancer));
router.put('/:id', asyncHandler(financerController.updateFinancer));
router.delete('/:id', asyncHandler(financerController.deleteFinancer));

// Contribution tracking
router.post('/:id/contributions', asyncHandler(financerController.recordContribution));

export default router;
