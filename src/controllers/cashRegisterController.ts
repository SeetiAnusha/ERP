import { Request, Response } from 'express';
import * as cashRegisterService from '../services/cashRegisterService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await cashRegisterService.getAllCashTransactions();
    // Return just the transactions array for frontend compatibility
    res.json(result.transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const transaction = await cashRegisterService.getCashTransactionById(parseInt(req.params.id));
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const transaction = await cashRegisterService.createCashTransaction(req.body);
    res.status(201).json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getBalance = async (req: Request, res: Response) => {
  try {
    const balance = await cashRegisterService.getCashBalance();
    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Phase 3: Get balance for specific cash register
export const getCashRegisterBalance = async (req: Request, res: Response) => {
  try {
    const balance = await cashRegisterService.getCashRegisterBalance(parseInt(req.params.cashRegisterId));
    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending Credit Sale and Credit Card Sale invoices for customer
export const getPendingCreditSaleInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await cashRegisterService.getPendingCreditSaleInvoices(parseInt(req.params.customerId));
    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await cashRegisterService.deleteCashTransaction(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
