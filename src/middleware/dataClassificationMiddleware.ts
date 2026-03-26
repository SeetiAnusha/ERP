/**
 * OPTIONAL DATA CLASSIFICATION MIDDLEWARE
 * 
 * COMPLETELY SAFE TO USE:
 * - Only runs AFTER successful operations
 * - Never blocks or interferes with existing functionality
 * - Can be easily disabled or removed
 * - Fails silently to protect existing code
 */

import { Request, Response, NextFunction } from 'express';
import { dataClassificationService } from '../services/SafeDataClassificationService';

/**
 * Optional middleware to automatically classify data after successful operations
 * 
 * HOW TO USE SAFELY:
 * 1. Add this middleware AFTER your existing middleware
 * 2. It only runs after successful responses
 * 3. Can be disabled by setting ENABLE_DATA_CLASSIFICATION=false
 */
export const optionalDataClassificationMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  // Check if classification is enabled via environment variable
  const isEnabled = process.env.ENABLE_DATA_CLASSIFICATION !== 'false';
  
  if (!isEnabled) {
    return next(); // Skip entirely if disabled
  }

  // Store original res.json to intercept successful responses
  const originalJson = res.json;
  
  res.json = function(body: any) {
    // Call original json method first
    const result = originalJson.call(this, body);
    
    // Only classify data after successful responses (200-299 status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Run classification in background - don't wait for it
      setImmediate(() => {
        classifyFromResponse(req, body).catch(error => {
          // Log error but don't affect the response
          console.log('[DataClassification] Background classification error:', error.message);
        });
      });
    }
    
    return result;
  };
  
  next();
};

/**
 * Extract entity information from successful responses and classify
 */
async function classifyFromResponse(req: Request, responseBody: any): Promise<void> {
  try {
    // Only classify if we can identify the entity type and ID
    const entityInfo = extractEntityInfo(req, responseBody);
    
    if (entityInfo) {
      await dataClassificationService.safeClassifyData(
        entityInfo.entityType,
        entityInfo.entityId,
        { 
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent')
        }
      );
    }
  } catch (error) {
    // Fail silently - never affect main application
    console.log('[DataClassification] Classification extraction failed:', (error as Error).message);
  }
}

/**
 * Extract entity type and ID from request/response
 * This is where you can customize based on your API patterns
 */
function extractEntityInfo(req: Request, responseBody: any): { entityType: string; entityId: string } | null {
  try {
    // Method 1: Extract from URL patterns
    const pathParts = req.path.split('/').filter(part => part.length > 0);
    
    // Common REST patterns: /api/users/123, /api/clients/456, etc.
    if (pathParts.length >= 3 && pathParts[0] === 'api') {
      const entityType = pathParts[1]; // 'users', 'clients', etc.
      const entityId = pathParts[2];   // '123', '456', etc.
      
      // Convert plural to singular and capitalize
      const normalizedEntityType = normalizeEntityType(entityType);
      
      if (normalizedEntityType && entityId) {
        return { entityType: normalizedEntityType, entityId };
      }
    }
    
    // Method 2: Extract from response body
    if (responseBody && typeof responseBody === 'object') {
      // Look for common ID patterns in response
      if (responseBody.id) {
        // Try to determine entity type from request path or response structure
        const entityType = guessEntityTypeFromPath(req.path) || guessEntityTypeFromResponse(responseBody);
        if (entityType) {
          return { entityType, entityId: responseBody.id.toString() };
        }
      }
    }
    
    return null;
  } catch (error) {
    return null; // Fail safely
  }
}

/**
 * Normalize entity type names to match your model names
 */
function normalizeEntityType(pathEntityType: string): string | null {
  const mappings: Record<string, string> = {
    'users': 'User',
    'clients': 'Client',
    'accounts-payable': 'AccountsPayable',
    'accounts-receivable': 'AccountsReceivable',
    'bank-accounts': 'BankAccount',
    'bank-register': 'BankRegister',
    'business-expenses': 'BusinessExpense',
    'adjustments': 'Adjustment',
    // Add more mappings as needed
  };
  
  return mappings[pathEntityType.toLowerCase()] || null;
}

/**
 * Guess entity type from request path
 */
function guessEntityTypeFromPath(path: string): string | null {
  const pathParts = path.split('/').filter(part => part.length > 0);
  
  if (pathParts.length >= 2 && pathParts[0] === 'api') {
    return normalizeEntityType(pathParts[1]);
  }
  
  return null;
}

/**
 * Guess entity type from response structure
 */
function guessEntityTypeFromResponse(responseBody: any): string | null {
  // Look for common patterns in response that indicate entity type
  if (responseBody.email || responseBody.username) {
    return 'User';
  }
  
  if (responseBody.companyName || responseBody.clientName) {
    return 'Client';
  }
  
  if (responseBody.amount && responseBody.vendor) {
    return 'AccountsPayable';
  }
  
  if (responseBody.amount && responseBody.customer) {
    return 'AccountsReceivable';
  }
  
  // Add more patterns as needed
  return null;
}

/**
 * Middleware specifically for manual classification triggers
 * Use this when you want to explicitly classify certain operations
 */
export const manualClassificationTrigger = (entityType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store classification info in request for later use
    (req as any).classificationInfo = { entityType };
    next();
  };
};

/**
 * Helper function to manually trigger classification
 * Call this in your existing route handlers when you want explicit classification
 */
export async function triggerClassification(
  entityType: string, 
  entityId: string, 
  context?: any
): Promise<void> {
  try {
    await dataClassificationService.safeClassifyData(entityType, entityId, context);
  } catch (error) {
    // Log but don't throw - protect existing functionality
    console.log(`[DataClassification] Manual classification failed for ${entityType}:${entityId}`, (error as Error).message);
  }
}

export default optionalDataClassificationMiddleware;