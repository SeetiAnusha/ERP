import { Router, Request, Response } from 'express';
import * as investmentAgreementService from '../services/investmentAgreementService';

const router = Router();

// Get all investment agreements
router.get('/', async (req: Request, res: Response) => {
  try {
    const agreements = await investmentAgreementService.getAllInvestmentAgreements();
    res.json(agreements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get active agreements (for cash register dropdown)
router.get('/active', async (req: Request, res: Response) => {
  try {
    const agreements = await investmentAgreementService.getActiveAgreements();
    res.json(agreements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get agreement summary statistics
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await investmentAgreementService.getAgreementSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific agreement
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const agreementId = parseInt(req.params.id);
    const agreement = await investmentAgreementService.getInvestmentAgreementById(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    res.json(agreement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get agreements by investor
router.get('/investor/:investorId', async (req: Request, res: Response) => {
  try {
    const investorId = parseInt(req.params.investorId);
    const agreements = await investmentAgreementService.getAgreementsByInvestor(investorId);
    res.json(agreements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new investment agreement
router.post('/', async (req: Request, res: Response) => {
  try {
    const agreement = await investmentAgreementService.createInvestmentAgreement(req.body);
    res.status(201).json(agreement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;