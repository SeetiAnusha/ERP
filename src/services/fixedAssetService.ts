import FixedAsset from '../models/FixedAsset';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators } from '../core/ValidationFramework';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';

/**
 * Fixed Asset Service - Enhanced with BaseService & ValidationFramework
 * 
 * Manages fixed assets with:
 * - Centralized error handling via BaseService
 * - Input validation via ValidationFramework
 * - Automatic book value calculation
 */

class FixedAssetService extends BaseService {

  /**
   * Get all fixed assets
   */
  async getAllFixedAssets() {
    try {
      return await FixedAsset.findAll({ 
        order: [['createdAt', 'DESC']] 
      });
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve fixed assets');
    }
  }

  /**
   * Get fixed asset by ID with validation
   */
  async getFixedAssetById(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Fixed Asset ID', { min: 1, required: true });

    const asset = await FixedAsset.findByPk(id);
    
    if (!asset) {
      throw new NotFoundError(`Fixed asset with ID ${id} not found`);
    }

    return asset;
  }

  /**
   * Create fixed asset with validation and auto book value calculation
   */
  async createFixedAsset(data: any) {
    // Validate required fields
    this.validateRequired(data, ['name', 'acquisitionCost'], 'fixed asset');

    // Validate fields
    ValidationFramework.validate(data, {
      rules: [
        { 
          field: 'name', 
          validator: CommonValidators.minLength(2).validator,
          message: 'Asset name must be at least 2 characters',
          required: true 
        },
        { 
          field: 'acquisitionCost', 
          validator: CommonValidators.isPositive().validator,
          message: 'Acquisition cost must be greater than 0',
          required: true 
        },
        { 
          field: 'accumulatedDepreciation', 
          validator: CommonValidators.isNonNegative().validator,
          message: 'Accumulated depreciation must be zero or positive',
          required: false 
        },
        { 
          field: 'usefulLife', 
          validator: CommonValidators.isPositive().validator,
          message: 'Useful life must be greater than 0',
          required: false 
        }
      ]
    });

    try {
      // Calculate book value
      const acquisitionCost = parseFloat(data.acquisitionCost);
      const accumulatedDepreciation = parseFloat(data.accumulatedDepreciation || 0);
      const bookValue = this.roundCurrency(acquisitionCost - accumulatedDepreciation);

      // Validate book value is not negative
      if (bookValue < 0) {
        throw new ValidationError('Accumulated depreciation cannot exceed acquisition cost');
      }

      return await FixedAsset.create({ 
        ...data, 
        bookValue 
      });
    } catch (error: any) {
      throw this.handleError(error, 'Failed to create fixed asset');
    }
  }

  /**
   * Update fixed asset with validation and recalculate book value
   */
  async updateFixedAsset(id: number, data: any) {
    // Validate ID
    this.validateNumeric(id, 'Fixed Asset ID', { min: 1, required: true });

    const asset = await FixedAsset.findByPk(id);
    if (!asset) {
      throw new NotFoundError(`Fixed asset with ID ${id} not found`);
    }

    // Validate fields if provided
    if (data.name !== undefined) {
      ValidationFramework.validate(data, {
        rules: [
          { 
            field: 'name', 
            validator: CommonValidators.minLength(2).validator,
            message: 'Asset name must be at least 2 characters',
            required: true 
          }
        ]
      });
    }

    if (data.acquisitionCost !== undefined) {
      this.validateNumeric(data.acquisitionCost, 'Acquisition cost', { min: 0.01 });
    }

    if (data.accumulatedDepreciation !== undefined) {
      this.validateNumeric(data.accumulatedDepreciation, 'Accumulated depreciation', { min: 0 });
    }

    try {
      // Recalculate book value if cost or depreciation changed
      if (data.acquisitionCost !== undefined || data.accumulatedDepreciation !== undefined) {
        const acquisitionCost = parseFloat(data.acquisitionCost || asset.acquisitionCost);
        const accumulatedDepreciation = parseFloat(data.accumulatedDepreciation || asset.accumulatedDepreciation);
        data.bookValue = this.roundCurrency(acquisitionCost - accumulatedDepreciation);

        // Validate book value is not negative
        if (data.bookValue < 0) {
          throw new ValidationError('Accumulated depreciation cannot exceed acquisition cost');
        }
      }
      
      await asset.update(data);
      return asset;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to update fixed asset');
    }
  }

  /**
   * Delete fixed asset with validation
   */
  async deleteFixedAsset(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Fixed Asset ID', { min: 1, required: true });

    const asset = await FixedAsset.findByPk(id);
    if (!asset) {
      throw new NotFoundError(`Fixed asset with ID ${id} not found`);
    }

    try {
      await asset.destroy();
      return { message: 'Fixed asset deleted successfully' };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete fixed asset');
    }
  }
}

// Create singleton instance
const fixedAssetService = new FixedAssetService();

// Export as functions for backward compatibility
export const getAllFixedAssets = () => fixedAssetService.getAllFixedAssets();
export const getFixedAssetById = (id: number) => fixedAssetService.getFixedAssetById(id);
export const createFixedAsset = (data: any) => fixedAssetService.createFixedAsset(data);
export const updateFixedAsset = (id: number, data: any) => fixedAssetService.updateFixedAsset(id, data);
export const deleteFixedAsset = (id: number) => fixedAssetService.deleteFixedAsset(id);

export default FixedAssetService;
