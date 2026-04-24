import Adjustment from '../models/Adjustment';
import AdjustmentItem from '../models/AdjustmentItem';
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
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
 * - Support for multiple line items (products)
 */

class AdjustmentService extends BaseService {
  
  /**
   * Get all adjustments with items
   */
  async getAllAdjustments() {
    try {
      return await Adjustment.findAll({ 
        include: [{
          model: AdjustmentItem,
          as: 'items',
        }],
        order: [['registrationDate', 'DESC']] 
      });
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve adjustments');
    }
  }

  /**
   * Get adjustment by ID with validation and items
   */
  async getAdjustmentById(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Adjustment ID', { min: 1, required: true });

    const adjustment = await Adjustment.findByPk(id, {
      include: [{
        model: AdjustmentItem,
        as: 'items',
      }],
    });
    
    if (!adjustment) {
      throw new NotFoundError(`Adjustment with ID ${id} not found`);
    }

    return adjustment;
  }

  /**
   * Create adjustment with validation, auto-generated registration number, and line items
   */
  async createAdjustment(data: any) {
    return this.executeWithTransaction(async (transaction: Transaction) => {
      // Validate required fields
      this.validateRequired(data, ['type', 'registrationDate', 'reason'], 'adjustment');

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
            field: 'registrationDate', 
            validator: CommonValidators.isDate().validator,
            message: 'Valid registration date is required',
            required: true 
          }
        ]
      });

      // ✅ Calculate total from items if provided
      let adjustmentAmount = 0;
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        adjustmentAmount = data.items.reduce((sum: number, item: any) => sum + parseFloat(item.total || 0), 0);
      } else if (data.adjustmentAmount) {
        adjustmentAmount = parseFloat(data.adjustmentAmount);
      }

      // Validate amount
      if (adjustmentAmount <= 0) {
        throw new ValidationError('Adjustment amount must be greater than 0. Please add items or specify an amount.');
      }

      // Determine prefix based on adjustment type
      let prefix = 'AJ'; // Default to Adjustment
      if (data.type === 'Debit Note') {
        prefix = 'ND';
      } else if (data.type === 'Credit Note') {
        prefix = 'NC';
      }
      
      // Generate registration number using BaseService utility
      const registrationNumber = await this.generateRegistrationNumber(prefix, Adjustment, transaction);
      
      // Create adjustment header
      const adjustment = await Adjustment.create({
        ...data,
        registrationNumber,
        adjustmentAmount,
      }, { transaction });

      // ✅ Create adjustment items if provided
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const itemsToCreate = data.items.map((item: any) => ({
          adjustmentId: adjustment.id,
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
          unitOfMeasurement: item.unitOfMeasurement,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          tax: item.tax || 0,
          total: item.total,
          adjustmentType: data.type === 'Debit Note' ? 'INCREASE' : 'DECREASE',
          reason: item.reason || data.reason,
        }));

        await AdjustmentItem.bulkCreate(itemsToCreate, { transaction });
      }

      // Return adjustment with items
      return await Adjustment.findByPk(adjustment.id, {
        include: [{
          model: AdjustmentItem,
          as: 'items',
        }],
        transaction,
      });
    });
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

    if (data.adjustmentAmount !== undefined) { // ✅ FIX: Changed from 'amount' to 'adjustmentAmount'
      this.validateNumeric(data.adjustmentAmount, 'Amount', { min: 0.01 });
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
