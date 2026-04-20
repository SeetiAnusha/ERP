/**
 * Opening Balance Controller
 * 
 * RESTful API endpoints for managing opening balances
 */

import { Request, Response } from 'express';
import OpeningBalanceService from '../../services/accounting/OpeningBalanceService';

/**
 * POST /api/accounting/opening-balances
 * Create opening balances
 */
export const createOpeningBalances = async (req: Request, res: Response) => {
  try {
    console.log('📊 [Opening Balance Controller] Create request received');
    console.log('   Request body:', JSON.stringify(req.body, null, 2));
    
    const result = await OpeningBalanceService.createOpeningBalances(req.body);
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('❌ [Opening Balance Controller] Error:', error.message);
    res.status(error.statusCode || 500).json({ 
      error: error.message,
      details: error.details 
    });
  }
};

/**
 * GET /api/accounting/opening-balances
 * Get all opening balances
 */
export const getOpeningBalances = async (req: Request, res: Response) => {
  try {
    const { effectiveDate } = req.query;
    
    const date = effectiveDate ? new Date(effectiveDate as string) : undefined;
    
    const entries = await OpeningBalanceService.getOpeningBalances(date);
    
    res.json(entries);
  } catch (error: any) {
    console.error('❌ [Opening Balance Controller] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/accounting/opening-balances/:entryNumber
 * Delete opening balances by entry number
 */
export const deleteOpeningBalances = async (req: Request, res: Response) => {
  try {
    const { entryNumber } = req.params;
    
    const result = await OpeningBalanceService.deleteOpeningBalances(entryNumber);
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ [Opening Balance Controller] Error:', error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};
