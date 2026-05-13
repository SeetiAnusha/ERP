import FixedAsset from '../models/FixedAsset';
import BankRegister from '../models/BankRegister';
import AccountsPayable from '../models/AccountsPayable';
import BankAccount from '../models/BankAccount';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators } from '../core/ValidationFramework';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';
import { UniversalPaymentProcessor, PaymentData, TransactionContext } from './shared/UniversalPaymentProcessor';
import {
  calculateDepreciation,
  calculateBookValue,
  calculateNextMaintenanceDate,
  getCategoryDefaults as getAssetCategoryDefaults,
  ASSET_CATEGORIES
} from '../utils/fixedAssetCalculator';

/**
 * Fixed Asset Service - Enhanced with BaseService & ValidationFramework
 * 
 * Manages fixed assets with:
 * - Centralized error handling via BaseService
 * - Input validation via ValidationFramework
 * - Automatic book value calculation
 * - Automatic depreciation calculation
 * - Category defaults
 * - Maintenance tracking
 */

class FixedAssetService extends BaseService {

  /**
   * Get all fixed assets with auto-calculated depreciation and pagination support
   */
  async getAllFixedAssets(options: any = {}) {
    try {
      // Use generic pagination from BaseService
      const result = await this.getAllWithPagination(
        FixedAsset,
        {
          ...options,
          searchFields: ['name', 'registrationNumber', 'code', 'category'],
          dateField: 'createdAt'
        }
      );

      // Enrich data with calculated values
      if (result.data) {
        result.data = result.data.map((asset: any) => this.enrichAssetData(asset));
      }

      return result;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve fixed assets');
    }
  }

  /**
   * Enrich asset with calculated values
   */
  private enrichAssetData(asset: any) {
    const assetData = asset.toJSON ? asset.toJSON() : asset;
    
    // Calculate current depreciation if auto-calculate is enabled
    if (assetData.depreciationMethod !== 'NONE' && assetData.usefulLife > 0) {
      const startDate = assetData.depreciationStartDate || assetData.acquisitionDate;
      const calculatedDepreciation = calculateDepreciation(
        assetData.acquisitionCost,
        assetData.residualValue,
        assetData.usefulLife,
        assetData.depreciationMethod,
        new Date(startDate)
      );
      
      assetData.calculatedDepreciation = Math.round(calculatedDepreciation * 100) / 100;
      assetData.calculatedBookValue = calculateBookValue(assetData.acquisitionCost, calculatedDepreciation);
    }
    
    return assetData;
  }

  /**
   * Get fixed asset by ID with validation and calculated values
   */
  async getFixedAssetById(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Fixed Asset ID', { min: 1, required: true });

    const asset = await FixedAsset.findByPk(id);
    
    if (!asset) {
      throw new NotFoundError(`Fixed asset with ID ${id} not found`);
    }

    return this.enrichAssetData(asset);
  }

  /**
   * Get category defaults for dropdown
   */
  getCategoryDefaults() {
    return ASSET_CATEGORIES;
  }

  /**
   * Create fixed asset with validation, auto book value, category defaults, and payment processing
   */
  async createFixedAsset(data: any) {
    // Validate required fields
    this.validateRequired(data, ['name', 'category', 'acquisitionCost', 'acquisitionDate'], 'fixed asset');

    // ✅ Duplicate prevention — check if code already exists
    if (data.code) {
      const existing = await FixedAsset.findOne({ where: { code: data.code } });
      if (existing) {
        throw new ValidationError(`Fixed asset with code '${data.code}' already exists. Please use a different code.`);
      }
    }

    // Validate payment type if provided
    if (data.paymentType) {
      const validPaymentTypes = ['CREDIT', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'DEBIT_CARD', 'CREDIT_CARD'];
      this.validateEnum(data.paymentType, 'Payment type', validPaymentTypes);
    }

    // Apply category defaults if not provided
    if (data.category) {
      const categoryDefaults = getAssetCategoryDefaults(data.category);
      if (categoryDefaults) {
        data.usefulLife = data.usefulLife || categoryDefaults.defaultUsefulLife;
        data.depreciationMethod = data.depreciationMethod || categoryDefaults.depreciationMethod;
        data.maintenanceSchedule = data.maintenanceSchedule || categoryDefaults.maintenanceSchedule;
        
        // Calculate default residual value if not provided
        if (!data.residualValue && data.acquisitionCost) {
          data.residualValue = (data.acquisitionCost * categoryDefaults.defaultResidualValuePercent) / 100;
        }
      }
    }

    // Set depreciation start date if not provided
    if (!data.depreciationStartDate) {
      data.depreciationStartDate = data.acquisitionDate;
    }

    // Calculate next maintenance date if maintenance schedule is set
    if (data.maintenanceSchedule && data.maintenanceSchedule !== 'NONE') {
      const startDate = data.lastMaintenanceDate || data.acquisitionDate;
      data.nextMaintenanceDate = calculateNextMaintenanceDate(
        new Date(startDate),
        data.maintenanceSchedule
      );
    }

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
          validator: CommonValidators.isNonNegative().validator,
          message: 'Useful life must be zero or positive',
          required: false 
        }
      ]
    });

    return this.executeWithTransaction(async (transaction) => {
      // Calculate book value
      const acquisitionCost = parseFloat(data.acquisitionCost);
      const accumulatedDepreciation = parseFloat(data.accumulatedDepreciation || 0);
      const bookValue = this.roundCurrency(acquisitionCost - accumulatedDepreciation);

      // Validate book value is not negative
      if (bookValue < 0) {
        throw new ValidationError('Accumulated depreciation cannot exceed acquisition cost');
      }

      // Generate registration number
      const registrationNumber = await this.generateRegistrationNumber('FA-', FixedAsset, transaction);

      // Clean up integer fields - convert empty strings to null
      const cleanedData = {
        ...data,
        bankAccountId: data.bankAccountId && data.bankAccountId !== '' ? parseInt(data.bankAccountId) : null,
        cardId: data.cardId && data.cardId !== '' ? parseInt(data.cardId) : null,
        supplierId: data.supplierId && data.supplierId !== '' ? parseInt(data.supplierId) : null,
      };

      // Create fixed asset
      const asset = await FixedAsset.create({ 
        ...cleanedData,
        registrationNumber,
        bookValue,
        status: data.status || 'ACTIVE'
      }, { transaction });

      console.log(`✅ Fixed asset created: ${asset.registrationNumber || asset.code}`);

      // Process payment if payment type is provided (excluding CASH which doesn't need processing yet)
      if (data.paymentType && data.paymentType !== 'CASH') {
        console.log(`💳 Processing payment for fixed asset ${asset.registrationNumber || asset.code} - Payment Type: ${data.paymentType}`);

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
          id: asset.id,
          registrationNumber: asset.registrationNumber || asset.code,
          date: new Date(data.acquisitionDate),
          amount: acquisitionCost,
          type: 'FIXED_ASSET',
          description: `Fixed Asset: ${data.name}`,
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
          console.log(`✅ Payment processed successfully for ${asset.registrationNumber}`);
        } catch (paymentError: any) {
          console.error(`❌ Payment processing failed for ${asset.registrationNumber}:`, paymentError.message);
          throw paymentError; // Re-throw to rollback transaction
        }
      }

      return asset;
    });
  }

  // ==================== PAYMENT PROCESSING HELPER METHODS ====================

  /**
   * Create bank register entry
   */
  private async createBankRegisterEntry(data: any, transaction: any): Promise<void> {
    await BankRegister.create(data, { transaction });
    console.log(`✅ Bank register entry created: ${data.registrationNumber}`);
  }

  /**
   * Create accounts payable entry
   */
  private async createAccountsPayableEntry(data: any, transaction: any): Promise<void> {
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
   * Update fixed asset with validation and recalculate book value
   */
  async updateFixedAsset(id: number, data: any) {
    // Validate ID
    this.validateNumeric(id, 'Fixed Asset ID', { min: 1, required: true });

    const asset = await FixedAsset.findByPk(id);
    if (!asset) {
      throw new NotFoundError(`Fixed asset with ID ${id} not found`);
    }

    // Apply category defaults if category changed
    if (data.category && data.category !== asset.category) {
      const categoryDefaults = getAssetCategoryDefaults(data.category);
      if (categoryDefaults) {
        data.usefulLife = data.usefulLife || categoryDefaults.defaultUsefulLife;
        data.depreciationMethod = data.depreciationMethod || categoryDefaults.depreciationMethod;
        data.maintenanceSchedule = data.maintenanceSchedule || categoryDefaults.maintenanceSchedule;
      }
    }

    // Update next maintenance date if maintenance schedule changed
    if (data.maintenanceSchedule && data.maintenanceSchedule !== 'NONE') {
      const lastMaintenance = data.lastMaintenanceDate || asset.lastMaintenanceDate || asset.acquisitionDate;
      data.nextMaintenanceDate = calculateNextMaintenanceDate(
        new Date(lastMaintenance),
        data.maintenanceSchedule
      );
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
      return this.enrichAssetData(asset);
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

  /**
   * Run depreciation for all active assets
   */
  async runDepreciation() {
    try {
      const activeAssets = await FixedAsset.findAll({
        where: { status: 'ACTIVE' }
      });

      const updates = [];

      for (const asset of activeAssets) {
        if (asset.depreciationMethod === 'NONE' || asset.usefulLife === 0) {
          continue;
        }

        const startDate = asset.depreciationStartDate || asset.acquisitionDate;
        const calculatedDepreciation = calculateDepreciation(
          asset.acquisitionCost,
          asset.residualValue,
          asset.usefulLife,
          asset.depreciationMethod,
          new Date(startDate)
        );

        const newBookValue = calculateBookValue(asset.acquisitionCost, calculatedDepreciation);

        // Update if depreciation changed
        if (Math.abs(calculatedDepreciation - asset.accumulatedDepreciation) > 0.01) {
          await asset.update({
            accumulatedDepreciation: calculatedDepreciation,
            bookValue: newBookValue
          });

          updates.push({
            id: asset.id,
            name: asset.name,
            oldDepreciation: asset.accumulatedDepreciation,
            newDepreciation: calculatedDepreciation,
            bookValue: newBookValue
          });
        }
      }

      return {
        message: `Depreciation calculated for ${updates.length} assets`,
        updates
      };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to run depreciation');
    }
  }
}

// Create singleton instance
const fixedAssetService = new FixedAssetService();

// Export as functions for backward compatibility
export const getAllFixedAssets = (options?: any) => fixedAssetService.getAllFixedAssets(options);
export const getAllFixedAssetsWithPagination = (options?: any) => fixedAssetService.getAllFixedAssets(options);
export const getFixedAssetById = (id: number) => fixedAssetService.getFixedAssetById(id);
export const createFixedAsset = (data: any) => fixedAssetService.createFixedAsset(data);
export const updateFixedAsset = (id: number, data: any) => fixedAssetService.updateFixedAsset(id, data);
export const deleteFixedAsset = (id: number) => fixedAssetService.deleteFixedAsset(id);
export const getCategoryDefaults = () => fixedAssetService.getCategoryDefaults();
export const runDepreciation = () => fixedAssetService.runDepreciation();

export default FixedAssetService;
