import { Request, Response, NextFunction } from 'express';
import * as investmentService from '../services/investmentService';

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
      
      console.log('🔍 Investment Controller: Pagination requested with options:', options);
      const result = await investmentService.getAllInvestmentsWithPagination(options);
      console.log('✅ Investment Controller: Returning paginated result:', { 
        dataCount: result.data?.length, 
        total: result.pagination?.total 
      });
      return res.json(result);
    }
    
    // Backward compatibility - return all records without pagination
    console.log('📋 Investment Controller: Fetching all investments (no pagination)');
    const investments = await investmentService.getAllInvestments({});
    
    // If result has pagination structure, return just the data for backward compatibility
    if (investments.data && investments.pagination) {
      console.log('✅ Investment Controller: Returning data array for backward compatibility');
      return res.json(investments.data);
    }
    
    res.json(investments);
  } catch (error) {
    console.error('❌ Error in getAll investments:', error);
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investment = await investmentService.getInvestmentById(parseInt(req.params.id));
    res.json(investment);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investment = await investmentService.createInvestment(req.body);
    res.status(201).json(investment);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investment = await investmentService.updateInvestment(parseInt(req.params.id), req.body);
    res.json(investment);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await investmentService.deleteInvestment(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPortfolioSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await investmentService.getPortfolioSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
};
