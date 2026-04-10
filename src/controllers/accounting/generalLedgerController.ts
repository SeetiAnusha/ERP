import { Request, Response } from 'express';
import GeneralLedger from '../../models/accounting/GeneralLedger';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import { Op } from 'sequelize';

/**
 * General Ledger Controller
 */

export const getAllGLEntries = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, accountId, sourceModule } = req.query;
    
    const where: any = { isPosted: true };
    
    if (startDate && endDate) {
      where.entryDate = {
        [Op.between]: [new Date(startDate as string), new Date(endDate as string)],
      };
    }
    
    if (accountId) {
      where.accountId = parseInt(accountId as string);
    }
    
    if (sourceModule) {
      where.sourceModule = sourceModule;
    }
    
    const entries = await GeneralLedger.findAll({
      where,
      include: [
        {
          model: ChartOfAccounts,
          as: 'account',
          attributes: ['accountCode', 'accountName', 'accountType'],
        },
      ],
      order: [['entryDate', 'DESC'], ['id', 'DESC']],
    });
    
    res.json(entries);
  } catch (error: any) {
    console.error('Error fetching GL entries:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getGLEntriesByTransaction = async (req: Request, res: Response) => {
  try {
    const { sourceModule, sourceTransactionNumber } = req.params;
    
    const entries = await GeneralLedger.findAll({
      where: {
        sourceModule,
        sourceTransactionNumber,
      },
      include: [
        {
          model: ChartOfAccounts,
          as: 'account',
          attributes: ['accountCode', 'accountName', 'accountType'],
        },
      ],
      order: [['id', 'ASC']],
    });
    
    res.json(entries);
  } catch (error: any) {
    console.error('Error fetching GL entries:', error);
    res.status(500).json({ error: error.message });
  }
};
