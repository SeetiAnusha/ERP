import { Request, Response } from 'express';
import AccountBalanceService from '../../services/accounting/AccountBalanceService';

/**
 * Account Balance Controller
 */

export const getAllAccountBalances = async (req: Request, res: Response) => {
  try {
    // Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
      };
      
      const result = await AccountBalanceService.getAllAccountBalances(options);
      return res.json(result);
    }
    
    // Return all balances
    const balances = await AccountBalanceService.getAllAccountBalances();
    res.json(balances);
  } catch (error: any) {
    console.error('Error fetching account balances:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getBalanceByAccountId = async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const fiscalPeriodId = req.query.fiscalPeriodId 
      ? parseInt(req.query.fiscalPeriodId as string) 
      : undefined;
    
    const balance = await AccountBalanceService.getBalanceByAccountId(accountId, fiscalPeriodId);
    
    if (!balance) {
      return res.status(404).json({ error: 'Account balance not found' });
    }
    
    res.json(balance);
  } catch (error: any) {
    console.error('Error fetching account balance:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getBalancesByAccountType = async (req: Request, res: Response) => {
  try {
    const accountType = req.params.accountType.toUpperCase();
    
    if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(accountType)) {
      return res.status(400).json({ 
        error: 'Invalid account type. Must be ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE' 
      });
    }
    
    const balances = await AccountBalanceService.getBalancesByAccountType(accountType);
    res.json(balances);
  } catch (error: any) {
    console.error('Error fetching balances by type:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getCurrentPeriodBalances = async (req: Request, res: Response) => {
  try {
    const balances = await AccountBalanceService.getCurrentPeriodBalances();
    res.json(balances);
  } catch (error: any) {
    console.error('Error fetching current period balances:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getBalanceSummaryByType = async (req: Request, res: Response) => {
  try {
    const summary = await AccountBalanceService.getBalanceSummaryByType();
    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching balance summary:', error);
    res.status(500).json({ error: error.message });
  }
};
