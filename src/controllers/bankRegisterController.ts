import { Request, Response, NextFunction } from 'express';
import * as bankRegisterService from '../services/bankRegisterService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : {}
      };
      
      // Handle transactionType filter - ignore "All"
      if (req.query.transactionType && req.query.transactionType !== 'All') {
        options.transactionType = req.query.transactionType;
      }
      
      const result = await bankRegisterService.getAllBankRegistersWithPagination(options);
      return res.json(result);
    }
    
    // Backward compatibility - return all records
    const registers = await bankRegisterService.getAllBankRegisters();
    res.json(registers);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const register = await bankRegisterService.getBankRegisterById(parseInt(req.params.id));
    res.json(register);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  console.log(" BANK REGISTER CONTROLLER - Create request received!");
  console.log(" Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    const register = await bankRegisterService.createBankRegister(req.body);
    console.log("✅ BANK REGISTER CONTROLLER - Transaction created successfully:", register.id);
    res.status(201).json(register);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await bankRegisterService.deleteBankRegister(parseInt(req.params.id));
    res.json({ message: 'Bank register entry deleted successfully' });
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};

// Phase 4: Get pending AP invoices for supplier
export const getPendingInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoices = await bankRegisterService.getPendingAPInvoices(parseInt(req.params.supplierId));
    res.json(invoices);
  } catch (error) {
    next(error); // ✅ Pass to error middleware
  }
};
