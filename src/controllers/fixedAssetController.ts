import { Request, Response, NextFunction } from 'express';
import * as fixedAssetService from '../services/fixedAssetService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assets = await fixedAssetService.getAllFixedAssets();
    res.json(assets);
  } catch (error) {
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
