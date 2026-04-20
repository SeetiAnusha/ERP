import { Request, Response, NextFunction } from 'express';
import * as clientService from '../services/clientService';

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
      
      const result = await clientService.getAllClientsWithPagination(options);
      return res.json(result);
    }
    
    // Backward compatibility - return all records
    const clients = await clientService.getAllClients();
    res.json(clients);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await clientService.getClientById(parseInt(req.params.id));
    res.json(client);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await clientService.createClient(req.body);
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await clientService.updateClient(parseInt(req.params.id), req.body);
    res.json(client);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await clientService.deleteClient(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};
