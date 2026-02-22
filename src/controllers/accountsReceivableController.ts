import { Request, Response } from 'express';
import * as accountsReceivableService from '../services/accountsReceivableService';

export const getAllAccountsReceivable = async (req: Request, res: Response) => {
  try {
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
    const accountsReceivable = await accountsReceivableService.recordPayment(
      parseInt(req.params.id),
      req.body
    );
    res.json(accountsReceivable);
  } catch (error: any) {
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
