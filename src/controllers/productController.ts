import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
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
      
      console.log('🔍 Product Controller: Pagination requested with options:', options);
      const result = await productService.getAllProductsWithPagination(options);
      console.log('✅ Product Controller: Returning paginated result:', { 
        dataCount: result.data?.length, 
        total: result.pagination?.total 
      });
      return res.json(result);
    }
    
    // Backward compatibility - return all records without pagination
    console.log('📋 Product Controller: Fetching all products (no pagination)');
    const products = await productService.getAllProducts({});
    
    // If result has pagination structure, return just the data for backward compatibility
    if (products.data && products.pagination) {
      console.log('✅ Product Controller: Returning data array for backward compatibility');
      return res.json(products.data);
    }
    
    res.json(products);
  } catch (error) {
    console.error('❌ Error in getAll products:', error);
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(parseInt(req.params.id));
    res.json(product);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.updateProduct(parseInt(req.params.id), req.body);
    res.json(product);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productService.deleteProduct(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};
