import Adjustment from '../models/Adjustment';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators } from '../core/ValidationFramework';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';

/**
 * Adjustment Service - Enhanced with BaseService & ValidationFramework
 * 
 * Handles adjustments, debit notes, and credit notes with:
 * - Centralized error handling via BaseService
 * - Input validation via ValidationFramework
 * - Automatic registration number generation
 */

class AdjustmentService extends BaseService {
  
  /**
   * Get all adjustments
   */
  async getAllAdjustments() {
    try {
      return await Adjustment.findAll({ 
        order: [['registrationDate', 'DESC']] 
      });
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve adjustments');
    }
  }

  /**
   * Get adjustment by ID with validation
   */
  async getAdjustmentById(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Adjustment ID', { min: 1, required: true });

    const adjustment = await Adjustment.findByPk(id);
    
    if (!adjustment) {
      throw new NotFoundError(`Adjustment with ID ${id} not found`);
    }

    return adjustment;
  }

  /**
   * Create adjustment with validation and auto-generated registration number
   */
  async createAdjustment(data: any) {
    // Validate required fields
    this.validateRequired(data, ['type', 'amount', 'registrationDate'], 'adjustment');

    // Validate fields
    ValidationFramework.validate(data, {
      rules: [
        { 
          field: 'type', 
          validator: CommonValidators.isEnum(['Adjustment', 'Debit Note', 'Credit Note']).validator,
          message: 'Type must be one of: Adjustment, Debit Note, Credit Note',
          required: true 
        },
        { 
          field: 'amount', 
          validator: CommonValidators.isPositive().validator,
          message: 'Amount must be greater than 0',
          required: true 
        },
        { 
          field: 'registrationDate', 
          validator: CommonValidators.isDate().validator,
          message: 'Valid registration date is required',
          required: true 
        }
      ]
    });

    try {
      // Determine prefix based on adjustment type
      let prefix = 'AJ'; // Default to Adjustment
      if (data.type === 'Debit Note') {
        prefix = 'ND';
      } else if (data.type === 'Credit Note') {
        prefix = 'NC';
      }
      
      // Generate registration number using BaseService utility
      const registrationNumber = await this.generateRegistrationNumber(prefix, Adjustment);
      
      return await Adjustment.create({
        ...data,
        registrationNumber,
      });
    } catch (error: any) {
      throw this.handleError(error, 'Failed to create adjustment');
    }
  }

  /**
   * Update adjustment with validation
   */
  async updateAdjustment(id: number, data: any) {
    // Validate ID
    this.validateNumeric(id, 'Adjustment ID', { min: 1, required: true });

    const adjustment = await Adjustment.findByPk(id);
    if (!adjustment) {
      throw new NotFoundError(`Adjustment with ID ${id} not found`);
    }

    // Validate fields if provided
    if (data.type !== undefined) {
      this.validateEnum(data.type, 'Type', ['Adjustment', 'Debit Note', 'Credit Note']);
    }

    if (data.amount !== undefined) {
      this.validateNumeric(data.amount, 'Amount', { min: 0.01 });
    }

    try {
      await adjustment.update(data);
      return adjustment;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to update adjustment');
    }
  }

  /**
   * Delete adjustment with validation
   */
  async deleteAdjustment(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Adjustment ID', { min: 1, required: true });

    const adjustment = await Adjustment.findByPk(id);
    if (!adjustment) {
      throw new NotFoundError(`Adjustment with ID ${id} not found`);
    }

    try {
      await adjustment.destroy();
      return { message: 'Adjustment deleted successfully' };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete adjustment');
    }
  }
}

// Create singleton instance
const adjustmentService = new AdjustmentService();

// Export as functions for backward compatibility
export const getAllAdjustments = () => adjustmentService.getAllAdjustments();
export const getAdjustmentById = (id: number) => adjustmentService.getAdjustmentById(id);
export const createAdjustment = (data: any) => adjustmentService.createAdjustment(data);
export const updateAdjustment = (id: number, data: any) => adjustmentService.updateAdjustment(id, data);
export const deleteAdjustment = (id: number) => adjustmentService.deleteAdjustment(id);

export default AdjustmentService;
