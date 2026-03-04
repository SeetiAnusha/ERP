import { Router, Request, Response } from 'express';
import * as cashRegisterMasterService from '../services/cashRegisterMasterService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const registers = await cashRegisterMasterService.getAllCashRegisterMasters();
    res.json(registers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const register = await cashRegisterMasterService.getCashRegisterMasterById(parseInt(req.params.id));
    if (!register) {
      return res.status(404).json({ error: 'Cash Register not found' });
    }
    res.json(register);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const register = await cashRegisterMasterService.createCashRegisterMaster(req.body);
    res.status(201).json(register);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const register = await cashRegisterMasterService.updateCashRegisterMaster(parseInt(req.params.id), req.body);
    res.json(register);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await cashRegisterMasterService.deleteCashRegisterMaster(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
