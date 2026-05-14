import Investment from '../models/Investment';
import BankRegister from '../models/BankRegister';
import AccountsPayable from '../models/AccountsPayable';
import BankAccount from '../models/BankAccount';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators } from '../core/ValidationFramework';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';
import { UniversalPaymentProcessor, PaymentData, TransactionContext } from './shared/UniversalPaymentProcessor';
import { 
  investmentCalculator, 
  InterestCalculationMethod,
  InvestmentData,
  CalculatedInvestment 
} from '../utils/investmentCalculator';

/**
 * Investment Service - Enhanced with BaseService & ValidationFramework
 * 
 * Manages investments with:
 * - Centralized error handling via BaseService
 * - Input validation via ValidationFramework
 * - Consistent error responses
 * - Automatic valuation calculation for interest-bearing investments
 * - Real-time gain/loss computation
 * - Auto-status updates (ACTIVE → MATURED)
 * 
 * Performance: O(n) for bulk operations, O(1) per investment calculation
 */

class InvestmentService extends BaseService {

  /**
   * Transform raw investment data to calculated investment
   * Time Complexity: O(1)
   */
  private enrichInvestmentData(investment: any): CalculatedInvestment {
    const investmentData: InvestmentData = {
      type: investment.type,
      acquisitionDate: new Date(investment.acquisitionDate),
      acquisitionCost: parseFloat(investment.acquisitionCost),
      currentValue: parseFloat(investment.currentValue),
      maturityDate: investment.maturityDate ? new Date(investment.maturityDate) : null,
      interestRate: investment.interestRate ? parseFloat(investment.interestRate) : null,
      quantity: parseFloat(investment.quantity),
      status: investment.status
    };

    // Calculate all metrics
    const calculated = investmentCalculator.calculate(
      investmentData,
      InterestCalculationMethod.SIMPLE // Default to simple interest for bonds
    );

    return calculated;
  }

  /**
   * Get all investments with automatic calculations and pagination support
   * Time Complexity: O(n) where n is number of investments
   * Space Complexity: O(n)
   */
  async getAllInvestments(options: any = {}) {
    try {
      // Use generic pagination from BaseService
      const result = await this.getAllWithPagination(
        Investment,
        {
          ...options,
          searchFields: ['name', 'registrationNumber', 'code', 'type'],
          dateField: 'createdAt'
        }
      );

      // Enrich data with calculated values
      if (result.data) {
        result.data = result.data.map((inv: any) => {
          const calculated = this.enrichInvestmentData(inv);
          
          return {
            ...inv,
            calculatedCurrentValue: calculated.calculatedCurrentValue,
            gainLoss: calculated.gainLoss,
            gainLossPercentage: calculated.gainLossPercentage,
            daysHeld: calculated.daysHeld,
            daysToMaturity: calculated.daysToMaturity,
            annualizedReturn: calculated.annualizedReturn,
            shouldAutoCalculate: calculated.shouldAutoCalculate,
            status: calculated.status
          };
        });
      }

      return result;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve investments');
    }
  }

  /**
   * Get investment by ID with validation and calculations
   * Time Complexity: O(1)
   */
  async getInvestmentById(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Investment ID', { min: 1, required: true });

    const investment = await Investment.findByPk(id);
    
    if (!investment) {
      throw new NotFoundError(`Investment with ID ${id} not found`);
    }

    // Enrich with calculated values
    const calculated = this.enrichInvestmentData(investment);
    
    return {
      ...investment.toJSON(),
      calculatedCurrentValue: calculated.calculatedCurrentValue,
      gainLoss: calculated.gainLoss,
      gainLossPercentage: calculated.gainLossPercentage,
      daysHeld: calculated.daysHeld,
      daysToMaturity: calculated.daysToMaturity,
      annualizedReturn: calculated.annualizedReturn,
      shouldAutoCalculate: calculated.shouldAutoCalculate,
      status: calculated.status
    };
  }

  /**
   * Create investment with validation and payment processing
   */
  async createInvestment(data: any) {
    // Validate required fields
    this.validateRequired(data, ['name', 'type', 'description', 'acquisitionDate', 'acquisitionCost', 'currentValue', 'quantity', 'unitCost'], 'investment');

    // ✅ Duplicate prevention — check if code already exists
    if (data.code) {
      const existing = await Investment.findOne({ where: { code: data.code } });
      if (existing) {
        throw new ValidationError(`Investment with code '${data.code}' already exists. Please use a different code.`);
      }
    }

    // Validate payment type if provided
    if (data.paymentType) {
      const validPaymentTypes = ['CREDIT', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'DEBIT_CARD', 'CREDIT_CARD'];
      this.validateEnum(data.paymentType, 'Payment type', validPaymentTypes);
    }

    // Validate fields
    ValidationFramework.validate(data, {
      rules: [
        { 
          field: 'name', 
          validator: CommonValidators.minLength(2).validator,
          message: 'Investment name must be at least 2 characters',
          required: true 
        },
        { 
          field: 'type', 
          validator: CommonValidators.isString().validator,
          message: 'Investment type is required',
          required: true 
        },
        { 
          field: 'acquisitionCost', 
          validator: CommonValidators.isPositive().validator,
          message: 'Acquisition cost must be greater than 0',
          required: true 
        },
        { 
          field: 'currentValue', 
          validator: CommonValidators.isPositive().validator,
          message: 'Current value must be greater than 0',
          required: true 
        },
        { 
          field: 'quantity', 
          validator: CommonValidators.isPositive().validator,
          message: 'Quantity must be greater than 0',
          required: true 
        },
        { 
          field: 'unitCost', 
          validator: CommonValidators.isPositive().validator,
          message: 'Unit cost must be greater than 0',
          required: true 
        },
        { 
          field: 'acquisitionDate', 
          validator: CommonValidators.isDate().validator,
          message: 'Valid acquisition date is required',
          required: true 
        },
        { 
          field: 'maturityDate', 
          validator: CommonValidators.isDate().validator,
          message: 'Valid maturity date is required',
          required: false 
        },
        { 
          field: 'interestRate', 
          validator: CommonValidators.isNonNegative().validator,
          message: 'Interest rate must be zero or positive',
          required: false 
        }
      ]
    });

    // ✅ ROBUST: Validate maturity date is after acquisition date
    // Only validate if maturityDate has a meaningful value (not null, undefined, or empty string)
    if (data.acquisitionDate && data.maturityDate) {
      // Check if maturityDate is a non-empty string
      const maturityDateStr = typeof data.maturityDate === 'string' ? data.maturityDate.trim() : String(data.maturityDate || '').trim();
      
      if (maturityDateStr !== '' && maturityDateStr !== 'null' && maturityDateStr !== 'undefined') {
        const acquisitionDate = new Date(data.acquisitionDate);
        const maturityDate = new Date(maturityDateStr);
        
        // Validate that both dates are valid
        if (isNaN(acquisitionDate.getTime())) {
          throw new ValidationError('Invalid acquisition date format');
        }
        
        if (isNaN(maturityDate.getTime())) {
          throw new ValidationError('Invalid maturity date format');
        }
        
        // Check if maturity date is after acquisition date
        if (maturityDate <= acquisitionDate) {
          throw new ValidationError('Maturity date must be after acquisition date');
        }
      }
    }

    return this.executeWithTransaction(async (transaction) => {
      // Generate registration number
      const registrationNumber = await this.generateRegistrationNumber('INV-', Investment, transaction);

      // Clean up integer fields - convert empty strings to null
      const cleanedData = {
        ...data,
        bankAccountId: data.bankAccountId && data.bankAccountId !== '' ? parseInt(data.bankAccountId) : null,
        cardId: data.cardId && data.cardId !== '' ? parseInt(data.cardId) : null,
        supplierId: data.supplierId && data.supplierId !== '' ? parseInt(data.supplierId) : null,
      };

      // Create investment
      const investment = await Investment.create({ 
        ...cleanedData,
        registrationNumber,
        status: data.status || 'ACTIVE'
      }, { transaction });

      console.log(`✅ Investment created: ${investment.registrationNumber}`);

      // Process payment if payment type is provided (excluding CASH which doesn't need processing yet)
      if (data.paymentType && data.paymentType !== 'CASH') {
        console.log(`💳 Processing payment for investment ${investment.registrationNumber} - Payment Type: ${data.paymentType}`);

        const paymentData: PaymentData = {
          paymentType: data.paymentType,
          bankAccountId: cleanedData.bankAccountId,
          cardId: cleanedData.cardId,
          chequeNumber: data.chequeNumber,
          chequeDate: data.chequeDate,
          transferNumber: data.transferNumber,
          transferDate: data.transferDate,
          paymentReference: data.paymentReference,
          voucherDate: data.voucherDate,
          supplierId: cleanedData.supplierId,
          supplierRnc: data.supplierRnc,
          ncf: data.ncf,
        };

        const context: TransactionContext = {
          id: investment.id,
          registrationNumber: investment.registrationNumber || investment.code,
          date: new Date(data.acquisitionDate),
          amount: parseFloat(data.acquisitionCost),
          type: 'INVESTMENT',
          description: `Investment: ${data.name}`,
        };

        try {
          await UniversalPaymentProcessor.processPayment(
            paymentData,
            context,
            transaction,
            {
              createBankEntry: this.createBankRegisterEntry.bind(this),
              createAPEntry: this.createAccountsPayableEntry.bind(this),
              updateBankBalance: this.updateBankAccountBalance.bind(this),
            }
          );
          console.log(`✅ Payment processed successfully for ${investment.registrationNumber}`);
        } catch (paymentError: any) {
          console.error(`❌ Payment processing failed for ${investment.registrationNumber}:`, paymentError.message);
          throw paymentError; // Re-throw to rollback transaction
        }
      }

      return investment;
    });
  }

  // ==================== PAYMENT PROCESSING HELPER METHODS ====================

  /**
   * Create bank register entry
   */
  private async createBankRegisterEntry(data: any, transaction: any): Promise<void> {
    // BankRegister already imported at top
    await BankRegister.create(data, { transaction });
    console.log(`✅ Bank register entry created: ${data.registrationNumber}`);
  }

  /**
   * Create accounts payable entry
   */
  private async createAccountsPayableEntry(data: any, transaction: any): Promise<void> {
    // AccountsPayable already imported at top
    await AccountsPayable.create(data, { transaction });
    console.log(`✅ Accounts payable entry created: ${data.registrationNumber}`);
  }

  /**
   * Update bank account balance
   */
  private async updateBankAccountBalance(
    bankAccountId: number,
    amount: number,
    isDebit: boolean,
    transaction: any
  ): Promise<void> {
    // BankAccount already imported at top
    const bankAccount = await BankAccount.findByPk(bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError(`Bank account with ID ${bankAccountId} not found`);
    }

    const currentBalance = Number(bankAccount.balance);
    const newBalance = isDebit ? currentBalance - amount : currentBalance + amount;

    await bankAccount.update({ balance: newBalance }, { transaction });
    console.log(`✅ Bank account balance updated: ${currentBalance} → ${newBalance}`);
  }

  /**
   * Update investment with validation
   */
  async updateInvestment(id: number, data: any) {
    // Validate ID
    this.validateNumeric(id, 'Investment ID', { min: 1, required: true });

    const investment = await Investment.findByPk(id);
    if (!investment) {
      throw new NotFoundError(`Investment with ID ${id} not found`);
    }

    // Validate fields if provided
    if (data.name !== undefined) {
      ValidationFramework.validate(data, {
        rules: [
          { 
            field: 'name', 
            validator: CommonValidators.minLength(2).validator,
            message: 'Investment name must be at least 2 characters',
            required: true 
          }
        ]
      });
    }

    if (data.acquisitionCost !== undefined) {
      this.validateNumeric(data.acquisitionCost, 'Acquisition cost', { min: 0.01 });
    }

    if (data.currentValue !== undefined) {
      this.validateNumeric(data.currentValue, 'Current value', { min: 0.01 });
    }

    if (data.quantity !== undefined) {
      this.validateNumeric(data.quantity, 'Quantity', { min: 0.0001 });
    }

    if (data.unitCost !== undefined) {
      this.validateNumeric(data.unitCost, 'Unit cost', { min: 0.01 });
    }

    if (data.interestRate !== undefined) {
      this.validateNumeric(data.interestRate, 'Interest rate', { min: 0 });
    }

    // ✅ ROBUST: Validate date logic if dates are being updated
    // Only validate if maturityDate has a meaningful value
    if (data.acquisitionDate || data.maturityDate) {
      const acquisitionDate = new Date(data.acquisitionDate || (investment as any).acquisitionDate);
      const maturityDateValue = data.maturityDate !== undefined ? data.maturityDate : (investment as any).maturityDate;
      
      // Check if maturityDate is a non-empty, valid value
      if (maturityDateValue !== null && maturityDateValue !== undefined) {
        const maturityDateStr = typeof maturityDateValue === 'string' ? maturityDateValue.trim() : String(maturityDateValue).trim();
        
        if (maturityDateStr !== '' && maturityDateStr !== 'null' && maturityDateStr !== 'undefined') {
          const maturityDate = new Date(maturityDateStr);
          
          // Validate that both dates are valid
          if (isNaN(acquisitionDate.getTime())) {
            throw new ValidationError('Invalid acquisition date format');
          }
          
          if (isNaN(maturityDate.getTime())) {
            throw new ValidationError('Invalid maturity date format');
          }
          
          // Check if maturity date is after acquisition date
          if (maturityDate <= acquisitionDate) {
            throw new ValidationError('Maturity date must be after acquisition date');
          }
        }
      }
    }

    try {
      await investment.update(data);
      return investment;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to update investment');
    }
  }

  /**
   * Delete investment with validation
   */
  async deleteInvestment(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Investment ID', { min: 1, required: true });

    const investment = await Investment.findByPk(id);
    if (!investment) {
      throw new NotFoundError(`Investment with ID ${id} not found`);
    }

    try {
      await investment.destroy();
      return { message: 'Investment deleted successfully' };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete investment');
    }
  }

  /**
   * Get portfolio summary with calculated metrics
   * Time Complexity: O(n)
   * Space Complexity: O(1)
   */
  async getPortfolioSummary() {
    try {
      const investments = await this.getAllInvestments({});
      
      // Handle pagination response structure
      const investmentData = investments.data || investments;
      
      const summary = investmentData.reduce(
        (acc: any, inv: any) => ({
          totalAcquisitionCost: acc.totalAcquisitionCost + parseFloat(inv.acquisitionCost || 0),
          totalCurrentValue: acc.totalCurrentValue + parseFloat(inv.calculatedCurrentValue || inv.currentValue || 0),
          totalGainLoss: acc.totalGainLoss + parseFloat(inv.gainLoss || 0),
          totalInvestments: acc.totalInvestments + 1,
          activeInvestments: acc.activeInvestments + (inv.status === 'ACTIVE' ? 1 : 0),
          maturedInvestments: acc.maturedInvestments + (inv.status === 'MATURED' ? 1 : 0),
          soldInvestments: acc.soldInvestments + (inv.status === 'SOLD' ? 1 : 0)
        }),
        {
          totalAcquisitionCost: 0,
          totalCurrentValue: 0,
          totalGainLoss: 0,
          totalInvestments: 0,
          activeInvestments: 0,
          maturedInvestments: 0,
          soldInvestments: 0
        }
      );

      // Calculate portfolio-level metrics
      const portfolioReturn = summary.totalAcquisitionCost > 0
        ? ((summary.totalCurrentValue - summary.totalAcquisitionCost) / summary.totalAcquisitionCost) * 100
        : 0;

      return {
        ...summary,
        portfolioReturn: Math.round(portfolioReturn * 100) / 100
      };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to calculate portfolio summary');
    }
  }
}

// Create singleton instance
const investmentService = new InvestmentService();

// Export as functions for backward compatibility
export const getAllInvestments = (options?: any) => investmentService.getAllInvestments(options);
export const getAllInvestmentsWithPagination = (options?: any) => investmentService.getAllInvestments(options);
export const getInvestmentById = (id: number) => investmentService.getInvestmentById(id);
export const createInvestment = (data: any) => investmentService.createInvestment(data);
export const updateInvestment = (id: number, data: any) => investmentService.updateInvestment(id, data);
export const deleteInvestment = (id: number) => investmentService.deleteInvestment(id);
export const getPortfolioSummary = () => investmentService.getPortfolioSummary();

export default InvestmentService;
