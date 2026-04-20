/**
 * Opening Balance Service
 * 
 * Professional-grade service for managing opening balances in the accounting system.
 * Implements DSA principles with O(n) complexity for batch operations.
 * 
 * Features:
 * - Batch opening balance creation with transaction management
 * - Automatic Owner's Capital calculation (balancing entry)
 * - Validation of accounting equation (Assets = Liabilities + Equity)
 * - Rollback protection for failed operations
 * - Comprehensive error handling
 * 
 * @author Professional Development Team
 * @version 1.0.0
 */

import { Transaction } from 'sequelize';
import sequelize from '../../config/database';
import GeneralLedger, { EntryType, SourceModule } from '../../models/accounting/GeneralLedger';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import { ValidationError, BusinessLogicError } from '../../core/AppError';
import { BaseService } from '../../core/BaseService';

/**
 * Interface for opening balance entry
 */
export interface OpeningBalanceEntry {
  accountCode: string;
  accountName?: string;
  amount: number;
  entryType: 'DEBIT' | 'CREDIT';
}

/**
 * Interface for opening balance request
 */
export interface CreateOpeningBalanceRequest {
  effectiveDate: Date;
  entries: OpeningBalanceEntry[];
  description?: string;
  autoBalanceWithEquity?: boolean; // If true, automatically creates Owner's Capital entry
  equityAccountCode?: string; // Default: '3000' (Owner's Capital)
}

/**
 * Interface for opening balance validation result
 */
interface ValidationResult {
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  errors: string[];
}

/**
 * Opening Balance Service Class
 * 
 * Time Complexity: O(n) where n = number of opening balance entries
 * Space Complexity: O(n) for storing entries
 */
class OpeningBalanceService extends BaseService {
  
  /**
   * Create opening balances for multiple accounts
   * 
   * Algorithm:
   * 1. Validate all entries (O(n))
   * 2. Check if balanced or auto-balance enabled
   * 3. Create GL entries in batch (O(n))
   * 4. Verify accounting equation
   * 
   * Time Complexity: O(n)
   * Space Complexity: O(n)
   */
  async createOpeningBalances(request: CreateOpeningBalanceRequest): Promise<{
    success: boolean;
    entryNumber: string;
    entriesCreated: number;
    message: string;
  }> {
    return this.executeWithTransaction(async (transaction) => {
      console.log('📊 [Opening Balance] Starting creation process...');
      
      // Step 1: Validate request
      this.validateRequest(request);
      
      // Step 2: Validate and resolve account codes to IDs
      const resolvedEntries = await this.resolveAccountCodes(request.entries, transaction);
      
      // Step 3: Validate balancing
      const validation = this.validateBalancing(resolvedEntries);
      
      // Step 4: Auto-balance if needed and enabled
      let finalEntries = resolvedEntries;
      if (!validation.isValid && request.autoBalanceWithEquity) {
        console.log('⚖️  [Opening Balance] Auto-balancing with equity account...');
        finalEntries = await this.addBalancingEntry(
          resolvedEntries,
          validation.difference,
          request.equityAccountCode || '3000',
          transaction
        );
      } else if (!validation.isValid) {
        throw new ValidationError(
          `Opening balances are not balanced. Debits: ${validation.totalDebits}, Credits: ${validation.totalCredits}. ` +
          `Difference: ${Math.abs(validation.difference)}. Set autoBalanceWithEquity=true to auto-balance.`
        );
      }
      
      // Step 5: Generate entry number
      const entryNumber = await this.generateEntryNumber(transaction);
      
      // Step 6: Create GL entries
      const entriesCreated = await this.createGLEntries(
        entryNumber,
        request.effectiveDate,
        finalEntries,
        request.description || 'Opening balance',
        transaction
      );
      
      console.log(`✅ [Opening Balance] Created ${entriesCreated} entries successfully`);
      
      return {
        success: true,
        entryNumber,
        entriesCreated,
        message: `Opening balances created successfully. Entry: ${entryNumber}`,
      };
    });
  }
  
  /**
   * Get existing opening balances
   * 
   * Time Complexity: O(n log n) for sorting
   * Space Complexity: O(n)
   */
  async getOpeningBalances(effectiveDate?: Date): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const where: any = {
        sourceModule: SourceModule.OPENING_BALANCE,
        isOpeningBalance: true,
      };
      
      if (effectiveDate) {
        where.entryDate = effectiveDate;
      }
      
      const entries = await GeneralLedger.findAll({
        where,
        include: [
          {
            model: ChartOfAccounts,
            as: 'account',
            attributes: ['accountCode', 'accountName', 'accountType', 'normalBalance'],
          },
        ],
        order: [['entryDate', 'DESC'], ['id', 'ASC']],
      });
      
      return entries;
    });
  }
  
  /**
   * Delete opening balances by entry number
   * 
   * Time Complexity: O(n) where n = entries to delete
   * Space Complexity: O(1)
   */
  async deleteOpeningBalances(entryNumber: string): Promise<{ message: string; deletedCount: number }> {
    return this.executeWithTransaction(async (transaction) => {
      // Validate entry exists
      const entries = await GeneralLedger.findAll({
        where: {
          entryNumber,
          sourceModule: SourceModule.OPENING_BALANCE,
          isOpeningBalance: true,
        },
        transaction,
      });
      
      if (entries.length === 0) {
        throw new ValidationError(`No opening balance entries found with entry number: ${entryNumber}`);
      }
      
      // Delete all entries with this entry number
      const deletedCount = await GeneralLedger.destroy({
        where: {
          entryNumber,
          sourceModule: SourceModule.OPENING_BALANCE,
          isOpeningBalance: true,
        },
        transaction,
      });
      
      console.log(`🗑️  [Opening Balance] Deleted ${deletedCount} entries for ${entryNumber}`);
      
      return {
        message: `Opening balance entries deleted successfully`,
        deletedCount,
      };
    });
  }
  
  // ==================== PRIVATE HELPER METHODS ====================
  
  /**
   * Validate opening balance request
   * Time Complexity: O(1)
   */
  private validateRequest(request: CreateOpeningBalanceRequest): void {
    if (!request.effectiveDate) {
      throw new ValidationError('Effective date is required');
    }
    
    if (!request.entries || request.entries.length === 0) {
      throw new ValidationError('At least one opening balance entry is required');
    }
    
    // Validate effective date is not in the future
    if (request.effectiveDate > new Date()) {
      throw new ValidationError('Effective date cannot be in the future');
    }
    
    // Validate each entry
    for (const entry of request.entries) {
      if (!entry.accountCode) {
        throw new ValidationError('Account code is required for all entries');
      }
      
      if (!entry.amount || entry.amount <= 0) {
        throw new ValidationError(`Amount must be greater than 0 for account ${entry.accountCode}`);
      }
      
      if (!entry.entryType || !['DEBIT', 'CREDIT'].includes(entry.entryType)) {
        throw new ValidationError(`Entry type must be DEBIT or CREDIT for account ${entry.accountCode}`);
      }
    }
  }
  
  /**
   * Resolve account codes to account IDs
   * Time Complexity: O(n) where n = number of entries
   */
  private async resolveAccountCodes(
    entries: OpeningBalanceEntry[],
    transaction: Transaction
  ): Promise<Array<OpeningBalanceEntry & { accountId: number; accountName: string }>> {
    const resolved = [];
    
    for (const entry of entries) {
      const account = await ChartOfAccounts.findOne({
        where: { accountCode: entry.accountCode },
        transaction,
      });
      
      if (!account) {
        throw new ValidationError(`Account not found: ${entry.accountCode}`);
      }
      
      resolved.push({
        ...entry,
        accountId: account.id,
        accountName: account.accountName,
      });
    }
    
    return resolved;
  }
  
  /**
   * Validate that debits equal credits
   * Time Complexity: O(n)
   */
  private validateBalancing(entries: OpeningBalanceEntry[]): ValidationResult {
    let totalDebits = 0;
    let totalCredits = 0;
    const errors: string[] = [];
    
    for (const entry of entries) {
      if (entry.entryType === 'DEBIT') {
        totalDebits += entry.amount;
      } else {
        totalCredits += entry.amount;
      }
    }
    
    const difference = totalDebits - totalCredits;
    const isValid = Math.abs(difference) < 0.01; // Allow 1 cent tolerance
    
    if (!isValid) {
      errors.push(`Debits (${totalDebits.toFixed(2)}) do not equal Credits (${totalCredits.toFixed(2)})`);
    }
    
    return {
      isValid,
      totalDebits,
      totalCredits,
      difference,
      errors,
    };
  }
  
  /**
   * Add balancing entry using Owner's Capital account
   * Time Complexity: O(1)
   */
  private async addBalancingEntry(
    entries: Array<OpeningBalanceEntry & { accountId: number; accountName: string }>,
    difference: number,
    equityAccountCode: string,
    transaction: Transaction
  ): Promise<Array<OpeningBalanceEntry & { accountId: number; accountName: string }>> {
    // Get equity account
    const equityAccount = await ChartOfAccounts.findOne({
      where: { accountCode: equityAccountCode },
      transaction,
    });
    
    if (!equityAccount) {
      throw new ValidationError(
        `Equity account not found: ${equityAccountCode}. ` +
        `Please create Owner's Capital account (${equityAccountCode}) first.`
      );
    }
    
    // Calculate balancing entry
    // If debits > credits, we need a credit entry
    // If credits > debits, we need a debit entry
    const balancingEntry = {
      accountCode: equityAccountCode,
      accountName: equityAccount.accountName,
      accountId: equityAccount.id,
      amount: Math.abs(difference),
      entryType: (difference > 0 ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
    };
    
    console.log(`   Adding balancing entry: ${balancingEntry.entryType} ${equityAccountCode} ${balancingEntry.amount.toFixed(2)}`);
    
    return [...entries, balancingEntry];
  }
  
  /**
   * Generate entry number for opening balance
   * Time Complexity: O(1)
   */
  private async generateEntryNumber(transaction: Transaction): Promise<string> {
    const lastEntry = await GeneralLedger.findOne({
      where: {
        sourceModule: SourceModule.OPENING_BALANCE,
      },
      order: [['id', 'DESC']],
      transaction,
    });
    
    let nextNumber = 1;
    if (lastEntry) {
      const match = lastEntry.entryNumber.match(/OB-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    return `OB-${String(nextNumber).padStart(6, '0')}`;
  }
  
  /**
   * Create GL entries in batch
   * Time Complexity: O(n)
   */
  private async createGLEntries(
    entryNumber: string,
    effectiveDate: Date,
    entries: Array<OpeningBalanceEntry & { accountId: number; accountName: string }>,
    description: string,
    transaction: Transaction
  ): Promise<number> {
    let count = 0;
    
    for (const entry of entries) {
      await GeneralLedger.create(
        {
          entryNumber,
          entryDate: effectiveDate,
          accountId: entry.accountId,
          entryType: entry.entryType as EntryType,
          amount: entry.amount,
          sourceModule: SourceModule.OPENING_BALANCE,
          sourceTransactionId: 0,
          sourceTransactionNumber: entryNumber,
          description: `${description} - ${entry.accountName}`,
          isPosted: true,
          postedAt: new Date(),
          isReversed: false,
          isOpeningBalance: true,
        },
        { transaction }
      );
      
      count++;
    }
    
    return count;
  }
}

// Export singleton instance
export default new OpeningBalanceService();
