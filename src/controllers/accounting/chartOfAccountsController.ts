import { Request, Response } from 'express';
import ChartOfAccountsService from '../../services/accounting/ChartOfAccountsService';

/**
 * Chart of Accounts Controller
 */

export const getAllAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await ChartOfAccountsService.getAllAccounts();
    res.json(accounts);
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const account = await ChartOfAccountsService.getAccountById(parseInt(req.params.id));
    res.json(account);
  } catch (error: any) {
    console.error('Error fetching account:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const account = await ChartOfAccountsService.createAccount(req.body);
    res.status(201).json(account);
  } catch (error: any) {
    console.error('Error creating account:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const initializeDefaultAccounts = async (req: Request, res: Response) => {
  try {
    await ChartOfAccountsService.initializeDefaultAccounts();
    res.json({ message: 'Default accounts initialized successfully' });
  } catch (error: any) {
    console.error('Error initializing accounts:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const account = await ChartOfAccountsService.updateAccount(parseInt(req.params.id), req.body);
    res.json(account);
  } catch (error: any) {
    console.error('Error updating account:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    await ChartOfAccountsService.deleteAccount(parseInt(req.params.id));
    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};
