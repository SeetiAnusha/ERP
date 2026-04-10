import { Request, Response } from 'express';
import FiscalPeriodService from '../../services/accounting/FiscalPeriodService';

/**
 * Fiscal Period Controller
 */

export const getAllFiscalPeriods = async (req: Request, res: Response) => {
  try {
    // Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
      };
      
      const result = await FiscalPeriodService.getAllFiscalPeriods(options);
      return res.json(result);
    }
    
    // Return all periods
    const periods = await FiscalPeriodService.getAllFiscalPeriods();
    res.json(periods);
  } catch (error: any) {
    console.error('Error fetching fiscal periods:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getFiscalPeriodById = async (req: Request, res: Response) => {
  try {
    const period = await FiscalPeriodService.getFiscalPeriodById(parseInt(req.params.id));
    res.json(period);
  } catch (error: any) {
    console.error('Error fetching fiscal period:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const getCurrentPeriod = async (req: Request, res: Response) => {
  try {
    const period = await FiscalPeriodService.getCurrentPeriod();
    
    if (!period) {
      return res.status(404).json({ error: 'No open fiscal period found' });
    }
    
    res.json(period);
  } catch (error: any) {
    console.error('Error fetching current period:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPeriodsByYear = async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseInt(req.params.year);
    const periods = await FiscalPeriodService.getPeriodsByYear(fiscalYear);
    res.json(periods);
  } catch (error: any) {
    console.error('Error fetching periods by year:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createFiscalPeriod = async (req: Request, res: Response) => {
  try {
    const period = await FiscalPeriodService.createFiscalPeriod(req.body);
    res.status(201).json(period);
  } catch (error: any) {
    console.error('Error creating fiscal period:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const closeFiscalPeriod = async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId; // From auth middleware
    const period = await FiscalPeriodService.closeFiscalPeriod(parseInt(req.params.id), userId);
    res.json(period);
  } catch (error: any) {
    console.error('Error closing fiscal period:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const reopenFiscalPeriod = async (req: Request, res: Response) => {
  try {
    const period = await FiscalPeriodService.reopenFiscalPeriod(parseInt(req.params.id));
    res.json(period);
  } catch (error: any) {
    console.error('Error reopening fiscal period:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const lockFiscalPeriod = async (req: Request, res: Response) => {
  try {
    const period = await FiscalPeriodService.lockFiscalPeriod(parseInt(req.params.id));
    res.json(period);
  } catch (error: any) {
    console.error('Error locking fiscal period:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const generateMonthlyPeriods = async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseInt(req.params.year);
    const periods = await FiscalPeriodService.generateMonthlyPeriods(fiscalYear);
    res.status(201).json(periods);
  } catch (error: any) {
    console.error('Error generating monthly periods:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};
