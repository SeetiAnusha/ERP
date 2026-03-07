import { Router, Request, Response } from 'express';
import * as investorService from '../services/investorService';

const router = Router();

// Get all investors with their investment details
router.get('/', async (req: Request, res: Response) => {
  try {
    const investors = await investorService.getAllInvestors();
    res.json(investors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific investor details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const investorId = parseInt(req.params.id);
    const details = await investorService.getInvestorById(investorId);
    res.json(details);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Get investor summary statistics
router.get('/summary/statistics', async (req: Request, res: Response) => {
  try {
    const summary = await investorService.getInvestorSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update investment payment status
router.put('/investments/:id/payment', async (req: Request, res: Response) => {
  try {
    const investmentId = parseInt(req.params.id);
    const { paidAmount, status } = req.body;
    
    const updatedInvestment = await investorService.updateInvestmentPaymentStatus(
      investmentId, 
      paidAmount, 
      status
    );
    
    res.json(updatedInvestment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Mark investment as fully paid (manual correction only)
router.put('/investments/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const investmentId = parseInt(req.params.id);
    const updatedInvestment = await investorService.markInvestmentAsPaid(investmentId);
    res.json(updatedInvestment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Fix existing investment status (admin tool)
router.post('/fix-status', async (req: Request, res: Response) => {
  try {
    const result = await investorService.fixExistingInvestmentStatus();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;