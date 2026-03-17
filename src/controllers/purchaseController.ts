import { Request, Response } from 'express';
import * as purchaseService from '../services/purchaseService';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from '../core/AppError';

export const getAll = async (req: Request, res: Response) => {
  try {
    console.log('📊 GET /api/purchases - Query params:', req.query);
    
    // Extract and validate query parameters
    const transactionType = req.query.transaction_type as string;
    
    // Get purchases with optional filtering
    const purchases = await purchaseService.getAllPurchases(transactionType);
    
    console.log(`✅ Retrieved ${purchases.length} purchases`);
    res.json(purchases);
  } catch (error: any) {
    console.error('❌ Error in getAll purchases:', error);
    console.error('Stack trace:', error.stack);
    
    // Handle specific AppError types
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: error.message,
        type: 'ValidationError'
      });
    }
    
    if (error instanceof BusinessLogicError) {
      return res.status(500).json({ 
        error: 'Business Logic Error',
        message: error.message,
        type: 'BusinessLogicError'
      });
    }
    
    // Handle database connection errors
    if (error.name === 'SequelizeConnectionError') {
      return res.status(503).json({ 
        error: 'Database connection error',
        message: 'Unable to connect to database. Please try again later.',
        type: 'ConnectionError'
      });
    }
    
    // Handle database query errors
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        error: 'Database query error',
        message: 'There was an issue with the database query.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Database schema issue detected',
        type: 'DatabaseError'
      });
    }
    
    // Generic error fallback
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      type: error.name || 'UnknownError',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.getPurchaseById(parseInt(req.params.id));
    res.json(purchase);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    if (error instanceof BusinessLogicError) {
      return res.status(500).json({ 
        error: 'Business Logic Error',
        message: error.message,
        type: 'BusinessLogicError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      type: error.name || 'UnknownError'
    });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.createPurchase(req.body);
    res.status(201).json(purchase);
  } catch (error: any) {
    console.error('Purchase creation error:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: error.message,
        type: 'ValidationError'
      });
    }
    
    if (error instanceof InsufficientBalanceError) {
      return res.status(400).json({ 
        error: 'Insufficient Balance',
        message: error.message,
        type: 'InsufficientBalanceError'
      });
    }
    
    if (error instanceof BusinessLogicError) {
      return res.status(500).json({ 
        error: 'Business Logic Error',
        message: error.message,
        type: 'BusinessLogicError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Purchase creation failed',
      type: error.name || 'UnknownError',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.updatePurchase(parseInt(req.params.id), req.body);
    res.json(purchase);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: error.message,
        type: 'ValidationError'
      });
    }
    
    if (error instanceof BusinessLogicError) {
      return res.status(500).json({ 
        error: 'Business Logic Error',
        message: error.message,
        type: 'BusinessLogicError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Update failed',
      type: error.name || 'UnknownError'
    });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await purchaseService.deletePurchase(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    if (error instanceof BusinessLogicError) {
      return res.status(400).json({ 
        error: 'Business Logic Error',
        message: error.message,
        type: 'BusinessLogicError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Delete failed',
      type: error.name || 'UnknownError'
    });
  }
};

export const collectPayment = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.collectPayment(parseInt(req.params.id), req.body);
    res.json(purchase);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: error.message,
        type: 'ValidationError'
      });
    }
    
    if (error instanceof BusinessLogicError) {
      return res.status(500).json({ 
        error: 'Business Logic Error',
        message: error.message,
        type: 'BusinessLogicError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Payment collection failed',
      type: error.name || 'UnknownError'
    });
  }
};

export const getPurchaseWithDetails = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.getPurchaseWithDetails(parseInt(req.params.id));
    res.json(purchase);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to get purchase details',
      type: error.name || 'UnknownError'
    });
  }
};

export const getPurchaseItems = async (req: Request, res: Response) => {
  try {
    const items = await purchaseService.getPurchaseItems(parseInt(req.params.id));
    res.json(items);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to get purchase items',
      type: error.name || 'UnknownError'
    });
  }
};

export const getAssociatedInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await purchaseService.getAssociatedInvoices(parseInt(req.params.id));
    res.json(invoices);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        type: 'NotFoundError'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to get associated invoices',
      type: error.name || 'UnknownError'
    });
  }
};
