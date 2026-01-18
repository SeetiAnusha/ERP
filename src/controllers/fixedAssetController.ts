import { Request, Response } from 'express';
import * as fixedAssetService from '../services/fixedAssetService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const assets = await fixedAssetService.getAllFixedAssets();
    res.json(assets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const asset = await fixedAssetService.getFixedAssetById(parseInt(req.params.id));
    if (!asset) return res.status(404).json({ error: 'Fixed asset not found' });
    res.json(asset);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const asset = await fixedAssetService.createFixedAsset(req.body);
    res.status(201).json(asset);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const asset = await fixedAssetService.updateFixedAsset(parseInt(req.params.id), req.body);
    res.json(asset);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await fixedAssetService.deleteFixedAsset(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
