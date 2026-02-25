import { Request, Response } from 'express';
import * as bankRegisterService from '../services/bankRegisterService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const registers = await bankRegisterService.getAllBankRegisters();
    res.json(registers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const register = await bankRegisterService.getBankRegisterById(parseInt(req.params.id));
    if (!register) {
      return res.status(404).json({ error: 'Bank register entry not found' });
    }
    res.json(register);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const register = await bankRegisterService.createBankRegister(req.body);
    res.status(201).json(register);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await bankRegisterService.deleteBankRegister(parseInt(req.params.id));
    res.json({ message: 'Bank register entry deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
