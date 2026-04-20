import Investment from '../models/Investment';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators } from '../core/ValidationFramework';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';

/**
 * Investment Service - Enhanced with BaseService & ValidationFramework
 * 
 * Manages investments with:
 * - Centralized error handling via BaseService
 * - Input validation via ValidationFramework
 * - Consistent error responses
 */

class InvestmentService extends BaseService {

  /**
   * Get all investments
   */
  async getAllInvestments() {
    try {
      return await Investment.findAll({ 
        order: [['createdAt', 'DESC']] 
      });
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve investments');
    }
  }

  /**
   * Get investment by ID with validation
   */
  async getInvestmentById(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Investment ID', { min: 1, required: true });

    const investment = await Investment.findByPk(id);
    
    if (!investment) {
      throw new NotFoundError(`Investment with ID ${id} not found`);
    }

    return investment;
  }

  /**
   * Create investment with validation
   */
  async createInvestment(data: any) {
    // Validate required fields
    this.validateRequired(data, ['name', 'amount'], 'investment');

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
          field: 'amount', 
          validator: CommonValidators.isPositive().validator,
          message: 'Investment amount must be greater than 0',
          required: true 
        },
        { 
          field: 'investmentDate', 
          validator: CommonValidators.isDate().validator,
          message: 'Valid investment date is required',
          required: false 
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

    // Validate maturity date is after investment date
    if (data.investmentDate && data.maturityDate) {
      const investmentDate = new Date(data.investmentDate);
      const maturityDate = new Date(data.maturityDate);
      
      if (maturityDate <= investmentDate) {
        throw new ValidationError('Maturity date must be after investment date');
      }
    }

    try {
      return await Investment.create(data);
    } catch (error: any) {
      throw this.handleError(error, 'Failed to create investment');
    }
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

    if (data.amount !== undefined) {
      this.validateNumeric(data.amount, 'Amount', { min: 0.01 });
    }

    if (data.interestRate !== undefined) {
      this.validateNumeric(data.interestRate, 'Interest rate', { min: 0 });
    }

    // Validate date logic if dates are being updated
    if (data.investmentDate || data.maturityDate) {
      const investmentDate = new Date(data.investmentDate || (investment as any).investmentDate);
      const maturityDate = new Date(data.maturityDate || (investment as any).maturityDate);
      
      if (maturityDate <= investmentDate) {
        throw new ValidationError('Maturity date must be after investment date');
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
}

// Create singleton instance
const investmentService = new InvestmentService();

// Export as functions for backward compatibility
export const getAllInvestments = () => investmentService.getAllInvestments();
export const getInvestmentById = (id: number) => investmentService.getInvestmentById(id);
export const createInvestment = (data: any) => investmentService.createInvestment(data);
export const updateInvestment = (id: number, data: any) => investmentService.updateInvestment(id, data);
export const deleteInvestment = (id: number) => investmentService.deleteInvestment(id);

export default InvestmentService;
