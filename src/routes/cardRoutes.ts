import { Router, Request, Response } from 'express';
import * as cardService from '../services/cardService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const cards = await cardService.getAllCards();
    res.json(cards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const card = await cardService.getCardById(parseInt(req.params.id));
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json(card);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const card = await cardService.createCard(req.body);
    res.status(201).json(card);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const card = await cardService.updateCard(parseInt(req.params.id), req.body);
    res.json(card);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await cardService.deleteCard(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
