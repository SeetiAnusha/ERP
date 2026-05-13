/**
 * Prepaid Expense Controller
 * 
 * Handles HTTP requests for prepaid expense management
 * 
 * @author Senior Developer
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import * as prepaidExpenseService from '../services/prepaidExpenseService';

/**
 * Create new prepaid expense
 * POST /api/prepaid-expenses
 */
export const create = async (req: Request, res: Response) => {
  try {
    const prepaidExpense = await prepaidExpenseService.createPrepaidExpense(req.body);
    res.status(201).json(prepaidExpense);
  } catch (error: any) {
    console.error('Error creating prepaid expense:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get all prepaid expenses
 * GET /api/prepaid-expenses
 */
export const getAll = async (req: Request, res: Response) => {
  try {
    // ✅ Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : {}
      };
      
      console.log('🔍 Prepaid Expense Controller: Pagination requested with options:', options);
      const result = await prepaidExpenseService.getAllPrepaidExpensesWithPagination(options);
      console.log('✅ Prepaid Expense Controller: Returning paginated result:', { 
        dataCount: result.data?.length, 
        total: result.pagination?.total 
      });
      return res.json(result);
    }
    
    // Backward compatibility - return all records without pagination
    console.log('📋 Prepaid Expense Controller: Fetching all prepaid expenses (no pagination)');
    const { status, type } = req.query;
    const filters = {
      status: status as string,
      type: type as string,
    };
    
    const prepaidExpenses = await prepaidExpenseService.getAllPrepaidExpenses(filters);
    
    // If result has pagination structure, return just the data for backward compatibility
    if (prepaidExpenses.data && prepaidExpenses.pagination) {
      console.log('✅ Prepaid Expense Controller: Returning data array for backward compatibility');
      return res.json(prepaidExpenses.data);
    }
    
    res.json(prepaidExpenses);
  } catch (error: any) {
    console.error('❌ Error fetching prepaid expenses:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

/**
 * Get prepaid expense by ID
 * GET /api/prepaid-expenses/:id
 */
export const getById = async (req: Request, res: Response) => {
  try {
    const prepaidExpense = await prepaidExpenseService.getPrepaidExpenseById(
      parseInt(req.params.id)
    );
    res.json(prepaidExpense);
  } catch (error: any) {
    console.error('Error fetching prepaid expense:', error);
    res.status(404).json({ error: error.message });
  }
};

/**
 * Update prepaid expense
 * PUT /api/prepaid-expenses/:id
 */
export const update = async (req: Request, res: Response) => {
  try {
    const prepaidExpense = await prepaidExpenseService.updatePrepaidExpense(
      parseInt(req.params.id),
      req.body
    );
    res.json(prepaidExpense);
  } catch (error: any) {
    console.error('Error updating prepaid expense:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Delete prepaid expense
 * DELETE /api/prepaid-expenses/:id
 */
export const remove = async (req: Request, res: Response) => {
  try {
    const result = await prepaidExpenseService.deletePrepaidExpense(
      parseInt(req.params.id)
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting prepaid expense:', error);
    res.status(404).json({ error: error.message });
  }
};

/**
 * Process amortization for specific prepaid expense
 * POST /api/prepaid-expenses/:id/amortize
 */
export const amortize = async (req: Request, res: Response) => {
  try {
    const result = await prepaidExpenseService.processAmortization(
      parseInt(req.params.id)
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error processing amortization:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Process amortization for all active prepaid expenses
 * POST /api/prepaid-expenses/amortize-all
 */
export const amortizeAll = async (req: Request, res: Response) => {
  try {
    const result = await prepaidExpenseService.processAllAmortizations();
    res.json(result);
  } catch (error: any) {
    console.error('Error processing all amortizations:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get prepaid expenses expiring soon
 * GET /api/prepaid-expenses/expiring-soon
 */
export const getExpiringSoon = async (req: Request, res: Response) => {
  try {
    const expenses = await prepaidExpenseService.getExpiringSoon();
    res.json(expenses);
  } catch (error: any) {
    console.error('Error fetching expiring prepaid expenses:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get summary statistics
 * GET /api/prepaid-expenses/summary
 */
export const getSummary = async (req: Request, res: Response) => {
  try {
    console.log('📊 Fetching prepaid expense summary...');
    const summary = await prepaidExpenseService.getSummaryStatistics();
    console.log('✅ Summary fetched successfully:', summary);
    res.json(summary);
  } catch (error: any) {
    console.error('❌ Error fetching summary:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};
