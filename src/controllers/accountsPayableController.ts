import { Request, Response } from 'express';
import * as accountsPayableService from '../services/accountsPayableService';

export const getAllAccountsPayable = async (req: Request, res: Response) => {
  try {
    const accountsPayable = await accountsPayableService.getAllAccountsPayable();
    res.json(accountsPayable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAccountsPayableById = async (req: Request, res: Response) => {
  try {
    const accountsPayable = await accountsPayableService.getAccountsPayableById(parseInt(req.params.id));
    if (!accountsPayable) {
      return res.status(404).json({ error: 'Accounts Payable not found' });
    }
    res.json(accountsPayable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingAccountsPayable = async (req: Request, res: Response) => {
  try {
    const accountsPayable = await accountsPayableService.getPendingAccountsPayable();
    res.json(accountsPayable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccountsPayable = async (req: Request, res: Response) => {
  try {
    const accountsPayable = await accountsPayableService.createAccountsPayable(req.body);
    res.status(201).json(accountsPayable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const recordPayment = async (req: Request, res: Response) => {
  try {
    const result = await accountsPayableService.recordPayment(
      parseInt(req.params.id),
      req.body
    );
    res.json(result);
  } catch (error: any) {
    // 🎯 PHASE 1: Handle overpayment detection errors
    if (error.code === 'OVERPAYMENT_DETECTED') {
      return res.status(400).json({
        error: 'Overpayment detected',
        message: error.message,
        code: 'OVERPAYMENT_DETECTED',
        overpaymentAmount: error.overpaymentAmount,
        outstandingBalance: error.outstandingBalance,
        paymentAmount: error.paymentAmount,
        supplierName: error.supplierName,
        allowOverpayment: false // Frontend can set this to true and retry
      });
    }
    
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccountsPayable = async (req: Request, res: Response) => {
  try {
    const result = await accountsPayableService.deleteAccountsPayable(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAccountsPayable = async (req: Request, res: Response) => {
  try {
    const accountsPayable = await accountsPayableService.updateAccountsPayable(
      parseInt(req.params.id),
      req.body
    );
    res.json(accountsPayable);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
