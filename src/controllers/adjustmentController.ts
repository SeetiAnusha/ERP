import { Request, Response } from 'express';
import * as adjustmentService from '../services/adjustmentService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const adjustments = await adjustmentService.getAllAdjustments();
    res.json(adjustments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const adjustment = await adjustmentService.getAdjustmentById(parseInt(req.params.id));
    if (!adjustment) return res.status(404).json({ error: 'Adjustment not found' });
    res.json(adjustment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const adjustment = await adjustmentService.createAdjustment(req.body);
    res.status(201).json(adjustment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const adjustment = await adjustmentService.updateAdjustment(parseInt(req.params.id), req.body);
    res.json(adjustment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await adjustmentService.deleteAdjustment(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
