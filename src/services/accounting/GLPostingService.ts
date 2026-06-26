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
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Batch account lookups (single WHERE IN query)
 * - Batch account balance updates (single raw SQL with CASE)
 * - In-memory caching for chart of accounts
 */

// Simple in-memory cache for chart of accounts
const accountCache = new Map<string, ChartOfAccounts>();
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
   * OPTIMIZED: Batch account lookups and balance updates
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

      // ✅ OPTIMIZATION: Batch fetch all unique accounts in ONE query
      console.time('    ├─ Fetch accounts (batch)');
      const uniqueAccountCodes = [...new Set(request.entries.map(e => e.accountCode))];
      const accountsMap = await this.getAccountsByCodesBatch(uniqueAccountCodes, t);
      console.timeEnd('    ├─ Fetch accounts (batch)');

      console.time('    ├─ Prepare GL entries');
      const glEntriesToCreate = request.entries.map((entry) => {
        const account = accountsMap.get(entry.accountCode);
        if (!account) {
          throw new ValidationError(`Account not found: ${entry.accountCode}`);
        }
        const accountId = typeof account.id === 'number' ? account.id : parseInt(String(account.id));

        return {
          entryNumber,
          entryDate: entryDate,
          accountId: accountId,
          entryType: entry.entryType,
          amount: entry.amount,
          sourceModule: request.sourceModule,
          sourceTransactionId: sourceTransactionId,
          sourceTransactionNumber: request.sourceTransactionNumber,
          description: entry.description,
          isPosted: true,
          isReversed: false,
          postedAt: new Date(),
          createdBy: request.createdBy,
        };
      });
      console.timeEnd('    ├─ Prepare GL entries');

      // ✅ OPTIMIZATION: Bulk insert all GL entries at once
      console.time('    ├─ Bulk insert GL entries');
      const glEntries = await GeneralLedger.bulkCreate(glEntriesToCreate, { transaction: t });
      console.timeEnd('    ├─ Bulk insert GL entries');

      // ✅ OPTIMIZATION: Batch update account balances in ONE query
      console.time('    └─ Update account balances (batch)');
      await this.updateAccountBalancesBatch(request.entries, accountsMap, t);
      console.timeEnd('    └─ Update account balances (batch)');


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
   * Get account by code (with caching)
   */
  private async getAccountByCode(accountCode: string, transaction: Transaction): Promise<ChartOfAccounts> {
    // Check cache first
    const now = Date.now();
    if (now - cacheTimestamp < CACHE_TTL && accountCache.has(accountCode)) {
      return accountCache.get(accountCode)!;
    }

    const account = await ChartOfAccounts.findOne({
      where: { accountCode, isActive: true },
      transaction,
    });

    if (!account) {
      throw new ValidationError(`Account not found: ${accountCode}`);
    }

    // Update cache
    accountCache.set(accountCode, account);
    cacheTimestamp = now;

    return account;
  }

  /**
   * ✅ NEW: Batch fetch multiple accounts by codes in ONE query
   */
  private async getAccountsByCodesBatch(
    accountCodes: string[],
    transaction: Transaction
  ): Promise<Map<string, ChartOfAccounts>> {
    const accountsMap = new Map<string, ChartOfAccounts>();
    const uncachedCodes: string[] = [];

    // Check cache first
    const now = Date.now();
    const isCacheValid = now - cacheTimestamp < CACHE_TTL;

    for (const code of accountCodes) {
      if (isCacheValid && accountCache.has(code)) {
        accountsMap.set(code, accountCache.get(code)!);
      } else {
        uncachedCodes.push(code);
      }
    }

    // Fetch uncached accounts in one query
    if (uncachedCodes.length > 0) {
      const accounts = await ChartOfAccounts.findAll({
        where: {
          accountCode: { [Op.in]: uncachedCodes },
          isActive: true
        },
        transaction,
      });

      accounts.forEach(account => {
        accountsMap.set(account.accountCode, account);
        accountCache.set(account.accountCode, account);
      });
      cacheTimestamp = now;
    }

    return accountsMap;
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

  /**
   * ✅ NEW: Batch update account balances in ONE query using raw SQL
   * This reduces 2.105s to ~50ms for the account balance updates
   */
  private async updateAccountBalancesBatch(
    entries: GLEntry[],
    accountsMap: Map<string, ChartOfAccounts>,
    transaction: Transaction
  ): Promise<void> {
    // Group entries by account
    const accountUpdates = new Map<number, { debitAmount: number; creditAmount: number; normalBalance: string }>();

    for (const entry of entries) {
      const account = accountsMap.get(entry.accountCode);
      if (!account) continue;

      const accountId = typeof account.id === 'number' ? account.id : parseInt(String(account.id));
      const existing = accountUpdates.get(accountId) || { debitAmount: 0, creditAmount: 0, normalBalance: account.normalBalance };

      if (entry.entryType === EntryType.DEBIT) {
        existing.debitAmount += entry.amount;
      } else {
        existing.creditAmount += entry.amount;
      }

      accountUpdates.set(accountId, existing);
    }

    // Ensure all account balances exist (use individual findOrCreate for each)
    const accountIds = Array.from(accountUpdates.keys());
    for (const accountId of accountIds) {
      await AccountBalance.findOrCreate({
        where: sequelize.and(
          { accountId },
          sequelize.where(sequelize.col('fiscal_period_id'), Op.is, null)
        ) as any,
        defaults: {
          accountId,
          openingBalance: 0,
          debitTotal: 0,
          creditTotal: 0,
          closingBalance: 0,
          lastUpdated: new Date(),
        },
        transaction,
      });
    }

    // Build CASE statement for bulk update
    const debitCases: string[] = [];
    const creditCases: string[] = [];
    const closingCases: string[] = [];

    for (const [accountId, update] of accountUpdates) {
      debitCases.push(`WHEN ${accountId} THEN debit_total + ${update.debitAmount}`);
      creditCases.push(`WHEN ${accountId} THEN credit_total + ${update.creditAmount}`);

      // Calculate closing balance based on normal balance
      if (update.normalBalance === 'DEBIT') {
        closingCases.push(`WHEN ${accountId} THEN opening_balance + (debit_total + ${update.debitAmount}) - (credit_total + ${update.creditAmount})`);
      } else {
        closingCases.push(`WHEN ${accountId} THEN opening_balance + (credit_total + ${update.creditAmount}) - (debit_total + ${update.debitAmount})`);
      }
    }

    // Execute single bulk update query
    await sequelize.query(
      `UPDATE account_balances
       SET debit_total = CASE account_id ${debitCases.join(' ')} END,
           credit_total = CASE account_id ${creditCases.join(' ')} END,
           closing_balance = CASE account_id ${closingCases.join(' ')} END,
           last_updated = NOW()
       WHERE account_id IN (${accountIds.join(',')})
         AND fiscal_period_id IS NULL`,
      { transaction }
    );
  }
}

export default new GLPostingService();
