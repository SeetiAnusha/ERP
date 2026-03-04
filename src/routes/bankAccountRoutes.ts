import { Router, Request, Response } from 'express';
import * as bankAccountService from '../services/bankAccountService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await bankAccountService.getAllBankAccounts();
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const account = await bankAccountService.getBankAccountById(parseInt(req.params.id));
    if (!account) {
      return res.status(404).json({ error: 'Bank Account not found' });
    }
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const account = await bankAccountService.createBankAccount(req.body);
    res.status(201).json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const account = await bankAccountService.updateBankAccount(parseInt(req.params.id), req.body);
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await bankAccountService.deleteBankAccount(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
