import { Request, Response, NextFunction } from 'express';
import * as supplierService from '../services/supplierService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      
      const result = await supplierService.getAllSuppliersWithPagination(options);
      return res.json(result);
    }
    
    // Backward compatibility - return all records
    const suppliers = await supplierService.getAllSuppliers();
    res.json(suppliers);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await supplierService.getSupplierById(parseInt(req.params.id));
    res.json(supplier);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await supplierService.createSupplier(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await supplierService.updateSupplier(parseInt(req.params.id), req.body);
    res.json(supplier);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await supplierService.deleteSupplier(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};
