import { Transaction, Op } from 'sequelize';
import sequelize from '../../config/database';
import GeneralLedger, { EntryType, SourceModule } from '../../models/accounting/GeneralLedger';
import AccountBalance from '../../models/accounting/AccountBalance';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import { ValidationError, BusinessLogicError } from '../../core/AppError';

/**
 * GL Posting Service
 * 
 * Central service for creating double-entry GL postings.
 * Ensures accounting equation balance: Debits = Credits
 */

export interface GLEntry {
  accountCode: string;
  entryType: EntryType;
  amount: number;
  description: string;
}

export interface GLPostingRequest {
  entryDate: Date;
  sourceModule: SourceModule;
  sourceTransactionId: number;
  sourceTransactionNumber: string;
  entries: GLEntry[];
  createdBy?: number;
}

class GLPostingService {
  
  /**
   * Post GL entries with validation
   */
  async postGLEntries(request: GLPostingRequest, transaction?: Transaction): Promise<GeneralLedger[]> {
    const t = transaction || await sequelize.transaction();
    
    try {
      console.log('📊 GL Posting Request:', JSON.stringify({
        entryDate: request.entryDate,
        entryDateType: typeof request.entryDate,
        sourceModule: request.sourceModule,
        sourceTransactionId: request.sourceTransactionId,
        sourceTransactionIdType: typeof request.sourceTransactionId,
        sourceTransactionNumber: request.sourceTransactionNumber,
        entriesCount: request.entries.length,
        createdBy: request.createdBy,
        createdByType: typeof request.createdBy
      }, null, 2));
      
      // Validate entries
      this.validateGLEntries(request.entries);
      
      // Generate entry number
      const entryNumber = await this.generateEntryNumber(t);
      
      // Ensure entryDate is a proper Date object
      const entryDate = request.entryDate instanceof Date 
        ? request.entryDate 
        : new Date(request.entryDate);
      
      // Ensure sourceTransactionId is a number
      const sourceTransactionId = typeof request.sourceTransactionId === 'number' 
        ? request.sourceTransactionId 
        : parseInt(String(request.sourceTransactionId));
      
      console.log('✅ Validated values:', {
        entryDate,
        entryDateType: typeof entryDate,
        sourceTransactionId,
        sourceTransactionIdType: typeof sourceTransactionId
      });
      
      // Create GL entries
      const glEntries: GeneralLedger[] = [];
      
      for (const entry of request.entries) {
        const account = await this.getAccountByCode(entry.accountCode, t);
        
        // ✅ Ensure accountId is a number, not an object
        const accountId = typeof account.id === 'number' ? account.id : parseInt(String(account.id));
        
        console.log('🔍 Creating GL entry:', {
          accountCode: entry.accountCode,
          accountId: accountId,
          accountIdType: typeof accountId,
          entryType: entry.entryType,
          amount: entry.amount,
          entryDate: entryDate,
          entryDateType: typeof entryDate,
          sourceTransactionId,
          sourceTransactionIdType: typeof sourceTransactionId
        });
        
        const glEntry = await GeneralLedger.create({
          entryNumber,
          entryDate: entryDate,
          accountId: accountId, // ✅ Use validated accountId
          entryType: entry.entryType,
          amount: entry.amount,
          sourceModule: request.sourceModule,
          sourceTransactionId: sourceTransactionId, // ✅ Use validated sourceTransactionId
          sourceTransactionNumber: request.sourceTransactionNumber,
          description: entry.description,
          isPosted: true,
          isReversed: false,
          postedAt: new Date(),
          createdBy: request.createdBy,
        }, { transaction: t });
        
        glEntries.push(glEntry);
        
        // Update account balance
        await this.updateAccountBalance(accountId, entry.entryType, entry.amount, t);
      }

      
      if (!transaction) {
        await t.commit();
      }
      
      return glEntries;
    } catch (error) {
      console.error('❌ GL Posting Error:', error);
      if (!transaction) {
        await t.rollback();
      }
      throw error;
    }
  }
  
  /**
   * Validate GL entries balance
   */
  private validateGLEntries(entries: GLEntry[]): void {
    if (!entries || entries.length < 2) {
      throw new ValidationError('At least 2 GL entries required for double-entry');
    }
    
    let debitTotal = 0;
    let creditTotal = 0;
    
    for (const entry of entries) {
      if (entry.amount <= 0) {
        throw new ValidationError(`Invalid amount for account ${entry.accountCode}`);
      }
      
      if (entry.entryType === EntryType.DEBIT) {
        debitTotal += entry.amount;
      } else {
        creditTotal += entry.amount;
      }
    }
    
    // Check if debits equal credits (with small tolerance for rounding)
    const difference = Math.abs(debitTotal - creditTotal);
    if (difference > 0.01) {
      throw new BusinessLogicError(
        `GL entries not balanced. Debits: ${debitTotal}, Credits: ${creditTotal}, Difference: ${difference}`
      );
    }
  }
  
  /**
   * Generate unique entry number
   */
  private async generateEntryNumber(transaction: Transaction): Promise<string> {
    const year = new Date().getFullYear();
    const lastEntry = await GeneralLedger.findOne({
      where: sequelize.where(
        sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "entry_date"')),  // ✅ PostgreSQL syntax
        year
      ),
      order: [['id', 'DESC']],
      transaction,
    });
    
    let nextNumber = 1;
    if (lastEntry) {
      const match = lastEntry.entryNumber.match(/JE-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    return `JE-${year}-${String(nextNumber).padStart(6, '0')}`;
  }
  
  /**
   * Get account by code
   */
  private async getAccountByCode(accountCode: string, transaction: Transaction): Promise<ChartOfAccounts> {
    const account = await ChartOfAccounts.findOne({
      where: { accountCode, isActive: true },
      transaction,
    });
    
    if (!account) {
      throw new ValidationError(`Account not found: ${accountCode}`);
    }
    
    return account;
  }
  
  /**
   * Update account balance
   */
  private async updateAccountBalance(
    accountId: number,
    entryType: EntryType,
    amount: number,
    transaction: Transaction
  ): Promise<void> {
    // ✅ Find or create account balance with NULL fiscal period (current period)
    const [balance] = await AccountBalance.findOrCreate({
      where: sequelize.and(
        { accountId },
        sequelize.where(sequelize.col('fiscal_period_id'), Op.is, null)
      ) as any,
      defaults: {
        accountId,
        // ✅ Don't include fiscalPeriodId - let database default to NULL
        openingBalance: 0,
        debitTotal: 0,
        creditTotal: 0,
        closingBalance: 0,
        lastUpdated: new Date(),
      },
      transaction,
    });
    
    // ✅ Convert DECIMAL values to numbers to prevent string concatenation
    const openingBalance = parseFloat(String(balance.openingBalance)) || 0;
    const debitTotal = parseFloat(String(balance.debitTotal)) || 0;
    const creditTotal = parseFloat(String(balance.creditTotal)) || 0;
    
    if (entryType === EntryType.DEBIT) {
      balance.debitTotal = debitTotal + amount;
    } else {
      balance.creditTotal = creditTotal + amount;
    }
    
    // Calculate closing balance based on account normal balance
    const account = await ChartOfAccounts.findByPk(accountId, { transaction });
    if (account) {
      // ✅ Use the converted numeric values for calculation
      const newDebitTotal = parseFloat(String(balance.debitTotal)) || 0;
      const newCreditTotal = parseFloat(String(balance.creditTotal)) || 0;
      
      if (account.normalBalance === 'DEBIT') {
        balance.closingBalance = openingBalance + newDebitTotal - newCreditTotal;
      } else {
        balance.closingBalance = openingBalance + newCreditTotal - newDebitTotal;
      }
    }
    
    balance.lastUpdated = new Date();
    await balance.save({ transaction });
  }
}

export default new GLPostingService();
