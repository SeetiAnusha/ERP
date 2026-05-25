import { Request, Response, NextFunction } from 'express';
import * as financerService from '../services/financerService';

/**
 * Financer Controller - Handles HTTP requests for financer management
 * Uses errorMiddleware for error handling (no try-catch needed)
 */

/**
 * Get all financers
 * GET /api/financers
 * Query params: financer_type, financial_nature, status, search
 */
export const getAllFinancers = async (req: Request, res: Response, next: NextFunction) => {
  const options = {
    financer_type: req.query.financer_type as string,
    financial_nature: req.query.financial_nature as string,
    status: req.query.status as string,
    search: req.query.search as string,
  };
  
  const financers = await financerService.getAllFinancers(options);
  res.json(financers);
};

/**
 * Get financer by ID
 * GET /api/financers/:id
 */
export const getFinancerById = async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id);
  const financer = await financerService.getFinancerById(id);
  res.json(financer);
};

/**
 * Create new financer
 * POST /api/financers
 */
export const createFinancer = async (req: Request, res: Response, next: NextFunction) => {
  const financer = await financerService.createFinancer(req.body);
  res.status(201).json(financer);
};

/**
 * Update financer
 * PUT /api/financers/:id
 */
export const updateFinancer = async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id);
  const financer = await financerService.updateFinancer(id, req.body);
  res.json(financer);
};

/**
 * Delete financer (soft delete)
 * DELETE /api/financers/:id
 */
export const deleteFinancer = async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id);
  const result = await financerService.deleteFinancer(id);
  res.json(result);
};

/**
 * Record contribution
 * POST /api/financers/:id/contributions
 */
export const recordContribution = async (req: Request, res: Response, next: NextFunction) => {
  const financerId = parseInt(req.params.id);
  const result = await financerService.recordContribution(financerId, req.body);
  res.json(result);
};

/**
 * Get financer summary statistics
 * GET /api/financers/summary
 */
export const getFinancerSummary = async (req: Request, res: Response, next: NextFunction) => {
  const summary = await financerService.getFinancerSummary();
  res.json(summary);
};

/**
 * Get active shareholders for Cash Register dropdown
 * GET /api/financers/shareholders
 */
export const getActiveShareholders = async (req: Request, res: Response, next: NextFunction) => {
  const shareholders = await financerService.getActiveShareholders();
  res.json(shareholders);
};

/**
 * Get active financiers (lenders) for Cash Register dropdown
 * GET /api/financers/financiers
 */
export const getActiveFinanciers = async (req: Request, res: Response, next: NextFunction) => {
  const financiers = await financerService.getActiveFinanciers();
  res.json(financiers);
};

/**
 * Get active shareholder lenders for Cash Register dropdown
 * GET /api/financers/shareholder-lenders
 */
export const getActiveShareholderLenders = async (req: Request, res: Response, next: NextFunction) => {
  const shareholderLenders = await financerService.getActiveShareholderLenders();
  res.json(shareholderLenders);
};

/**
 * Get active related party lenders for Cash Register dropdown
 * GET /api/financers/related-party-lenders
 */
export const getActiveRelatedPartyLenders = async (req: Request, res: Response, next: NextFunction) => {
  const relatedPartyLenders = await financerService.getActiveRelatedPartyLenders();
  res.json(relatedPartyLenders);
};
