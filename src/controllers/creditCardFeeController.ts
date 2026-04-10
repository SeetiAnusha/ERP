import { Request, Response } from 'express';
import CreditCardFeeService from '../services/CreditCardFeeService';

/**
 * Credit Card Fee Controller
 * 
 * Thin controller layer - delegates all business logic to service.
 * Only handles HTTP request/response concerns.
 */

/**
 * Get all credit card fees with optional filters and pagination
 */
export const getAllFees = async (req: Request, res: Response) => {
  try {
    console.log('🔍 Credit Card Fee Controller - Request received:', {
      query: req.query,
      hasPagination: !!(req.query.page || req.query.limit)
    });

    // Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        customerId: req.query.customerId ? parseInt(req.query.customerId as string) : undefined,
        cardType: req.query.cardType as any,
        status: req.query.status as any,
      };
      
      console.log('🔍 CreditCardFee Controller: Pagination requested with options:', options);
      const result = await CreditCardFeeService.getAllFees(options);
      console.log('✅ CreditCardFee Controller: Returning result:', {
        dataCount: result.data?.length || 0,
        total: result.pagination?.total || 0
      });
      res.json(result);
      return;
    }
    
    // No pagination - return all records
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      customerId: req.query.customerId ? parseInt(req.query.customerId as string) : undefined,
      cardType: req.query.cardType as any,
      status: req.query.status as any,
    };
    
    console.log('🔍 CreditCardFee Controller: No pagination, fetching all with filters:', filters);
    const fees = await CreditCardFeeService.getAllFees(filters);
    console.log('✅ CreditCardFee Controller: Returning fees:', Array.isArray(fees) ? fees.length : 'not array');
    res.json(fees);
  } catch (error: any) {
    console.error('❌ Error fetching credit card fees:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get fee by ID
 */
export const getFeeById = async (req: Request, res: Response) => {
  try {
    const fee = await CreditCardFeeService.getFeeById(parseInt(req.params.id));
    res.json(fee);
  } catch (error: any) {
    console.error('Error fetching credit card fee:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
};

/**
 * Record a new credit card fee
 */
export const recordFee = async (req: Request, res: Response) => {
  try {
    const fee = await CreditCardFeeService.recordFee({
      ...req.body,
      createdBy: (req as any).user?.id, // From auth middleware
    });
    res.status(201).json(fee);
  } catch (error: any) {
    console.error('Error recording credit card fee:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
};

/**
 * Get fee statistics for dashboard
 */
export const getFeeStatistics = async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    
    const statistics = await CreditCardFeeService.getFeeStatistics(filters);
    res.json(statistics);
  } catch (error: any) {
    console.error('Error fetching fee statistics:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update fee status
 */
export const updateFeeStatus = async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const fee = await CreditCardFeeService.updateFeeStatus(
      parseInt(req.params.id),
      status,
      notes
    );
    res.json(fee);
  } catch (error: any) {
    console.error('Error updating fee status:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
};

/**
 * Delete fee record
 */
export const deleteFee = async (req: Request, res: Response) => {
  try {
    const result = await CreditCardFeeService.deleteFee(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting credit card fee:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
};
