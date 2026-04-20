import { Request, Response, NextFunction } from 'express';
import * as purchaseService from '../services/purchaseService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('📊 GET /api/purchases - Query params:', req.query);
    
    // ✅ Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : {}
      };
      
      const result = await purchaseService.getAllPurchasesWithPagination(options);
      console.log(`✅ Retrieved paginated purchases: page ${options.page}, total ${result.pagination.total}`);
      return res.json(result);
    }
    
    // Backward compatibility - return all records with optional filtering
    const transactionType = req.query.transaction_type as string;
    const purchases = await purchaseService.getAllPurchases(transactionType);
    
    console.log(`✅ Retrieved ${purchases.length} purchases`);
    res.json(purchases);
  } catch (error) {
    console.error('❌ Error in getAll purchases:', error);
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchase = await purchaseService.getPurchaseById(parseInt(req.params.id));
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchase = await purchaseService.createPurchase(req.body);
    console.log("purchase:", purchase);
    res.status(201).json(purchase);
  } catch (error) {
    console.error('Purchase creation error:', error);
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchase = await purchaseService.updatePurchase(parseInt(req.params.id), req.body);
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await purchaseService.deletePurchase(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const collectPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchase = await purchaseService.collectPayment(parseInt(req.params.id), req.body);
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseWithDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchase = await purchaseService.getPurchaseWithDetails(parseInt(req.params.id));
    res.json(purchase);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await purchaseService.getPurchaseItems(parseInt(req.params.id));
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const getAssociatedInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoices = await purchaseService.getAssociatedInvoices(parseInt(req.params.id));
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};
