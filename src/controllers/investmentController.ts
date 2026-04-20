import { Request, Response, NextFunction } from 'express';
import * as investmentService from '../services/investmentService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investments = await investmentService.getAllInvestments();
    res.json(investments);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investment = await investmentService.getInvestmentById(parseInt(req.params.id));
    res.json(investment);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investment = await investmentService.createInvestment(req.body);
    res.status(201).json(investment);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investment = await investmentService.updateInvestment(parseInt(req.params.id), req.body);
    res.json(investment);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await investmentService.deleteInvestment(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};
