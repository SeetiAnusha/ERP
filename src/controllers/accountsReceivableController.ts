import { Request, Response } from 'express';
import * as accountsReceivableService from '../services/accountsReceivableService';
import * as accountsReceivableCollectionService from '../services/accountsReceivableCollectionService';

export const getAllAccountsReceivable = async (req: Request, res: Response) => {
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
      
      // Handle status filter
      if (req.query.status && req.query.status !== 'All') {
        options.status = req.query.status;
      }
      
      // Handle type filter
      if (req.query.type && req.query.type !== 'All') {
        options.type = req.query.type;
      }
      
      const result = await accountsReceivableService.getAllAccountsReceivableWithPagination(options);
      return res.json(result);
    }
    
    // Backward compatibility - return all records
    const accountsReceivable = await accountsReceivableService.getAllAccountsReceivable();
    res.json(accountsReceivable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAccountsReceivableById = async (req: Request, res: Response) => {
  try {
    const accountsReceivable = await accountsReceivableService.getAccountsReceivableById(parseInt(req.params.id));
    if (!accountsReceivable) {
      return res.status(404).json({ error: 'Accounts Receivable not found' });
    }
    res.json(accountsReceivable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingAccountsReceivable = async (req: Request, res: Response) => {
  try {
    const accountsReceivable = await accountsReceivableService.getPendingAccountsReceivable();
    res.json(accountsReceivable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccountsReceivable = async (req: Request, res: Response) => {
  try {
    const accountsReceivable = await accountsReceivableService.createAccountsReceivable(req.body);
    res.status(201).json(accountsReceivable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const recordPayment = async (req: Request, res: Response) => {
  try {
    const result = await accountsReceivableService.recordPayment(
      parseInt(req.params.id),
      req.body
    );
    res.json(result);
  } catch (error: any) {
    //  PHASE 1: Handle overpayment detection errors
    if (error.code === 'OVERPAYMENT_DETECTED') {
      return res.status(400).json({
        error: 'Overpayment detected',
        message: error.message,
        code: 'OVERPAYMENT_DETECTED',
        overpaymentAmount: error.overpaymentAmount,
        outstandingBalance: error.outstandingBalance,
        paymentAmount: error.paymentAmount,
        customerName: error.customerName,
        allowOverpayment: false // Frontend can set this to true and retry
      });
    }
    
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccountsReceivable = async (req: Request, res: Response) => {
  try {
    const result = await accountsReceivableService.deleteAccountsReceivable(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const collectPaymentWithFees = async (req: Request, res: Response) => {
  try {
    const arId = parseInt(req.params.id);
    const collectionData = req.body;
    
    const result = await accountsReceivableCollectionService.collectPaymentWithFees(arId, collectionData);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
