import { Request, Response } from 'express';
import * as reportService from '../services/reportService';

export const getPPETrackingReport = async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      category: req.query.category as string,
    };
    const report = await reportService.getPPETrackingReport(filters);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDepreciationSchedule = async (req: Request, res: Response) => {
  try {
    const assetId = parseInt(req.params.id);
    const schedule = await reportService.getDepreciationSchedule(assetId);
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getInvestmentTrackingReport = async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      type: req.query.type as string,
    };
    const report = await reportService.getInvestmentTrackingReport(filters);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPrepaidExpensesReport = async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      type: req.query.type as string,
    };
    const report = await reportService.getPrepaidExpensesReport(filters);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getInventoryMovementReport = async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      productId: req.query.productId ? parseInt(req.query.productId as string) : undefined,
    };
    const report = await reportService.getInventoryMovementReport(filters);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
