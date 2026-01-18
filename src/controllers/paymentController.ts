import { Request, Response } from 'express';
import * as paymentService from '../services/paymentService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const payments = await paymentService.getAllPayments();
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.getPaymentById(parseInt(req.params.id));
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.updatePayment(parseInt(req.params.id), req.body);
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await paymentService.deletePayment(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getOutstandingPurchases = async (req: Request, res: Response) => {
  try {
    const purchases = await paymentService.getOutstandingPurchases(parseInt(req.params.supplierId));
    res.json(purchases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOutstandingSales = async (req: Request, res: Response) => {
  try {
    const sales = await paymentService.getOutstandingSales(parseInt(req.params.clientId));
    res.json(sales);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
