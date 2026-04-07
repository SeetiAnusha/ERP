import { Request, Response } from 'express';
import * as saleService from '../services/saleService';

export const getAll = async (req: Request, res: Response) => {
  try {
    // ✅ Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : {}
      };
      
      console.log('🔍 Sale Controller: Pagination requested with options:', options);
      const result = await saleService.getAllSalesWithPagination(options);
      console.log('✅ Sale Controller: Returning paginated result:', { 
        dataCount: result.data?.length, 
        total: result.pagination?.total 
      });
      return res.json(result);
    }
    
    // Backward compatibility - return all records
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
