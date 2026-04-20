import { Request, Response, NextFunction } from 'express';
import * as prepaidExpenseService from '../services/prepaidExpenseService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expenses = await prepaidExpenseService.getAllPrepaidExpenses();
    res.json(expenses);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prepaidExpenseService.getPrepaidExpenseById(parseInt(req.params.id));
    res.json(expense);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prepaidExpenseService.createPrepaidExpense(req.body);
    res.status(201).json(expense);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prepaidExpenseService.updatePrepaidExpense(parseInt(req.params.id), req.body);
    res.json(expense);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prepaidExpenseService.deletePrepaidExpense(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};
