import { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import CreditCardFee, { CardType, FeeStatus } from '../models/CreditCardFee';
import Client from '../models/Client';
import AccountsReceivable from '../models/AccountsReceivable';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError } from '../core/AppError';

// ✅ FIX: Force load associations to ensure they're available
import '../models/associations';

/**
 * Credit Card Fee Service
 * 
 * Handles all business logic for credit card processing fees.
 * Follows Service Layer Pattern for separation of concerns.
 */

export interface RecordFeeRequest {
  transactionDate: Date;
  transactionNumber: string;
  customerId?: number;
  customerName: string;
  paymentAmount: number;
  feePercentage: number;
  cardType?: CardType;
  cardLastFour?: string;
  arId?: number;
  arRegistrationNumber?: string;
  notes?: string;
  createdBy?: number;
}

export interface FeeStatistics {
  totalFees: number;
  totalTransactions: number;
  averageFeePercentage: number;
  feesByCardType: Record<string, number>;
  feesByMonth: Array<{ month: string; total: number }>;
}

class CreditCardFeeService extends BaseService {
  
  /**
   * Record a new credit card processing fee
   */
  async recordFee(data: RecordFeeRequest, transaction?: Transaction): Promise<CreditCardFee> {
    return this.executeWithTransaction(async (t) => {
      // Validate input
      this.validateFeeData(data);
      
      // Calculate fee amount and net amount
      const feeAmount = this.calculateFeeAmount(data.paymentAmount, data.feePercentage);
      const netAmount = data.paymentAmount - feeAmount;
      
      // Create fee record
      const fee = await CreditCardFee.create({
        transactionDate: new Date(data.transactionDate),
        transactionNumber: data.transactionNumber,
        customerId: data.customerId,
        customerName: data.customerName,
        paymentAmount: data.paymentAmount,
        feePercentage: data.feePercentage,
        feeAmount: feeAmount,
        netAmount: netAmount,
        cardType: data.cardType,
        cardLastFour: data.cardLastFour,
        arId: data.arId,
        arRegistrationNumber: data.arRegistrationNumber,
        status: FeeStatus.RECORDED,
        notes: data.notes,
        createdBy: data.createdBy,
      }, { transaction: t });
      
      return fee;
    }, transaction);
  }
  
  /**
   * Get all fees with optional filters and pagination
   */
  async getAllFees(filters?: {
    startDate?: string;
    endDate?: string;
    customerId?: number;
    cardType?: CardType;
    status?: FeeStatus;
    includeDeleted?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<CreditCardFee[] | any> {
    return this.executeWithRetry(async () => {
      
      // Check if pagination is requested
      if (filters?.page || filters?.limit) {
        console.log('🔍 CreditCardFeeService: Pagination requested');
        
        // Build additional WHERE clause for filters
        const additionalWhere: any = {};
        
        // Exclude soft-deleted records by default
        if (!filters?.includeDeleted) {
          additionalWhere.deletion_status = {
            [Op.or]: [null, { [Op.ne]: 'EXECUTED' }]
          };
        }
        
        // Apply date filter
        if (filters?.startDate && filters?.endDate) {
          additionalWhere.transactionDate = {
            [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
          };
        }
        
        // Apply customer filter
        if (filters?.customerId) {
          additionalWhere.customerId = filters.customerId;
        }
        
        // Apply card type filter
        if (filters?.cardType) {
          additionalWhere.cardType = filters.cardType;
        }
        
        // Apply status filter
        if (filters?.status) {
          additionalWhere.status = filters.status;
        }
        
        // Use generic pagination from BaseService
        const result = await this.getAllWithPagination(
          CreditCardFee,
          {
            page: filters.page,
            limit: filters.limit,
            search: filters.search,
            searchFields: ['transactionNumber', 'customerName', 'arRegistrationNumber'],
            sortBy: filters.sortBy || 'transactionDate',
            sortOrder: filters.sortOrder || 'DESC',
            dateField: 'transactionDate',
            dateFrom: filters.startDate,
            dateTo: filters.endDate
          },
          additionalWhere,
          [
            {
              model: Client,
              as: 'customer',
              attributes: ['id', 'name', 'email', 'rncCedula'],
              required: false,
            },
            {
              model: AccountsReceivable,
              as: 'accountsReceivable',
              attributes: [
                'id', 
                'registrationNumber', 
                'amount', 
                'receivedAmount',
                'clientName',  // ✅ Added
                'clientRnc',   // ✅ Added
                'ncf',         // ✅ Added
                'transferReference' // ✅ Added
              ],
              required: false,
            },
          ]
        );
        
        console.log(`✅ Retrieved ${result.data.length} of ${result.pagination.total} fees (Page ${result.pagination.page}/${result.pagination.totalPages})`);
        return result;
      }
      
      // Backward compatibility - return all records without pagination
      const where: any = {};
      
      // Exclude soft-deleted records by default
      if (!filters?.includeDeleted) {
        where.deletion_status = {
          [Op.or]: [null, { [Op.ne]: 'EXECUTED' }]
        };
      }
      
      // Apply filters
      if (filters?.startDate && filters?.endDate) {
        where.transactionDate = {
          [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
        };
      }
      
      if (filters?.customerId) {
        where.customerId = filters.customerId;
      }
      
      if (filters?.cardType) {
        where.cardType = filters.cardType;
      }
      
      if (filters?.status) {
        where.status = filters.status;
      }
      
      const fees = await CreditCardFee.findAll({
        where,
        include: [
          {
            model: Client,
            as: 'customer',
            attributes: ['id', 'name', 'email'],
            required: false,
          },
          {
            model: AccountsReceivable,
            as: 'accountsReceivable',
            attributes: [
              'id', 
              'registrationNumber', 
              'amount', 
              'receivedAmount',
              'clientName',  // ✅ Added
              'clientRnc',   // ✅ Added
              'ncf',         // ✅ Added
              'transferNumber',  // ✅ Added
              'transferDate',    // ✅ Added
              'paymentReference' // ✅ Added
            ],
            required: false,
          },
        ],
        order: [['transactionDate', 'DESC']],
      });
      
      return fees;
    });
  }
  
  /**
   * Get fee by ID
   */
  async getFeeById(id: number): Promise<CreditCardFee> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Fee ID', { min: 1 });
      
      const fee = await CreditCardFee.findByPk(id, {
        include: [
          {
            model: Client,
            as: 'customer',
            attributes: ['id', 'name', 'email', 'phone'],
          },
          {
            model: AccountsReceivable,
            as: 'accountsReceivable',
            attributes: [
              'id', 
              'registrationNumber', 
              'amount', 
              'receivedAmount', 
              'balanceAmount',
              'clientName',  // ✅ Added
              'clientRnc',   // ✅ Added
              'ncf',         // ✅ Added
              'transferNumber',  // ✅ Added
              'transferDate',    // ✅ Added
              'paymentReference' // ✅ Added
            ],
          },
        ],
      });
      
      if (!fee) {
        throw new NotFoundError(`Credit card fee with ID ${id} not found`);
      }
      
      return fee;
    });
  }
  
  /**
   * Get fee statistics for dashboard
   */
  async getFeeStatistics(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<FeeStatistics> {
    return this.executeWithRetry(async () => {
      const where: any = {
        // Exclude soft-deleted records
        deletion_status: {
          [Op.or]: [null, { [Op.ne]: 'EXECUTED' }]
        }
      };
      
      if (filters?.startDate && filters?.endDate) {
        where.transactionDate = {
          [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
        };
      }
      
      const fees = await CreditCardFee.findAll({ where });
      
      // Calculate statistics
      const totalFees = fees.reduce((sum, fee) => sum + parseFloat(fee.feeAmount.toString()), 0);
      const totalTransactions = fees.length;
      const averageFeePercentage = totalTransactions > 0
        ? fees.reduce((sum, fee) => sum + parseFloat(fee.feePercentage.toString()), 0) / totalTransactions
        : 0;
      
      // Fees by card type
      const feesByCardType: Record<string, number> = {};
      fees.forEach(fee => {
        const cardType = fee.cardType || 'UNKNOWN';
        feesByCardType[cardType] = (feesByCardType[cardType] || 0) + parseFloat(fee.feeAmount.toString());
      });
      
      // Fees by month
      const feesByMonth = this.calculateFeesByMonth(fees);
      
      return {
        totalFees: this.roundCurrency(totalFees),
        totalTransactions,
        averageFeePercentage: this.roundCurrency(averageFeePercentage),
        feesByCardType,
        feesByMonth,
      };
    });
  }
  
  /**
   * Update fee status
   */
  async updateFeeStatus(id: number, status: FeeStatus, notes?: string): Promise<CreditCardFee> {
    return this.executeWithTransaction(async (transaction) => {
      const fee = await this.getFeeById(id);
      
      await fee.update({
        status,
        notes: notes || fee.notes,
      }, { transaction });
      
      return fee;
    });
  }
  
  /**
   * Delete fee record (soft delete)
   */
  async deleteFee(
    id: number, 
    deletedBy?: number, 
    reasonCode?: string, 
    memo?: string
  ): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      const fee = await this.getFeeById(id);
      
      // Business rule: Cannot delete reconciled fees
      if (fee.status === FeeStatus.RECONCILED) {
        throw new ValidationError('Cannot delete reconciled fee. Please dispute it first.');
      }
      
      // Check if already deleted
      if (fee.deletion_status === 'EXECUTED') {
        throw new ValidationError('Fee record is already deleted');
      }
      
      // Soft delete: mark as deleted instead of removing from database
      await fee.update({
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: deletedBy,
        deletion_reason_code: reasonCode,
        deletion_memo: memo,
      }, { transaction });
      
      return { message: 'Credit card fee deleted successfully' };
    });
  }
  
  /**
   * Calculate fee amount
   */
  private calculateFeeAmount(paymentAmount: number, feePercentage: number): number {
    const feeAmount = paymentAmount * (feePercentage / 100);
    return this.roundCurrency(feeAmount);
  }
  
  /**
   * Validate fee data
   */
  private validateFeeData(data: RecordFeeRequest): void {
    if (!data.transactionNumber) {
      throw new ValidationError('Transaction number is required');
    }
    
    if (!data.customerName) {
      throw new ValidationError('Customer name is required');
    }
    
    this.validateNumeric(data.paymentAmount, 'Payment amount', { min: 0.01 });
    this.validateNumeric(data.feePercentage, 'Fee percentage', { min: 0, max: 100 });
    
    if (data.cardLastFour && data.cardLastFour.length !== 4) {
      throw new ValidationError('Card last four must be exactly 4 digits');
    }
  }
  
  /**
   * Calculate fees grouped by month
   */
  private calculateFeesByMonth(fees: CreditCardFee[]): Array<{ month: string; total: number }> {
    const monthlyFees: Record<string, number> = {};
    
    fees.forEach(fee => {
      const month = new Date(fee.transactionDate).toISOString().substring(0, 7); // YYYY-MM
      monthlyFees[month] = (monthlyFees[month] || 0) + parseFloat(fee.feeAmount.toString());
    });
    
    return Object.entries(monthlyFees)
      .map(([month, total]) => ({ month, total: this.roundCurrency(total) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

export default new CreditCardFeeService();
