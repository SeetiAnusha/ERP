import { Request, Response } from 'express';
import * as creditBalanceService from '../services/creditBalanceService';

export const getAllActiveCreditBalances = async (req: Request, res: Response) => {
  try {
    console.log(' Fetching all active credit balances...');
    const creditBalances = await creditBalanceService.getAllActiveCreditBalances();
    console.log(`✅ Found ${creditBalances.length} active credit balances`);
    res.json(creditBalances);
  } catch (error: any) {
    console.error(' Error fetching credit balances:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getCreditBalanceById = async (req: Request, res: Response) => {
  try {
    const creditBalance = await creditBalanceService.getCreditBalanceById(parseInt(req.params.id));
    if (!creditBalance) {
      return res.status(404).json({ error: 'Credit Balance not found' });
    }
    res.json(creditBalance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCreditBalancesByEntity = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!['CLIENT', 'SUPPLIER'].includes(entityType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid entity type. Must be CLIENT or SUPPLIER' });
    }
    
    const creditBalances = await creditBalanceService.getCreditBalancesByEntity(
      entityType.toUpperCase() as 'CLIENT' | 'SUPPLIER',
      parseInt(entityId)
    );
    
    res.json(creditBalances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAvailableCreditBalance = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!['CLIENT', 'SUPPLIER'].includes(entityType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid entity type. Must be CLIENT or SUPPLIER' });
    }
    
    const availableCredit = await creditBalanceService.getAvailableCreditBalance(
      entityType.toUpperCase() as 'CLIENT' | 'SUPPLIER',
      parseInt(entityId)
    );
    
    res.json({ 
      entityType: entityType.toUpperCase(),
      entityId: parseInt(entityId),
      availableCreditBalance: availableCredit 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const validatePaymentAmount = async (req: Request, res: Response) => {
  try {
    const { outstandingBalance, paymentAmount, entityType, entityName } = req.body;
    
    if (!['CLIENT', 'SUPPLIER'].includes(entityType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid entity type. Must be CLIENT or SUPPLIER' });
    }
    
    const validation = await creditBalanceService.validatePaymentAmount(
      outstandingBalance,
      paymentAmount,
      entityType.toUpperCase() as 'CLIENT' | 'SUPPLIER',
      entityName
    );
    
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};