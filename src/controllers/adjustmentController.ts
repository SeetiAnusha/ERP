import { Request, Response, NextFunction } from 'express';
import * as adjustmentService from '../services/adjustmentService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adjustments = await adjustmentService.getAllAdjustments();
    res.json(adjustments);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adjustment = await adjustmentService.getAdjustmentById(parseInt(req.params.id));
    res.json(adjustment);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adjustment = await adjustmentService.createAdjustment(req.body);
    res.status(201).json(adjustment);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adjustment = await adjustmentService.updateAdjustment(parseInt(req.params.id), req.body);
    res.json(adjustment);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adjustmentService.deleteAdjustment(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};
