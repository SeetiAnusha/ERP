import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/paymentService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await paymentService.getAllPayments();
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.getPaymentById(parseInt(req.params.id));
    res.json(payment);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.updatePayment(parseInt(req.params.id), req.body);
    res.json(payment);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.deletePayment(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOutstandingPurchases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchases = await paymentService.getOutstandingPurchases(parseInt(req.params.supplierId));
    res.json(purchases);
  } catch (error) {
    next(error);
  }
};

export const getOutstandingSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sales = await paymentService.getOutstandingSales(parseInt(req.params.clientId));
    res.json(sales);
  } catch (error) {
    next(error);
  }
};

export const getSupplierCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credits = await paymentService.getSupplierCredits(parseInt(req.params.supplierId));
    res.json(credits);
  } catch (error) {
    next(error);
  }
};

export const getClientCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credits = await paymentService.getClientCredits(parseInt(req.params.clientId));
    res.json(credits);
  } catch (error) {
    next(error);
  }
};
