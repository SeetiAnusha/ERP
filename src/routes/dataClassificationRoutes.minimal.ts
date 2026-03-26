/**
 * Production-Safe Data Classification Routes
 * Conditionally loads full features based on environment
 */

import { Router } from 'express';

const router = Router();

// Check if we're in production environment
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Production: Minimal endpoints only
  router.get('/status', (req, res) => {
    res.json({
      success: true,
      data: {
        enabled: false,
        message: 'Data classification system is disabled in production'
      }
    });
  });

  router.get('/dashboard', (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Data classification dashboard is not available in production'
      }
    });
  });
} else {
  // Development: Try to load full features
  try {
    const fullRoutes = require('./dataClassificationRoutes').default;
    // Copy all routes from full implementation
    router.use('/', fullRoutes);
  } catch (error) {
    console.warn('⚠️ Full data classification routes not available, using minimal version');
    
    // Fallback to minimal endpoints
    router.get('/status', (req, res) => {
      res.json({
        success: true,
        data: {
          enabled: false,
          message: 'Data classification system is not available'
        }
      });
    });
  }
}

export default router;