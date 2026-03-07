import { Router, Request, Response } from 'express';
import * as investmentSummaryService from '../services/investmentSummaryService';

const router = Router();

// Get comprehensive investment and loan summary
router.get('/', async (req: Request, res: Response) => {
  try {
    const summary = await investmentSummaryService.getInvestmentSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get investment details by financer (investor or bank)
router.get('/financer/:id', async (req: Request, res: Response) => {
  try {
    const financerId = parseInt(req.params.id);
    const details = await investmentSummaryService.getInvestmentByFinancer(financerId);
    res.json(details);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Get investment details by store (cash register)
router.get('/store/:id', async (req: Request, res: Response) => {
  try {
    const storeId = parseInt(req.params.id);
    const details = await investmentSummaryService.getInvestmentByStore(storeId);
    res.json(details);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Get recent investment and loan activity
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get recent transactions
    const summary = await investmentSummaryService.getInvestmentSummary();
    const recentActivity = summary.recentActivity.slice(0, limit);
    
    res.json(recentActivity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get investor summary only
router.get('/investors', async (req: Request, res: Response) => {
  try {
    const summary = await investmentSummaryService.getInvestmentSummary();
    res.json(summary.investors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get bank summary only
router.get('/banks', async (req: Request, res: Response) => {
  try {
    const summary = await investmentSummaryService.getInvestmentSummary();
    res.json(summary.banks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get store summary only
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const summary = await investmentSummaryService.getInvestmentSummary();
    res.json(summary.stores);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;