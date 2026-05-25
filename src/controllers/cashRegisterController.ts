import { Request, Response, NextFunction } from 'express';
import * as cashRegisterService from '../services/cashRegisterService';

export const getEodReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ message: 'Query parameter "date" is required (YYYY-MM-DD)' });
    }
    const data = await cashRegisterService.getEndOfDayReportData(date);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
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
      
      // Handle transactionType filter
      if (req.query.transactionType && req.query.transactionType !== 'All') {
        options.transactionType = req.query.transactionType;
      }
      
      // Handle cashRegisterId filter
      if (req.query.cashRegisterId) {
        options.cashRegisterId = parseInt(req.query.cashRegisterId as string);
      }
      
      const result = await cashRegisterService.getAllCashTransactionsWithPagination(options);
      
      // ✅ Transform to match frontend expected format
      return res.json({
        data: result.transactions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          from: (result.page - 1) * result.limit + 1,
          to: Math.min(result.page * result.limit, result.total),
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1
        }
      });
    }
    
    // Backward compatibility - return all records
    const result = await cashRegisterService.getAllCashTransactions();
    res.json(result.transactions);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await cashRegisterService.getCashTransactionById(parseInt(req.params.id));
    res.json(transaction);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await cashRegisterService.createCashTransaction(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const getBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await cashRegisterService.getCashBalance();
    res.json(balance);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

// Phase 3: Get balance for specific cash register
export const getCashRegisterBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await cashRegisterService.getCashRegisterBalance(parseInt(req.params.cashRegisterId));
    res.json(balance);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

// Get pending Credit Sale and Credit Card Sale invoices for customer
export const getPendingCreditSaleInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoices = await cashRegisterService.getPendingCreditSaleInvoices(parseInt(req.params.customerId));
    res.json(invoices);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cashRegisterService.deleteCashTransaction(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

/**
 * Create shareholder contribution transaction
 * POST /api/cash-register/shareholder-contribution
 */
export const createShareholderContribution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await cashRegisterService.createShareholderContribution(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

/**
 * Create loan receipt transaction from lenders (FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER)
 * POST /api/cash-register/loan-receipt
 */
export const createLoanReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await cashRegisterService.createLoanReceipt(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};
