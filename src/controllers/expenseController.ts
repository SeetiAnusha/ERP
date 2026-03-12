import { Request, Response } from 'express';
import Expense from '../models/Expense';
import { Op } from 'sequelize';

export const getAllExpenses = async (req: Request, res: Response) => {
  try {
    const expenses = await Expense.findAll({
      order: [['registrationDate', 'DESC']]
    });
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExpenseById = async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByPk(parseInt(req.params.id));
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProcessingFeeExpenses = async (req: Request, res: Response) => {
  try {
    const processingFeeExpenses = await Expense.findAll({
      where: {
        expenseType: {
          [Op.in]: ['PROCESSING_FEE', 'CREDIT_CARD_FEE', 'TRANSACTION_FEE', 'BANK_CHARGES']
        }
      },
      order: [['registrationDate', 'DESC']]
    });
    res.json(processingFeeExpenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExpensesByDateRange = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const whereClause: any = {};
    if (startDate && endDate) {
      whereClause.registrationDate = {
        [Op.between]: [new Date(startDate as string), new Date(endDate as string)]
      };
    }
    
    const expenses = await Expense.findAll({
      where: whereClause,
      order: [['registrationDate', 'DESC']]
    });
    
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByPk(parseInt(req.params.id));
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    await expense.destroy();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};