import { Request, Response } from 'express';
import TrialBalanceService from '../../services/accounting/TrialBalanceService';

/**
 * Trial Balance Controller
 */

export const getTrialBalance = async (req: Request, res: Response) => {
  try {
    const { asOfDate } = req.query;
    const date = asOfDate ? new Date(asOfDate as string) : undefined;
    
    const trialBalance = await TrialBalanceService.generateTrialBalance(date);
    res.json(trialBalance);
  } catch (error: any) {
    console.error('Error generating trial balance:', error);
    res.status(500).json({ error: error.message });
  }
};
