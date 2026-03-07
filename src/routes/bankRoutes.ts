import { Router, Request, Response } from 'express';
import * as bankService from '../services/bankService';

const router = Router();

// Get all banks with their loan details
router.get('/', async (req: Request, res: Response) => {
  try {
    const banks = await bankService.getAllBanks();
    res.json(banks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific bank details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bankId = parseInt(req.params.id);
    const details = await bankService.getBankById(bankId);
    res.json(details);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Get bank summary statistics
router.get('/summary/statistics', async (req: Request, res: Response) => {
  try {
    const summary = await bankService.getBankSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;