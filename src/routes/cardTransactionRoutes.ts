import { Router, Request, Response } from 'express';
import * as cardTransactionService from '../services/cardTransactionService';

const router = Router();

// Process card payment for sale
router.post('/sales/payment', async (req: Request, res: Response) => {
  try {
    const result = await cardTransactionService.processCardSalePayment(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get available cards for sales payments
router.get('/available', async (req: Request, res: Response) => {
  try {
    const cards = await cardTransactionService.getAvailableCardsForSales();
    res.json(cards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get card sales transaction history
router.get('/sales/history', async (req: Request, res: Response) => {
  try {
    const cardId = req.query.cardId ? parseInt(req.query.cardId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    const transactions = await cardTransactionService.getCardSalesTransactions(cardId, limit);
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;