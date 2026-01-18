import { Request, Response } from 'express';
import * as purchaseService from '../services/purchaseService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const purchases = await purchaseService.getAllPurchases();
    res.json(purchases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.getPurchaseById(parseInt(req.params.id));
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.createPurchase(req.body);
    res.status(201).json(purchase);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.updatePurchase(parseInt(req.params.id), req.body);
    res.json(purchase);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await purchaseService.deletePurchase(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const collectPayment = async (req: Request, res: Response) => {
  try {
    const purchase = await purchaseService.collectPayment(parseInt(req.params.id), req.body);
    res.json(purchase);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
