import { Router, Request, Response } from 'express';
import * as financerService from '../services/financerService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const financers = await financerService.getAllFinancers();
    res.json(financers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const financer = await financerService.getFinancerById(parseInt(req.params.id));
    if (!financer) {
      return res.status(404).json({ error: 'Financer not found' });
    }
    res.json(financer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const financer = await financerService.createFinancer(req.body);
    res.status(201).json(financer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const financer = await financerService.updateFinancer(parseInt(req.params.id), req.body);
    res.json(financer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await financerService.deleteFinancer(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
