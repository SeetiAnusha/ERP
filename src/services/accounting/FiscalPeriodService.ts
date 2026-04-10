import { Op } from 'sequelize';
import sequelize from '../../config/database';
import FiscalPeriod, { PeriodStatus } from '../../models/accounting/FiscalPeriod';
import { BaseService } from '../../core/BaseService';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../core/AppError';

/**
 * Fiscal Period Service
 * 
 * Manages fiscal period operations
 */

interface CreateFiscalPeriodRequest {
  periodName: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  startDate: Date;
  endDate: Date;
  fiscalYear: number;
}

class FiscalPeriodService extends BaseService {
  
  /**
   * Get all fiscal periods with pagination
   */
  async getAllFiscalPeriods(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      if (options.page || options.limit) {
        return await this.getAllWithPagination(
          FiscalPeriod,
          {
            ...options,
            searchFields: ['periodName'],
            dateField: 'startDate'
          }
        );
      }
      
      return await FiscalPeriod.findAll({
        order: [['fiscalYear', 'DESC'], ['startDate', 'DESC']],
      });
    });
  }
  
  /**
   * Get fiscal period by ID
   */
  async getFiscalPeriodById(id: number): Promise<FiscalPeriod> {
    const period = await FiscalPeriod.findByPk(id);
    if (!period) {
      throw new NotFoundError(`Fiscal period not found: ${id}`);
    }
    return period;
  }
  
  /**
   * Get current open period
   */
  async getCurrentPeriod(): Promise<FiscalPeriod | null> {
    return await FiscalPeriod.findOne({
      where: { status: PeriodStatus.OPEN },
      order: [['startDate', 'DESC']],
    });
  }
  
  /**
   * Get periods by fiscal year
   */
  async getPeriodsByYear(fiscalYear: number): Promise<FiscalPeriod[]> {
    return await FiscalPeriod.findAll({
      where: { fiscalYear },
      order: [['startDate', 'ASC']],
    });
  }
  
  /**
   * Create fiscal period
   */
  async createFiscalPeriod(data: CreateFiscalPeriodRequest): Promise<FiscalPeriod> {
    // Validate dates
    if (data.startDate >= data.endDate) {
      throw new ValidationError('Start date must be before end date');
    }
    
    // Check for overlapping periods
    const overlapping = await FiscalPeriod.findOne({
      where: {
        [Op.or]: [
          {
            startDate: { [Op.between]: [data.startDate, data.endDate] },
          },
          {
            endDate: { [Op.between]: [data.startDate, data.endDate] },
          },
          {
            [Op.and]: [
              { startDate: { [Op.lte]: data.startDate } },
              { endDate: { [Op.gte]: data.endDate } },
            ],
          },
        ],
      },
    });
    
    if (overlapping) {
      throw new BusinessLogicError(
        `Period overlaps with existing period: ${overlapping.periodName}`
      );
    }
    
    return await FiscalPeriod.create({
      ...data,
      status: PeriodStatus.OPEN,
    });
  }
  
  /**
   * Close fiscal period
   */
  async closeFiscalPeriod(id: number, userId?: number): Promise<FiscalPeriod> {
    const period = await this.getFiscalPeriodById(id);
    
    if (period.status === PeriodStatus.CLOSED) {
      throw new BusinessLogicError('Period is already closed');
    }
    
    if (period.status === PeriodStatus.LOCKED) {
      throw new BusinessLogicError('Period is locked and cannot be closed');
    }
    
    period.status = PeriodStatus.CLOSED;
    period.closedAt = new Date();
    period.closedBy = userId;
    
    await period.save();
    return period;
  }
  
  /**
   * Reopen fiscal period
   */
  async reopenFiscalPeriod(id: number): Promise<FiscalPeriod> {
    const period = await this.getFiscalPeriodById(id);
    
    if (period.status === PeriodStatus.LOCKED) {
      throw new BusinessLogicError('Period is locked and cannot be reopened');
    }
    
    period.status = PeriodStatus.OPEN;
    period.closedAt = undefined;
    period.closedBy = undefined;
    
    await period.save();
    return period;
  }
  
  /**
   * Lock fiscal period
   */
  async lockFiscalPeriod(id: number): Promise<FiscalPeriod> {
    const period = await this.getFiscalPeriodById(id);
    
    if (period.status !== PeriodStatus.CLOSED) {
      throw new BusinessLogicError('Period must be closed before locking');
    }
    
    period.status = PeriodStatus.LOCKED;
    await period.save();
    return period;
  }
  
  /**
   * Generate monthly periods for a fiscal year
   */
  async generateMonthlyPeriods(fiscalYear: number): Promise<FiscalPeriod[]> {
    const periods: FiscalPeriod[] = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(fiscalYear, month, 1);
      const endDate = new Date(fiscalYear, month + 1, 0);
      
      const period = await this.createFiscalPeriod({
        periodName: `${monthNames[month]} ${fiscalYear}`,
        periodType: 'MONTHLY',
        startDate,
        endDate,
        fiscalYear,
      });
      
      periods.push(period);
    }
    
    return periods;
  }
}

export default new FiscalPeriodService();
