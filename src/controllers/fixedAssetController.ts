import { Request, Response, NextFunction } from 'express';
import * as fixedAssetService from '../services/fixedAssetService';

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
      
      console.log('🔍 Fixed Asset Controller: Pagination requested with options:', options);
      const result = await fixedAssetService.getAllFixedAssetsWithPagination(options);
      console.log('✅ Fixed Asset Controller: Returning paginated result:', { 
        dataCount: result.data?.length, 
        total: result.pagination?.total 
      });
      return res.json(result);
    }
    
    // Backward compatibility - return all records without pagination
    console.log('📋 Fixed Asset Controller: Fetching all fixed assets (no pagination)');
    const assets = await fixedAssetService.getAllFixedAssets({});
    
    // If result has pagination structure, return just the data for backward compatibility
    if (assets.data && assets.pagination) {
      console.log('✅ Fixed Asset Controller: Returning data array for backward compatibility');
      return res.json(assets.data);
    }
    
    res.json(assets);
  } catch (error) {
    console.error('❌ Error in getAll fixed assets:', error);
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await fixedAssetService.getFixedAssetById(parseInt(req.params.id));
    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await fixedAssetService.createFixedAsset(req.body);
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await fixedAssetService.updateFixedAsset(parseInt(req.params.id), req.body);
    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fixedAssetService.deleteFixedAsset(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getCategoryDefaults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await fixedAssetService.getCategoryDefaults();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const runDepreciation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fixedAssetService.runDepreciation();
    res.json(result);
  } catch (error) {
    next(error);
  }
};
