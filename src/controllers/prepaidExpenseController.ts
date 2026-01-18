import { Request, Response } from 'express';
import * as prepaidExpenseService from '../services/prepaidExpenseService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const expenses = await prepaidExpenseService.getAllPrepaidExpenses();
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const expense = await prepaidExpenseService.getPrepaidExpenseById(parseInt(req.params.id));
    if (!expense) return res.status(404).json({ error: 'Prepaid expense not found' });
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const expense = await prepaidExpenseService.createPrepaidExpense(req.body);
    res.status(201).json(expense);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const expense = await prepaidExpenseService.updatePrepaidExpense(parseInt(req.params.id), req.body);
    res.json(expense);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await prepaidExpenseService.deletePrepaidExpense(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
