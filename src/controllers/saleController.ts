import { Request, Response } from 'express';
import * as saleService from '../services/saleService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const sales = await saleService.getAllSales();
    res.json(sales);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.getSaleById(parseInt(req.params.id));
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.createSale(req.body);
    res.status(201).json(sale);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.updateSale(parseInt(req.params.id), req.body);
    res.json(sale);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await saleService.deleteSale(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const collectPayment = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.collectPayment(parseInt(req.params.id), req.body);
    res.json(sale);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
