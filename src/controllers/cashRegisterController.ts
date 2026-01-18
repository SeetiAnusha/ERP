import { Request, Response } from 'express';
import * as cashRegisterService from '../services/cashRegisterService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const transactions = await cashRegisterService.getAllCashTransactions();
    res.json(transactions);
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

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await cashRegisterService.deleteCashTransaction(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
