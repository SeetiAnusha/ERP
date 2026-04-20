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
    
    console.log('📊 [GL Controller] Fetching GL entries with filters:', {
      startDate,
      endDate,
      accountId,
      sourceModule
    });
    
    const where: any = { isPosted: true };
    
    // ✅ FIX: Only apply date filter if BOTH dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      // Set end date to end of day to include all entries on that date
      end.setHours(23, 59, 59, 999);
      
      where.entryDate = {
        [Op.between]: [start, end],
      };
      
      console.log('   Date filter applied:', {
        start: start.toISOString(),
        end: end.toISOString()
      });
    } else {
      console.log('   No date filter - showing all entries');
    }
    
    if (accountId) {
      where.accountId = parseInt(accountId as string);
    }
    
    if (sourceModule) {
      where.sourceModule = sourceModule;
    }
    
    console.log('   Where clause:', JSON.stringify(where, null, 2));
    
    const entries = await GeneralLedger.findAll({
      where,
      include: [
        {
          model: ChartOfAccounts,
          as: 'account',
          attributes: ['accountCode', 'accountName', 'accountType', 'normalBalance'],
        },
      ],
      order: [['entryDate', 'DESC'], ['id', 'DESC']],
    });
    
    console.log(`✅ Found ${entries.length} GL entries`);
    
    // ✅ Transform data to match frontend expectations
    const transformedEntries = entries.map((entry: any) => ({
      ...entry.toJSON(),
      ChartOfAccount: entry.account, // Add ChartOfAccount alias for frontend compatibility
    }));
    
    res.json(transformedEntries);
  } catch (error: any) {
    console.error('❌ Error fetching GL entries:', error);
    console.error('   Stack:', error.stack);
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
