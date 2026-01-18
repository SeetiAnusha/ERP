import { Request, Response } from 'express';
import * as investmentService from '../services/investmentService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const investments = await investmentService.getAllInvestments();
    res.json(investments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const investment = await investmentService.getInvestmentById(parseInt(req.params.id));
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    res.json(investment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const investment = await investmentService.createInvestment(req.body);
    res.status(201).json(investment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const investment = await investmentService.updateInvestment(parseInt(req.params.id), req.body);
    res.json(investment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await investmentService.deleteInvestment(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
