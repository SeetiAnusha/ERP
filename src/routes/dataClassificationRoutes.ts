/**
 * Data Classification API Routes
 * Provides endpoints for data classification management and compliance monitoring
 */

import { Router } from 'express';
import {
  getDashboard,
  getClassifications,
  getExpiringData,
  classifyEntity,
  updateClassification,
  getComplianceReport,
  enableSystem,
  disableSystem,
  getSystemStatus
} from '../controllers/dataClassificationController';

const router = Router();

// Dashboard and overview
router.get('/dashboard', getDashboard);
router.get('/status', getSystemStatus);

// Classification management
router.get('/classifications', getClassifications);
router.post('/classify', classifyEntity);
router.put('/classifications/:id', updateClassification);

// Compliance monitoring
router.get('/expiring', getExpiringData);
router.get('/compliance-report', getComplianceReport);

// System control
router.post('/enable', enableSystem);
router.post('/disable', disableSystem);

export default router;