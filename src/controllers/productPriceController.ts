import { Request, Response } from 'express';
import * as productPriceService from '../services/productPriceService';

export const getPriceHistory = async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.productId);
    
    // First, sync the product price with current active price
    await productPriceService.syncProductPrice(productId);
    
    const prices = await productPriceService.getPriceHistory(productId);
    res.json(prices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCurrentPrice = async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.productId);
    const price = await productPriceService.getCurrentPrice(productId);
    res.json(price);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePriceActiveStatus = async (req: Request, res: Response) => {
  try {
    const result = await productPriceService.updatePriceActiveStatus();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const price = await productPriceService.createPrice(req.body);
    res.status(201).json(price);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const price = await productPriceService.updatePrice(parseInt(req.params.id), req.body);
    res.json(price);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await productPriceService.deletePrice(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
