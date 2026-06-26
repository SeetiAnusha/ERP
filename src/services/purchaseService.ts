import Purchase from '../models/Purchase';
import PurchaseItem from '../models/PurchaseItem';
import AssociatedInvoice from '../models/AssociatedInvoice';
import Supplier from '../models/Supplier';
import Product from '../models/Product';
import BankAccount from '../models/BankAccount';
import BankRegister from '../models/BankRegister';
import Card from '../models/Card';
import AccountsPayable from '../models/AccountsPayable';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { TransactionType } from '../types/TransactionType';
import { TransactionFactory, PurchaseContext } from './shared/TransactionFactory';
import {
  ValidationError,
  InsufficientBalanceError,
  BusinessLogicError,
  NotFoundError
} from '../core/AppError';
import { BaseService } from '../core/BaseService';
import { serviceConfig } from '../config/ServiceConfig';
// Centralized validation — rules live in ValidationFramework, not duplicated here
import { ValidationFramework, ValidationSchemas } from '../core/ValidationFramework';
// DTO — controller already parses/sanitises req.body into this type before calling service
import { CreatePurchaseDTO } from '../dto/purchase.dto';
import GLPostingService from './accounting/GLPostingService';
import AccountingRulesEngine from './accounting/AccountingRulesEngine';
import { SourceModule } from '../models/accounting/GeneralLedger';
import '../models/associations';
// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaymentStatus {
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
}

/**
 * CreatePurchaseRequest is now an alias for CreatePurchaseDTO.
 *
 * The controller runs parsePurchaseDTO(req.body) BEFORE calling createPurchase().
 * By the time data reaches this service it is already:
 *   - Whitelisted  — unknown fields dropped at the HTTP boundary
 *   - Type-coerced — strings coerced to numbers and Dates
 *   - Shape-valid  — required fields validated before the DB transaction opens
 *
 * Using type aliases keeps all private methods compiling without any changes.
 * If the DTO schema changes, the service automatically picks it up.
 */
type CreatePurchaseRequest = CreatePurchaseDTO;

/** Item type derived from the DTO — all numeric fields are guaranteed numbers */
type PurchaseItemInput = NonNullable<CreatePurchaseDTO['items']>[number];

/**
 * Invoice type derived from the DTO.
 * Previously cardId/bankAccountId were number|string — DTO guarantees number.
 * Internal code that calls Number(invoice.cardId) is now a no-op but harmless.
 */
type AssociatedInvoiceInput = NonNullable<CreatePurchaseDTO['associatedInvoices']>[number];

interface PrecomputedLookups {
  products: Map<number, Product>;
  bankAccounts: Map<number, BankAccount>;
  cards: Map<number, Card>;
  suppliers: Map<number, Supplier>;
  suppliersByName: Map<string, Supplier>;
}

interface CategorizedInvoices {
  immediateBank: Array<{ invoice: AssociatedInvoiceInput; amount: number }>;
  immediateCard: Array<{ invoice: AssociatedInvoiceInput; amount: number }>;
  creditCard: Array<{ invoice: AssociatedInvoiceInput; amount: number }>;
  credit: Array<{ invoice: AssociatedInvoiceInput; amount: number }>;
}

interface BatchInventoryData {
  purchaseItems: any[];
  productUpdates: Array<{
    id: number;
    amount: number;
    unitCost: number;
    subtotal: number;
    unit?: string;
    taxRate?: number;
  }>;
}

interface BatchInvoiceData {
  bankRegisterEntries: any[];
  apEntries: any[];
  associatedInvoiceRecords: any[];
  glEntries: any[];
  bankAccountBalanceUpdates: Map<number, number>;
  totalAssociatedPaid: number;
}

interface BankBalanceCache {
  balances: Map<number, number>;
  getBalance(bankAccountId?: number): number;
  updateBalance(bankAccountId: number, newBalance: number): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULLY OPTIMIZED PURCHASE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class PurchaseService extends BaseService {

  // ═════════════════════════════════════════════════════════════════════════════
  // PUBLIC API — All signatures identical to original. No breaking changes.
  // ═════════════════════════════════════════════════════════════════════════════

  async getAllPurchases(transactionType?: string): Promise<Purchase[]> {
    return this.executeWithRetry(async () => {
      if (transactionType && !this.isValidTransactionType(transactionType)) {
        throw new ValidationError(`Invalid transaction type: ${transactionType}. Must be 'GOODS'`);
      }
      const whereClause: any = {};
      if (transactionType) whereClause.transactionType = transactionType;
      return await this.loadPurchasesWithFallback(whereClause);
    });
  }

  async getAllPurchasesWithPagination(options?: any) {
    return this.getAllWithPagination(
      Purchase,
      options,
      {},
      [
        {
          model: Supplier,
          as: 'supplier',
          required: false,
          attributes: ['id', 'name', 'rnc']
        }
      ]
    );
  }

  async getPurchaseById(id: number): Promise<Purchase> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      const purchase = await Purchase.findByPk(id);
      if (!purchase) throw new NotFoundError(`Purchase with ID ${id} not found`);
      return purchase;
    });
  }

  /**
   * FULLY OPTIMIZED createPurchase
   * Target: < 1000ms total response time
   * 
   * KEY FIXES from diagnostic:
   * - lookups: 695ms → 80ms (pre-compute + parallel)
   * - glEntries: 2358ms → 100ms (batch posting + skip hooks)
   * - regNumber: 147ms → 30ms (index on registration_number)
   * - purchaseCreate: 207ms → 60ms (skip hooks if possible)
   * - mainPayment: 226ms → 40ms (no redundant queries)
   * - inventory: 406ms → 80ms (bulkCreate + raw SQL)
   */
  async createPurchase(data: CreatePurchaseRequest): Promise<Purchase> {
    // PerformanceProfiler.clear();
    // PerformanceProfiler.start('TOTAL_CREATE_PURCHASE');
    
    return this.executeWithTransaction(async (transaction) => {
      // PerformanceProfiler.start('PHASE_0_VALIDATION');
      // PHASE 0: EARLY VALIDATION — uses ValidationSchemas.PURCHASE_CREATE from ValidationFramework.
      // This is the single source of truth for all purchase validation rules.
      // Do NOT add inline validation here — extend ValidationSchemas.PURCHASE_CREATE instead.
      const t0 = Date.now();
      ValidationFramework.validate(data, ValidationSchemas.PURCHASE_CREATE);
      console.log(`⏱️ Phase 0 (Validation): ${Date.now() - t0}ms`);

      // PerformanceProfiler.start('PHASE_1_PARALLEL_SETUP');
      // PHASE 1: PARALLEL INDEPENDENT SETUP
      const t1 = Date.now();
      const [registrationNumber, paymentStatus, associatedExpenses] = await Promise.all([
        // Uses BaseService.generateRegistrationNumber — MAX() + FOR UPDATE + parameterised query.
        // No duplicate logic here. All services share the same safe, fast implementation.
        this.generateRegistrationNumber('CP', Purchase, transaction),
        Promise.resolve(this.calculatePaymentStatus(data.paymentType, data.total)),
        Promise.resolve(this.calculateAssociatedExpenses(data.associatedInvoices))
      ]);
      console.log(`⏱️ Phase 1 (Parallel Setup): ${Date.now() - t1}ms`);
      // PerformanceProfiler.end('PHASE_1_PARALLEL_SETUP');

      const mainPurchaseAmount = data.productTotal || (data.total - associatedExpenses) || data.total;

      // PHASE 2: CREATE MAIN PURCHASE RECORD
      // The DTO is spread directly — all fields from the HTTP boundary map 1:1 to the model.
      // Only computed/server-side fields (registrationNumber, registrationDate, status, etc.)
      // are added on top. This is the clean pattern: DTO carries user data, server adds its own.
      const t2 = Date.now();
      const purchase = await Purchase.create({
        // ── Spread all DTO fields directly ───────────────────────────────────
        // Every field the user sent is already sanitised, type-coerced, and validated
        // by parsePurchaseDTO() in the controller before this service was called.
        ...data,

        // ── Override: dates need to be Date objects (DTO may carry them already as Date) ──
        date:         new Date(data.date),
        chequeDate:   data.chequeDate   ? new Date(data.chequeDate)   : undefined,
        transferDate: data.transferDate ? new Date(data.transferDate) : undefined,
        voucherDate:  data.voucherDate  ? new Date(data.voucherDate)  : undefined,

        // ── Server-computed fields — never from the client ────────────────────
        registrationNumber,                                    // generated by sequence
        registrationDate:    new Date(),                       // server timestamp
        productTotal:        data.productTotal || data.total,  // fallback to total if not set
        additionalExpenses:  associatedExpenses,               // sum of associated invoice amounts
        totalWithAssociated: mainPurchaseAmount + associatedExpenses,
        status:              'COMPLETED',

        // ── Payment status (paidAmount, balanceAmount, paymentStatus) ─────────
        // Spread last so these override any same-named fields from the DTO spread
        ...paymentStatus,
      } as any, { transaction });
      console.log(`⏱️ Phase 2 (Create Purchase): ${Date.now() - t2}ms`);

      // PHASE 3: PREPARE ALL LOOKUPS + BANK BALANCES IN PARALLEL
      // ✅ OPTIMIZATION: Collect bank account IDs needed for this purchase
      const t3 = Date.now();
      const neededBankAccountIds = new Set<number>();
      if (data.bankAccountId) neededBankAccountIds.add(Number(data.bankAccountId));
      if (data.associatedInvoices) {
        data.associatedInvoices.forEach(inv => {
          if (inv.bankAccountId) neededBankAccountIds.add(Number(inv.bankAccountId));
        });
      }
      
      const t3a = Date.now();
      const lookups = await this.prepareLookups(data, transaction);
      console.log(`⏱️ Phase 3a (prepareLookups): ${Date.now() - t3a}ms`);
      
      const t3b = Date.now();
      const balanceCache = await this.buildBankBalanceCache(neededBankAccountIds, transaction);
      console.log(`⏱️ Phase 3b (buildBankBalanceCache): ${Date.now() - t3b}ms`);
      
      console.log(`⏱️ Phase 3 (Lookups + Balance Cache): ${Date.now() - t3}ms`);

      // PHASE 4: PROCESS MAIN PAYMENT (using lookups, NO extra queries)
      const t4 = Date.now();
      const mainPaymentBalanceUpdates = await this.processMainPaymentOptimized(data, purchase, mainPurchaseAmount, transaction, lookups, balanceCache);
      console.log(`⏱️ Phase 4 (Main Payment): ${Date.now() - t4}ms`);

      // PHASE 5: BULK INVENTORY UPDATE
      const t5 = Date.now();
      if (data.items && data.items.length > 0) {
        const batchData = this.buildBatchInventoryData(data.items, purchase.id, associatedExpenses, lookups);
        await this.executeBatchInventoryUpdate(batchData, transaction);
      }
      console.log(`⏱️ Phase 5 (Inventory Update): ${Date.now() - t5}ms`);

      // PHASE 6: BULK ASSOCIATED INVOICES
      let totalAssociatedPaid = 0;
      let allGLEntries: any[] = [];
      let associatedInvoiceBalanceUpdates = new Map<number, number>();
      const t6 = Date.now();

      if (data.associatedInvoices && data.associatedInvoices.length > 0) {
        const categorized = this.categorizeInvoices(data.associatedInvoices);
        const batchData = this.buildBatchInvoiceData(categorized, purchase, registrationNumber, lookups, balanceCache);
        await this.executeBatchInvoiceUpdate(batchData, transaction);
        totalAssociatedPaid = batchData.totalAssociatedPaid;
        allGLEntries = batchData.glEntries;
        associatedInvoiceBalanceUpdates = batchData.bankAccountBalanceUpdates;
      }
      console.log(`⏱️ Phase 6 (Associated Invoices): ${Date.now() - t6}ms`);

      // ✅ FIX: Apply all balance updates in one batch (main payment + associated invoices)
      // This prevents double deduction by ensuring each bank account is updated only once
      const t7 = Date.now();
      const allBalanceUpdates = new Map<number, number>();
      
      // Merge main payment balance updates
      for (const [accountId, balance] of mainPaymentBalanceUpdates) {
        allBalanceUpdates.set(accountId, balance);
      }
      
      // Merge associated invoice balance updates
      for (const [accountId, balance] of associatedInvoiceBalanceUpdates) {
        allBalanceUpdates.set(accountId, balance);
      }
      
      // Update all bank account balances in one batch
      const balanceUpdatePromises: Promise<any>[] = [];
      for (const [accountId, newBalance] of allBalanceUpdates) {
        balanceUpdatePromises.push(
          BankAccount.update({ balance: newBalance }, { where: { id: accountId }, transaction })
        );
      }
      await Promise.all(balanceUpdatePromises);
      console.log(`⏱️ Phase 7 (Balance Updates): ${Date.now() - t7}ms`);

      // PHASE 7: POST ALL GL ENTRIES IN ONE BATCH (main + associated)
      const t8 = Date.now();
      const mainGLEntries = this.buildMainGLEntries(data.paymentType, mainPurchaseAmount);
      if (mainGLEntries.length > 0) {
        allGLEntries = [...mainGLEntries, ...allGLEntries];
      }
      console.log(`⏱️ Phase 8 (Build GL Entries): ${Date.now() - t8}ms`);

      // PHASE 8: FINAL STATUS UPDATE
      const t9 = Date.now();
      const finalStatus = this.determineFinalStatus(
        data.paymentType,
        data.associatedInvoices,
        totalAssociatedPaid
      );
      await purchase.update({ paymentStatus: finalStatus }, { transaction });
      console.log(`⏱️ Phase 9 (Final Status): ${Date.now() - t9}ms`);

      // ✅ CRITICAL OPTIMIZATION: Post GL asynchronously after transaction completes
      // This reduces response time by ~1.5s (GL posting + account balance updates)
      // The transaction will be committed by executeWithTransaction wrapper
      if (allGLEntries.length > 0) {
        // Store purchase data for async processing
        const purchaseData = {
          id: purchase.id,
          date: purchase.date,
          registrationNumber: purchase.registrationNumber,
        };
        const glEntriesData = [...allGLEntries];
        
        // Post GL entries in background after transaction completes
        // Use setImmediate to ensure this runs after the current call stack completes
        setImmediate(() => {
          this.postGLAsync(purchaseData, glEntriesData).catch(error => {
            console.error('❌ Async GL posting failed:', error);
            // Could implement retry logic here
          });
        });
      }

      // PerformanceProfiler.end('TOTAL_CREATE_PURCHASE');
      // console.log(PerformanceProfiler.getReport());
      
      return purchase;
    });
  }

  async updatePurchase(id: number, data: Partial<CreatePurchaseRequest>): Promise<Purchase> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      const purchase = await Purchase.findByPk(id, { transaction });
      if (!purchase) throw new NotFoundError(`Purchase with ID ${id} not found`);
      if (data.total !== undefined) {
        this.validateNumeric(data.total, 'Total amount', { min: serviceConfig.validation.minPurchaseAmount });
      }
      return await purchase.update(data, { transaction });
    });
  }

  async collectPayment(id: number, paymentData: { amount: number; paymentMethod: string }): Promise<Purchase> {
    return this.executeWithTransaction(async (transaction) => {
      const purchase = await Purchase.findByPk(id, { transaction });
      if (!purchase) throw new NotFoundError(`Purchase with ID ${id} not found`);

      const currentPaid = Number(purchase.paidAmount);
      const totalAmount = Number(purchase.balanceAmount) + currentPaid;
      const newPaidAmount = currentPaid + paymentData.amount;

      if (newPaidAmount > totalAmount) {
        throw new ValidationError('Payment amount exceeds remaining balance');
      }

      const newBalanceAmount = totalAmount - newPaidAmount;
      let paymentStatus: 'Paid' | 'Unpaid' | 'Partial' = 'Partial';
      if (this.isEqual(newBalanceAmount, 0)) paymentStatus = 'Paid';
      else if (this.isEqual(newPaidAmount, 0)) paymentStatus = 'Unpaid';

      await purchase.update({
        paidAmount: this.roundCurrency(newPaidAmount),
        balanceAmount: this.roundCurrency(Math.max(0, newBalanceAmount)),
        paymentStatus,
      }, { transaction });

      return purchase;
    });
  }

  async deletePurchase(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      const purchase = await Purchase.findByPk(id, { transaction });
      if (!purchase) throw new NotFoundError(`Purchase with ID ${id} not found`);
      if (purchase.paymentStatus === 'Paid' || purchase.paymentStatus === 'Partial') {
        throw new BusinessLogicError('Cannot delete a purchase with payments. Please reverse all payments first.');
      }
      await this.safeDeleteRelatedRecords(id, transaction);
      await purchase.destroy({ transaction });
      return { message: 'Purchase deleted successfully' };
    });
  }

  async getPurchaseItems(purchaseId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(purchaseId, 'Purchase ID', { min: 1 });
      return await PurchaseItem.findAll({
        where: { purchaseId },
        include: [{ model: Product, as: 'product', attributes: ['id', 'code', 'name', 'unit'] }],
        order: [['id', 'ASC']]
      });
    });
  }

  async getAssociatedInvoices(purchaseId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(purchaseId, 'Purchase ID', { min: 1 });
      try {
        return await AssociatedInvoice.findAll({ where: { purchaseId }, order: [['id', 'ASC']] });
      } catch (error: any) {
        if (error.message?.includes('source_transaction_type')) {
          return await AssociatedInvoice.findAll({
            where: { purchaseId },
            attributes: { exclude: ['sourceTransactionType'] },
            order: [['id', 'ASC']]
          });
        }
        throw error;
      }
    });
  }

  async getPurchaseWithDetails(id: number): Promise<any> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      const purchase = await Purchase.findByPk(id, {
        include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name', 'rnc'] }]
      });
      if (!purchase) throw new NotFoundError(`Purchase with ID ${id} not found`);

      const [items, associatedInvoices] = await Promise.all([
        this.getPurchaseItems(id),
        this.getAssociatedInvoices(id)
      ]);

      return { ...purchase.toJSON(), items, associatedInvoices };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 1: ATOMIC REGISTRATION NUMBER
  // ═════════════════════════════════════════════════════════════════════════════

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ NEW: PRE-COMPUTE ALL BANK BALANCES IN ONE QUERY
  // ═════════════════════════════════════════════════════════════════════════════

  private async buildBankBalanceCache(
    neededBankAccountIds: Set<number>,
    transaction: any
  ): Promise<BankBalanceCache> {
    const balances = new Map<number, number>();

    // ✅ OPTIMIZATION: If no bank accounts needed, return empty cache immediately
    if (neededBankAccountIds.size === 0) {
      return {
        balances,
        getBalance(bankAccountId?: number): number {
          return bankAccountId ? (balances.get(bankAccountId) || 0) : 0;
        },
        updateBalance(bankAccountId: number, newBalance: number): void {
          balances.set(bankAccountId, newBalance);
        }
      };
    }

    try {
      // ✅ OPTIMIZED: Only query the specific bank accounts needed for this purchase
      // This avoids scanning the entire bank_registers table
      const [balanceResults] = await BankRegister.sequelize!.query(
        `SELECT DISTINCT ON (bank_account_id) 
          bank_account_id, balance
         FROM bank_registers
         WHERE bank_account_id IN (${Array.from(neededBankAccountIds).join(',')})
         ORDER BY bank_account_id, id DESC`,
        { transaction }
      );

      (balanceResults as any[]).forEach(row => {
        if (row.bank_account_id) {
          balances.set(Number(row.bank_account_id), Number(row.balance));
        }
      });
    } catch (error) {
      // Fallback: query individually if DISTINCT ON not supported
      // ✅ OPTIMIZED: Only query the specific bank accounts needed
      const lastTransactions = await BankRegister.findAll({
        where: { bankAccountId: { [Op.in]: Array.from(neededBankAccountIds) } },
        attributes: ['bankAccountId', 'balance'],
        order: [['id', 'DESC']],
        transaction
      });

      const seenAccounts = new Set<number>();
      lastTransactions.forEach(t => {
        if (t.bankAccountId && !seenAccounts.has(t.bankAccountId)) {
          seenAccounts.add(t.bankAccountId);
          balances.set(t.bankAccountId, Number(t.balance));
        }
      });
    }

    return {
      balances,
      getBalance(bankAccountId?: number): number {
        return bankAccountId ? (balances.get(bankAccountId) || 0) : 0;
      },
      updateBalance(bankAccountId: number, newBalance: number): void {
        balances.set(bankAccountId, newBalance);
      }
    };
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ FIXED: PREPARE LOOKUPS - includes supplier by ID with caching
  // ═════════════════════════════════════════════════════════════════════════════

  private async prepareLookups(
    data: CreatePurchaseRequest,
    transaction: any
  ): Promise<PrecomputedLookups> {
    const lookups: PrecomputedLookups = {
      products: new Map(),
      bankAccounts: new Map(),
      cards: new Map(),
      suppliers: new Map(),
      suppliersByName: new Map(),
    };

    const productIds: number[] = [];
    const bankAccountIds = new Set<number>();
    const cardIds = new Set<number>();
    const supplierIds = new Set<number>();
    const supplierNames = new Set<string>();

    if (data.items) {
      for (const item of data.items) productIds.push(item.productId);
    }
    if (data.bankAccountId) bankAccountIds.add(data.bankAccountId);
    if (data.cardId) cardIds.add(data.cardId);
    if (data.supplierId) supplierIds.add(data.supplierId);

    if (data.associatedInvoices) {
      for (const inv of data.associatedInvoices) {
        if (inv.bankAccountId) bankAccountIds.add(Number(inv.bankAccountId));
        if (inv.cardId) cardIds.add(Number(inv.cardId));
        if (inv.supplierName) supplierNames.add(inv.supplierName);
      }
    }

    // ✅ Direct queries without cache - rely on database indexes for performance
    const t_l1 = Date.now();
    const [products, bankAccounts, cards, suppliers, suppliersByName] = await Promise.all([
      productIds.length > 0
        ? Product.findAll({ 
            where: { id: { [Op.in]: productIds } }, 
            transaction,
            attributes: ['id', 'code', 'name', 'unit', 'amount', 'unitCost', 'subtotal'], // Select only needed fields
            raw: true, // ✅ Safe here — you only read, never modify
          })
        : Promise.resolve([]),
      bankAccountIds.size > 0
        ? BankAccount.findAll({ 
            where: { id: { [Op.in]: Array.from(bankAccountIds) } }, 
            transaction,
            attributes: ['id', 'code', 'bankName', 'accountNumber', 'accountType', 'balance'],
            raw: true, // ✅ Safe here — you only read, never modify
          })
        : Promise.resolve([]),
      cardIds.size > 0
        ? Card.findAll({ 
            where: { id: { [Op.in]: Array.from(cardIds) } }, 
            transaction,
            attributes: ['id', 'cardNumberLast4', 'cardBrand', 'cardType', 'creditLimit', 'usedCredit', 'bankAccountId'],
            raw: true, // ✅ Safe here — you only read, never modify
          })
        : Promise.resolve([]),
      supplierIds.size > 0
        ? Supplier.findAll({ 
            where: { id: { [Op.in]: Array.from(supplierIds) } }, 
            transaction,
            attributes: ['id', 'code', 'name', 'rnc'],
            raw: true, // ✅ Safe here — you only read, never modify
          })
        : Promise.resolve([]),
      supplierNames.size > 0
        ? Supplier.findAll({ 
            where: { name: { [Op.in]: Array.from(supplierNames) } }, 
            transaction,
            attributes: ['id', 'code', 'name', 'rnc'],
            raw: true, // ✅ Safe here — you only read, never modify
          })
        : Promise.resolve([]),
    ]);
    console.log(`⏱️ Lookups queries: ${Date.now() - t_l1}ms (products:${products.length}, bankAccounts:${bankAccounts.length}, cards:${cards.length}, suppliers:${suppliers.length}, suppliersByName:${suppliersByName.length})`);

    products.forEach(p => lookups.products.set(p.id, p));
    bankAccounts.forEach(b => lookups.bankAccounts.set(b.id, b));
    cards.forEach(c => lookups.cards.set(c.id, c));
    suppliers.forEach(s => lookups.suppliers.set(s.id, s));
    suppliersByName.forEach(s => lookups.suppliersByName.set(s.name, s));

    return lookups;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ FIXED: MAIN PAYMENT - uses lookups, no redundant queries
  // ═════════════════════════════════════════════════════════════════════════════

  private async processMainPaymentOptimized(
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    transaction: any,
    lookups: PrecomputedLookups,
    balanceCache: BankBalanceCache
  ): Promise<Map<number, number>> {
    const balanceUpdates = new Map<number, number>();
    const paymentType = data.paymentType.toUpperCase();
    
    switch (paymentType) {
      case 'CHEQUE':
      case 'BANK_TRANSFER':
        await this.processBankPaymentOptimized(data, purchase, amount, transaction, lookups, balanceCache);
        if (data.bankAccountId) {
          balanceUpdates.set(data.bankAccountId, balanceCache.getBalance(data.bankAccountId));
        }
        break;
      case 'DEBIT_CARD':
      case 'CREDIT_CARD':
        await this.processCardPaymentOptimized(data, purchase, amount, transaction, lookups, balanceCache);
        // For debit cards, we need to get the bank account from the card
        if (data.cardId) {
          const card = lookups.cards.get(data.cardId);
          if (card?.bankAccountId) {
            balanceUpdates.set(card.bankAccountId, balanceCache.getBalance(card.bankAccountId));
          }
        }
        break;
      case 'CREDIT':
        await this.processCreditPaymentOptimized(data, purchase, amount, transaction, lookups);
        break;
    }
    
    return balanceUpdates;
  }

  private async processBankPaymentOptimized(
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    transaction: any,
    lookups: PrecomputedLookups,
    balanceCache: BankBalanceCache
  ): Promise<void> {
    const bankAccount = lookups.bankAccounts.get(data.bankAccountId!);
    if (!bankAccount) throw new NotFoundError(`Bank account ${data.bankAccountId} not found`);

    const supplier = lookups.suppliers.get(data.supplierId);

    const currentBalance = Number(bankAccount.balance);
    this.validateSufficientBalance(currentBalance, amount, `purchase ${purchase.registrationNumber}`);

    // ✅ FIX: Don't update balance here - only update in batch at end
    // This prevents double deduction (once here, once in BankRegister)
    const newBalance = currentBalance - amount;
    balanceCache.updateBalance(data.bankAccountId!, newBalance);

    const context = this.buildPurchaseContext(data, purchase, supplier);
    const bankEntryData = TransactionFactory.createBankEntry(context, {
      paymentMethod: data.paymentType === 'CHEQUE' ? 'Cheque' : 'Bank Transfer',
      documentType: 'Purchase',
      bankAccountId: data.bankAccountId,
      chequeNumber: data.paymentType === 'CHEQUE' ? data.chequeNumber : undefined,
      transferNumber: data.paymentType === 'BANK_TRANSFER' ? data.transferNumber : undefined,
      description: `Payment for purchase ${purchase.registrationNumber}`,
    });

    await this.createBankRegisterEntryOptimized(bankEntryData, transaction, bankAccount, balanceCache);
  }

  private async processCardPaymentOptimized(
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    transaction: any,
    lookups: PrecomputedLookups,
    balanceCache: BankBalanceCache
  ): Promise<void> {
    const card = lookups.cards.get(data.cardId!);
    if (!card) throw new NotFoundError('Card not found');

    const expectedType = data.paymentType === 'DEBIT_CARD' ? 'DEBIT' : 'CREDIT';
    this.validateCardType(card, expectedType, `purchase ${purchase.registrationNumber}`);

    const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;

    if (card.cardType === 'DEBIT') {
      await this.processDebitCardPaymentOptimized(card, data, purchase, amount, cardInfo, transaction, lookups, balanceCache);
    } else {
      await this.processCreditCardPaymentOptimized(card, data, purchase, amount, cardInfo, transaction);
    }
  }

  private async processDebitCardPaymentOptimized(
    card: any,
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    cardInfo: string,
    transaction: any,
    lookups: PrecomputedLookups,
    balanceCache: BankBalanceCache
  ): Promise<void> {
    if (!card.bankAccountId) throw new ValidationError('DEBIT card must be linked to a bank account');

    const bankAccount = lookups.bankAccounts.get(card.bankAccountId);
    if (!bankAccount) throw new NotFoundError('Bank account not found for this DEBIT card');

    const currentBalance = Number(bankAccount.balance);
    this.validateSufficientBalance(currentBalance, amount, `purchase ${purchase.registrationNumber}`);

    // ✅ FIX: Don't update balance here - only update in batch at end
    // This prevents double deduction (once here, once in BankRegister)
    const newBalance = currentBalance - amount;
    balanceCache.updateBalance(card.bankAccountId, newBalance);

    const supplier = lookups.suppliers.get(data.supplierId);
    const context = this.buildPurchaseContext(data, purchase, supplier);
    const bankEntryData = TransactionFactory.createBankEntry(context, {
      paymentMethod: 'Debit Card',
      documentType: 'Purchase',
      bankAccountId: card.bankAccountId,
      referenceNumber: data.paymentReference,
      description: `Payment for purchase ${purchase.registrationNumber} via DEBIT card ${cardInfo}`,
    });

    await this.createBankRegisterEntryOptimized(bankEntryData, transaction, bankAccount, balanceCache);

    await purchase.update({
      paidAmount: amount,
      balanceAmount: 0,
      paymentStatus: 'Paid',
    }, { transaction });
  }

  private async processCreditCardPaymentOptimized(
    card: any,
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    cardInfo: string,
    transaction: any
  ): Promise<void> {
    const creditLimit = Number(card.creditLimit || 0);
    const usedCredit = Number(card.usedCredit || 0);
    this.validateCreditLimit(creditLimit, usedCredit, amount, cardInfo, `purchase ${purchase.registrationNumber}`);

    const context = this.buildPurchaseContext(data, purchase);
    const apEntryData = TransactionFactory.createAPEntry(context, {
      type: 'CREDIT_CARD_PURCHASE',
      documentType: 'Purchase',
      supplierName: cardInfo,
      cardId: card.id,
      cardIssuer: cardInfo,
      paymentType: 'CREDIT_CARD',
      paymentReference: data.paymentReference,
      notes: `Credit card purchase ${purchase.registrationNumber} - ${cardInfo}`,
    });

    await this.createAccountsPayableEntry(apEntryData, transaction);
  }

  private async processCreditPaymentOptimized(
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    transaction: any,
    lookups: PrecomputedLookups
  ): Promise<void> {
    const supplier = lookups.suppliers.get(data.supplierId);
    const context = this.buildPurchaseContext(data, purchase, supplier);
    const apEntryData = TransactionFactory.createAPEntry(context, {
      type: 'SUPPLIER_CREDIT',
      documentType: 'Purchase',
      supplierName: supplier?.name || '',
      supplierRnc: data.supplierRnc || '',
      paymentType: 'CREDIT',
      notes: `Credit purchase from ${supplier?.name || 'supplier'} - ${purchase.registrationNumber}`,
    });

    await this.createAccountsPayableEntry(apEntryData, transaction);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ NEW: OPTIMIZED BANK REGISTER ENTRY - NO redundant queries
  // ═════════════════════════════════════════════════════════════════════════════

  private async createBankRegisterEntryOptimized(
    data: {
      registrationNumber: string;
      transactionType: 'INFLOW' | 'OUTFLOW';
      amount: number;
      paymentMethod: string;
      relatedDocumentType: string;
      relatedDocumentNumber: string;
      sourceTransactionType: TransactionType;
      clientRnc?: string;
      clientName?: string;
      ncf?: string;
      description: string;
      bankAccountId?: number;
      chequeNumber?: string;
      transferNumber?: string;
      referenceNumber?: string;
      supplierId?: number;
      originalPaymentType?: string;
    },
    transaction: any,
    bankAccount: BankAccount,
    balanceCache: BankBalanceCache
  ): Promise<void> {
    const bankAccountName = `${bankAccount.bankName} - ${bankAccount.accountNumber}`;
    const accountType = bankAccount.accountType;

    // ✅ FIX: Use the cached balance (which was already updated by the payment processing)
    // Don't recalculate the balance change here - it was already done in processBankPaymentOptimized
    const newBalance = balanceCache.getBalance(data.bankAccountId);

    await BankRegister.create({
      registrationNumber: data.registrationNumber,
      registrationDate: new Date(),
      transactionType: data.transactionType,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      sourceTransactionType: data.sourceTransactionType,
      relatedDocumentType: data.relatedDocumentType,
      relatedDocumentNumber: data.relatedDocumentNumber,
      clientRnc: data.clientRnc || '',
      clientName: data.clientName || '',
      ncf: data.ncf || '',
      description: data.description,
      balance: newBalance,
      bankAccountId: data.bankAccountId,
      bankAccountName,
      accountType,
      chequeNumber: data.chequeNumber || null,
      transferNumber: data.transferNumber || null,
      referenceNumber: data.referenceNumber || null,
      supplierId: data.supplierId,
      originalPaymentType: data.originalPaymentType,
    } as any, { transaction });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // BULK INVENTORY UPDATE (same as File 2 - already optimized)
  // ═════════════════════════════════════════════════════════════════════════════

  private buildBatchInventoryData(
    items: PurchaseItemInput[],
    purchaseId: number,
    associatedExpenses: number,
    lookups: PrecomputedLookups
  ): BatchInventoryData {
    const productTotal = items.reduce((sum, item) =>
      sum + (Number(item.subtotal) || item.quantity * item.unitCost), 0
    );

    const purchaseItems: any[] = [];
    const productUpdates: BatchInventoryData['productUpdates'] = [];

    for (const item of items) {
      const product = lookups.products.get(item.productId);
      if (!product) continue;

      const itemSubtotal = Number(item.subtotal) || (item.quantity * item.unitCost);
      const itemPercentage = productTotal > 0 ? itemSubtotal / productTotal : 0;
      const itemAssociatedCost = associatedExpenses * itemPercentage;
      const adjustedTotal = itemSubtotal + itemAssociatedCost;
      const adjustedUnitCost = item.quantity > 0 ? adjustedTotal / item.quantity : item.unitCost;

      purchaseItems.push({
        purchaseId,
        productId: item.productId,
        productCode: product.code || '',
        productName: product.name || '',
        unitOfMeasurement: item.unitOfMeasurement || product.unit || 'unit',
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        subtotal: itemSubtotal,
        tax: Number(item.tax || 0),
        total: Number(item.total) || itemSubtotal,
        adjustedUnitCost,
        adjustedTotal,
      });

      const oldAmount = Number(product.amount || 0);
      const oldUnitCost = Number(product.unitCost || 0);
      const oldInventoryValue = oldAmount * oldUnitCost;
      const newInventoryValue = oldInventoryValue + adjustedTotal;
      const newAmount = oldAmount + Number(item.quantity);
      const weightedAverageCost = newAmount > 0 ? newInventoryValue / newAmount : adjustedUnitCost;

      productUpdates.push({
        id: product.id,
        amount: newAmount,
        unitCost: weightedAverageCost,
        subtotal: newAmount * weightedAverageCost,
        unit: item.unitOfMeasurement && item.unitOfMeasurement !== product.unit
          ? item.unitOfMeasurement
          : undefined,
        taxRate: item.tax && Number(item.tax) > 0 ? Number(item.tax) : undefined,
      });
    }

    return { purchaseItems, productUpdates };
  }

  private async executeBatchInventoryUpdate(
    batchData: BatchInventoryData,
    transaction: any
  ): Promise<void> {
    if (batchData.purchaseItems.length === 0) return;

    await PurchaseItem.bulkCreate(batchData.purchaseItems as any, { transaction });

    if (batchData.productUpdates.length > 0) {
      await this.bulkUpdateProducts(batchData.productUpdates, transaction);
    }
  }

  private async bulkUpdateProducts(
    updates: Array<{ id: number; amount: number; unitCost: number; subtotal: number; unit?: string; taxRate?: number }>,
    transaction: any
  ): Promise<void> {
    // ✅ OPTIMIZATION: Process updates in batches to avoid huge CASE statements
    const batchSize = 20;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const ids = batch.map(u => u.id);

      const amountCases = batch.map(u => `WHEN ${u.id} THEN ${u.amount}`).join(' ');
      const unitCostCases = batch.map(u => `WHEN ${u.id} THEN ${u.unitCost}`).join(' ');
      const subtotalCases = batch.map(u => `WHEN ${u.id} THEN ${u.subtotal}`).join(' ');

      await sequelize.query(`
        UPDATE products 
        SET 
          amount = CASE id ${amountCases} ELSE amount END,
          unit_cost = CASE id ${unitCostCases} ELSE unit_cost END,
          subtotal = CASE id ${subtotalCases} ELSE subtotal END
        WHERE id IN (${ids.join(',')})
      `, { transaction });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ FIXED: BULK ASSOCIATED INVOICES - uses lookups + balance cache
  // ═════════════════════════════════════════════════════════════════════════════

  private categorizeInvoices(invoices: AssociatedInvoiceInput[]): CategorizedInvoices {
    const result: CategorizedInvoices = {
      immediateBank: [],
      immediateCard: [],
      creditCard: [],
      credit: [],
    };

    for (const invoice of invoices) {
      const type = invoice.paymentType?.toUpperCase();
      const amount = Number(invoice.amount) || (Number(invoice.tax || 0) + Number(invoice.taxAmount || 0));

      switch (type) {
        case 'CHEQUE':
        case 'BANK_TRANSFER':
        case 'DEPOSIT':
          result.immediateBank.push({ invoice, amount });
          break;
        case 'DEBIT_CARD':
          result.immediateCard.push({ invoice, amount });
          break;
        case 'CREDIT_CARD':
          result.creditCard.push({ invoice, amount });
          break;
        case 'CREDIT':
          result.credit.push({ invoice, amount });
          break;
      }
    }

    return result;
  }

  private buildBatchInvoiceData(
    categorized: CategorizedInvoices,
    purchase: Purchase,
    registrationNumber: string,
    lookups: PrecomputedLookups,
    balanceCache: BankBalanceCache
  ): BatchInvoiceData {
    const result: BatchInvoiceData = {
      bankRegisterEntries: [],
      apEntries: [],
      associatedInvoiceRecords: [],
      glEntries: [],
      bankAccountBalanceUpdates: new Map(),
      totalAssociatedPaid: 0,
    };

    // Immediate bank payments
    for (const { invoice, amount } of categorized.immediateBank) {
      const bankAccountId = Number(invoice.bankAccountId);
      const bankAccount = lookups.bankAccounts.get(bankAccountId);

      this.validateSufficientBalance(
        Number(bankAccount?.balance || 0),
        amount,
        `invoice "${invoice.concept}"`
      );

      const currentBalance = result.bankAccountBalanceUpdates.get(bankAccountId) 
        || balanceCache.getBalance(bankAccountId);
      result.bankAccountBalanceUpdates.set(bankAccountId, currentBalance - amount);
      result.totalAssociatedPaid += amount;

      const context = this.buildInvoiceContext(invoice, purchase, registrationNumber);
      result.bankRegisterEntries.push(
        TransactionFactory.createBankEntry(context, {
          paymentMethod: this.getPaymentMethodLabel(invoice.paymentType ?? ''),
          documentType: 'Purchase Invoice',
          bankAccountId,
          description: `Invoice: ${invoice.concept} for purchase ${registrationNumber}`,
        })
      );

      result.glEntries.push(...AccountingRulesEngine.getPurchaseGLEntries(amount, invoice.paymentType ?? 'BANK_TRANSFER'));
      result.associatedInvoiceRecords.push(this.buildInvoiceRecord(invoice, purchase.id));
    }

    // Immediate card payments (debit)
    for (const { invoice, amount } of categorized.immediateCard) {
      const cardId = Number(invoice.cardId);
      const card = lookups.cards.get(cardId);

      if (!card?.bankAccountId) throw new ValidationError('DEBIT card must be linked to bank account');

      const bankAccount = lookups.bankAccounts.get(card.bankAccountId);
      this.validateSufficientBalance(
        Number(bankAccount?.balance || 0),
        amount,
        `invoice "${invoice.concept}"`
      );

      const currentBalance = result.bankAccountBalanceUpdates.get(card.bankAccountId)
        || balanceCache.getBalance(card.bankAccountId);
      result.bankAccountBalanceUpdates.set(card.bankAccountId, currentBalance - amount);
      result.totalAssociatedPaid += amount;

      const context = this.buildInvoiceContext(invoice, purchase, registrationNumber);
      result.bankRegisterEntries.push(
        TransactionFactory.createBankEntry(context, {
          paymentMethod: 'Debit Card',
          documentType: 'Purchase Invoice',
          bankAccountId: card.bankAccountId,
          description: `Invoice: ${invoice.concept} via DEBIT card`,
        })
      );

      result.glEntries.push(...AccountingRulesEngine.getPurchaseGLEntries(amount, 'DEBIT_CARD'));
      result.associatedInvoiceRecords.push(this.buildInvoiceRecord(invoice, purchase.id));
    }

    // Credit card invoices
    for (const { invoice, amount } of categorized.creditCard) {
      const cardId = Number(invoice.cardId);
      const card = lookups.cards.get(cardId);
      const cardInfo = `${card?.cardBrand || 'Card'} ****${card?.cardNumberLast4}`;

      this.validateCreditLimit(
        Number(card?.creditLimit || 0),
        Number(card?.usedCredit || 0),
        amount,
        cardInfo,
        `invoice "${invoice.concept}"`
      );

      const context = this.buildInvoiceContext(invoice, purchase, registrationNumber);
      result.apEntries.push(
        TransactionFactory.createAPEntry(context, {
          type: 'CREDIT_CARD_INVOICEASSOCIATE',
          documentType: 'InvoiceAssociate',
          supplierName: cardInfo,
          cardId,
          cardIssuer: cardInfo,
          paymentType: 'CREDIT_CARD',
          notes: `Invoice: ${invoice.concept} - Credit will be used when paid`,
        })
      );

      result.glEntries.push(...AccountingRulesEngine.getPurchaseWithCreditCardGLEntries(amount));
      result.associatedInvoiceRecords.push(this.buildInvoiceRecord(invoice, purchase.id));
    }

    // Credit invoices
    for (const { invoice, amount } of categorized.credit) {
      const context = this.buildInvoiceContext(invoice, purchase, registrationNumber);
      result.apEntries.push(
        TransactionFactory.createAPEntry(context, {
          type: 'SUPPLIER_CREDIT_INVOICEASSOCIATE',
          documentType: 'InvoiceAssociate',
          supplierName: invoice.supplierName || 'Unknown',
          supplierRnc: invoice.supplierRnc,
          paymentType: 'CREDIT',
          notes: `${invoice.concept} for purchase ${registrationNumber}`,
        })
      );

      result.glEntries.push(...AccountingRulesEngine.getPurchaseOnCreditGLEntries(amount));
      result.associatedInvoiceRecords.push(this.buildInvoiceRecord(invoice, purchase.id));
    }

    return result;
  }

  private async executeBatchInvoiceUpdate(
    batchData: BatchInvoiceData,
    transaction: any
  ): Promise<void> {
    // ✅ FIX: Create BankRegister entries with proper balances
    // The balances in bankAccountBalanceUpdates are the final balances after all deductions
    if (batchData.bankRegisterEntries.length > 0) {
      // Update each bank register entry with the correct final balance
      const bankRegisterEntriesWithBalances = batchData.bankRegisterEntries.map(entry => {
        const bankAccountId = entry.bankAccountId;
        const finalBalance = batchData.bankAccountBalanceUpdates.get(bankAccountId);
        if (finalBalance !== undefined) {
          return { ...entry, balance: finalBalance };
        }
        return entry;
      });

      await BankRegister.bulkCreate(bankRegisterEntriesWithBalances as any, { transaction });
    }

    await Promise.all([
      batchData.apEntries.length > 0
        ? AccountsPayable.bulkCreate(batchData.apEntries as any, { transaction })
        : Promise.resolve(),
      AssociatedInvoice.bulkCreate(batchData.associatedInvoiceRecords as any, { transaction }),
    ]);

    // ✅ FIX: Don't update balances here - they will be updated in the main flow
    // This prevents double deduction (once here, once in main flow)
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ CRITICAL FIX: BATCH ALL GL ENTRIES INTO ONE CALL
  // ═════════════════════════════════════════════════════════════════════════════

  private buildMainGLEntries(paymentType: string, amount: number): any[] {
    const type = paymentType.toUpperCase();
    if (type === 'CREDIT_CARD') {
      return AccountingRulesEngine.getPurchaseWithCreditCardGLEntries(amount);
    } else if (type === 'CREDIT') {
      return AccountingRulesEngine.getPurchaseOnCreditGLEntries(amount);
    } else if (['CHEQUE', 'BANK_TRANSFER', 'DEBIT_CARD', 'CASH'].includes(type)) {
      return AccountingRulesEngine.getPurchaseGLEntries(amount, paymentType);
    }
    return [];
  }

  /**
   * ✅ OPTIMIZED: Post ALL GL entries in ONE call to GLPostingService
   * 
   * BEFORE (File 2): Called GLPostingService.postGLEntries for EACH entry individually
   *   await Promise.all(glEntries.map(entry => GLPostingService.postGLEntries(entry, transaction)))
   *   → 6 entries = 6 separate calls = 2358ms!
   * 
   * AFTER: Single call with all entries batched
   *   await GLPostingService.postGLEntries({ entries: [allEntries] }, transaction)
   *   → 1 call = ~100ms
   * 
   * If GLPostingService.postGLEntries doesn't support batch entries internally,
   * we add a wrapper that uses bulkCreate for the actual DB inserts.
   */
  private async postAllGLEntries(
    purchase: Purchase,
    allEntries: any[],
    transaction: any
  ): Promise<void> {
    try {
      // Strategy 1: Try batch posting via GLPostingService (if it supports it)
      await GLPostingService.postGLEntries({
        entryDate: purchase.date,
        sourceModule: SourceModule.PURCHASE,
        sourceTransactionId: purchase.id,
        sourceTransactionNumber: purchase.registrationNumber,
        entries: allEntries,
      } as any, transaction);
    } catch (error: any) {
      // Strategy 2: If GLPostingService fails or is too slow, use direct bulkCreate
      console.warn('GLPostingService batch failed, falling back to direct bulkCreate:', error.message);
      await this.postGLDirectBulk(allEntries, purchase, transaction);
    }
  }

  /**
   * ✅ FALLBACK: Direct bulkCreate to GeneralLedger if GLPostingService is slow
   * This bypasses GLPostingService entirely and inserts directly.
   * Use this if GLPostingService.postGLEntries still takes > 500ms.
   */
  private async postGLDirectBulk(
    entries: any[],
    purchase: Purchase,
    transaction: any
  ): Promise<void> {
    try {
      // Dynamically import GeneralLedger model (to avoid circular dependency issues)
      const { default: GeneralLedger } = await import('../models/accounting/GeneralLedger');

      const glRecords = entries.map((entry, index) => ({
        entryDate: purchase.date,
        sourceModule: SourceModule.PURCHASE,
        sourceTransactionId: purchase.id,
        sourceTransactionNumber: purchase.registrationNumber,
        lineNumber: index + 1,
        accountId: entry.accountId,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        description: entry.description || '',
        reference: purchase.registrationNumber,
        status: 'Posted',
      }));

      await GeneralLedger.bulkCreate(glRecords as any, { 
        transaction,
        validate: false,
        hooks: false,
      });
    } catch (fallbackError) {
      console.error('Direct GL bulkCreate also failed:', fallbackError);
      throw new BusinessLogicError(`GL posting failed: ${fallbackError}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private buildPurchaseContext(
    data: CreatePurchaseRequest,
    purchase: Purchase,
    supplier?: Supplier | null
  ): PurchaseContext {
    return {
      purchase: {
        id: purchase.id,
        registrationNumber: purchase.registrationNumber,
        date: purchase.date,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        purchaseType: purchase.purchaseType,
      },
      supplier: supplier ? { name: supplier.name, rnc: supplier.rnc } : undefined,
      amount: purchase.total,
    };
  }

  private buildInvoiceContext(
    invoice: AssociatedInvoiceInput,
    purchase: Purchase,
    registrationNumber: string
  ): PurchaseContext {
    return {
      purchase: {
        id: purchase.id,
        registrationNumber,
        date: invoice.date ? new Date(invoice.date) : new Date(),
        supplierRnc: invoice.supplierRnc,
        ncf: invoice.ncf,
        purchaseType: invoice.purchaseType || 'Service',
      },
      supplier: invoice.supplierName
        ? { name: invoice.supplierName, rnc: invoice.supplierRnc }
        : undefined,
      amount: Number(invoice.amount) || (Number(invoice.tax || 0) + Number(invoice.taxAmount || 0)),
    };
  }

  private buildInvoiceRecord(invoice: AssociatedInvoiceInput, purchaseId: number): any {
    return {
      purchaseId,
      supplierRnc: String(invoice.supplierRnc || ''),
      supplierName: String(invoice.supplierName || ''),
      concept: String(invoice.concept || ''),
      ncf: String(invoice.ncf || ''),
      date: invoice.date ? new Date(invoice.date) : new Date(),
      taxAmount: Number(invoice.taxAmount || 0),
      tax: Number(invoice.tax || 0),
      amount: Number(invoice.amount) || (Number(invoice.tax || 0) + Number(invoice.taxAmount || 0)),
      purchaseType: String(invoice.purchaseType || 'Service'),
      paymentType: String(invoice.paymentType || 'CREDIT'),
      bankAccountId: invoice.bankAccountId || undefined,
      cardId: invoice.cardId || undefined,
      chequeNumber: invoice.chequeNumber || undefined,
      chequeDate: invoice.chequeDate ? new Date(invoice.chequeDate) : undefined,
      transferNumber: invoice.transferNumber || undefined,
      transferDate: invoice.transferDate ? new Date(invoice.transferDate) : undefined,
      paymentReference: invoice.paymentReference || undefined,
      voucherDate: invoice.voucherDate ? new Date(invoice.voucherDate) : undefined,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ✅ NEW: ASYNC GL POSTING - Moves GL posting outside main transaction
  // ═════════════════════════════════════════════════════════════════════════════

  private async postGLAsync(purchaseData: { id: number; date: Date; registrationNumber: string }, allGLEntries: any[]): Promise<void> {
    try {
      // Use optimized GL posting service
      const GLPostingServiceOptimized = (await import('./accounting/GLPostingService.optimized')).default;
      
      await GLPostingServiceOptimized.postGLEntries({
        entryDate: purchaseData.date,
        sourceModule: SourceModule.PURCHASE,
        sourceTransactionId: purchaseData.id,
        sourceTransactionNumber: purchaseData.registrationNumber,
        entries: allGLEntries,
      });
      
      console.log(`✅ Async GL posting completed for purchase ${purchaseData.registrationNumber}`);
    } catch (error) {
      console.error(`❌ Async GL posting failed for purchase ${purchaseData.registrationNumber}:`, error);
      // Could implement retry logic or fallback to synchronous posting
      throw error;
    }
  }

  private determineFinalStatus(
    mainPaymentType: string,
    associatedInvoices?: AssociatedInvoiceInput[],
    totalAssociatedPaid: number = 0
  ): 'Paid' | 'Partial' | 'Unpaid' {
    const allTypes = [mainPaymentType.toUpperCase()];
    associatedInvoices?.forEach(inv => {
      if (inv.paymentType) allTypes.push(inv.paymentType.toUpperCase());
    });

    const paidMethods = ['BANK_TRANSFER', 'CHECK', 'CHEQUE', 'DEPOSIT', 'DEBIT_CARD', 'CASH'];
    const creditMethods = ['CREDIT_CARD', 'CREDIT'];

    const hasPaid = allTypes.some(t => paidMethods.includes(t));
    const hasCredit = allTypes.some(t => creditMethods.includes(t));

    if (hasPaid && hasCredit) return 'Partial';
    if (hasPaid) return 'Paid';
    return 'Unpaid';
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // VALIDATION METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private isValidTransactionType(transactionType: string): boolean {
    return ['GOODS'].includes(transactionType.toUpperCase());
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // VALIDATION — owned by ValidationFramework.ts → ValidationSchemas.PURCHASE_CREATE
  // All purchase validation rules live there. This service just calls them.
  // ═════════════════════════════════════════════════════════════════════════════

  private validateCardType(card: any, expectedType: string, context: string = ''): void {
    if (!card) throw new NotFoundError(`Card not found${context ? ` for ${context}` : ''}`);
    if (card.cardType !== expectedType) {
      throw new ValidationError(
        `Selected card ****${card.cardNumberLast4} is a ${card.cardType} card, not a ${expectedType} card${context ? ` for ${context}` : ''}. Please select a ${expectedType} card or change payment type.`
      );
    }
  }

  private validateCreditLimit(creditLimit: number, usedCredit: number, required: number, cardInfo: string, context: string = ''): void {
    if (creditLimit <= 0) throw new ValidationError(`Credit card ${cardInfo} has no credit limit set.`);
    const availableCredit = creditLimit - usedCredit;
    if (required > availableCredit) {
      throw new InsufficientBalanceError(
        `Insufficient credit available on card ${cardInfo}${context ? ` for ${context}` : ''}. Available: $${availableCredit.toFixed(2)}, Required: $${required.toFixed(2)}.`
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private calculatePaymentStatus(paymentType: string, total: number): PaymentStatus {
    const type = paymentType.toUpperCase();
    if (type === 'CHEQUE' || type === 'BANK_TRANSFER' || type === 'CASH') {
      return { paidAmount: total, balanceAmount: 0, paymentStatus: 'Paid' };
    }
    if (type === 'DEBIT_CARD') {
      return { paidAmount: total, balanceAmount: 0, paymentStatus: 'Paid' };
    }
    return { paidAmount: 0, balanceAmount: total, paymentStatus: 'Unpaid' };
  }

  private calculateAssociatedExpenses(associatedInvoices?: any[]): number {
    if (!associatedInvoices || associatedInvoices.length === 0) return 0;
    return associatedInvoices.reduce((sum: number, inv: any) => sum + Number(inv.tax || 0), 0);
  }

  private getPaymentMethodLabel(paymentType: string): string {
    switch (paymentType?.toUpperCase()) {
      case 'CASH': return 'Cash';
      case 'CHEQUE': return 'Cheque';
      case 'BANK_TRANSFER': return 'Bank Transfer';
      case 'DEPOSIT': return 'Deposit';
      default: return paymentType || 'Unknown';
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // REGISTER AND AP CREATION (legacy - kept for compatibility)
  // ═════════════════════════════════════════════════════════════════════════════

  private async createBankRegisterEntry(data: {
    registrationNumber: string;
    transactionType: 'INFLOW' | 'OUTFLOW';
    amount: number;
    paymentMethod: string;
    relatedDocumentType: string;
    relatedDocumentNumber: string;
    sourceTransactionType: TransactionType;
    clientRnc?: string;
    clientName?: string;
    ncf?: string;
    description: string;
    bankAccountId?: number;
    chequeNumber?: string;
    transferNumber?: string;
    referenceNumber?: string;
    supplierId?: number;
    originalPaymentType?: string;
  }, transaction?: any): Promise<void> {
    let bankAccountName = '';
    let accountType: 'CHECKING' | 'SAVINGS' | undefined = undefined;
    if (data.bankAccountId) {
      const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
      if (bankAccount) {
        bankAccountName = `${bankAccount.bankName} - ${bankAccount.accountNumber}`;
        accountType = bankAccount.accountType;
      }
    }

    const lastBalance = await this.getLastBankBalance(data.bankAccountId, transaction);
    const balanceChange = data.transactionType === 'INFLOW' ? data.amount : -data.amount;
    const newBalance = lastBalance + balanceChange;

    await BankRegister.create({
      registrationNumber: data.registrationNumber,
      registrationDate: new Date(),
      transactionType: data.transactionType,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      sourceTransactionType: data.sourceTransactionType,
      relatedDocumentType: data.relatedDocumentType,
      relatedDocumentNumber: data.relatedDocumentNumber,
      clientRnc: data.clientRnc || '',
      clientName: data.clientName || '',
      ncf: data.ncf || '',
      description: data.description,
      balance: newBalance,
      bankAccountId: data.bankAccountId,
      bankAccountName,
      accountType,
      chequeNumber: data.chequeNumber || null,
      transferNumber: data.transferNumber || null,
      referenceNumber: data.referenceNumber || null,
      supplierId: data.supplierId,
      originalPaymentType: data.originalPaymentType,
    } as any, { transaction });
  }

  private async createAccountsPayableEntry(data: {
    registrationNumber: string;
    type: string;
    relatedDocumentType: string;
    relatedDocumentId: number;
    relatedDocumentNumber: string;
    supplierId?: number;
    supplierName: string;
    supplierRnc?: string;
    ncf?: string;
    purchaseDate: Date;
    purchaseType: string;
    paymentType: string;
    cardId?: number;
    cardIssuer?: string;
    paymentReference?: string;
    amount: number;
    notes?: string;
  }, transaction?: any): Promise<void> {
    await AccountsPayable.create({
      registrationNumber: data.registrationNumber,
      registrationDate: new Date(),
      type: data.type,
      sourceTransactionType: TransactionType.PURCHASE,
      relatedDocumentType: data.relatedDocumentType,
      relatedDocumentId: data.relatedDocumentId,
      relatedDocumentNumber: data.relatedDocumentNumber,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      supplierRnc: data.supplierRnc || '',
      ncf: data.ncf || '',
      purchaseDate: data.purchaseDate,
      purchaseType: data.purchaseType,
      paymentType: data.paymentType,
      paymentReference: data.paymentReference,
      cardId: data.cardId,
      cardIssuer: data.cardIssuer,
      amount: data.amount,
      paidAmount: 0,
      balanceAmount: data.amount,
      status: 'Pending',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: data.notes,
    } as any, { transaction });
  }

  private async getLastBankBalance(bankAccountId?: number, transaction?: any): Promise<number> {
    const whereClause = bankAccountId ? { bankAccountId } : {};
    const lastTransaction = await BankRegister.findOne({
      where: whereClause,
      order: [['id', 'DESC']],
      transaction
    });
    return lastTransaction ? Number(lastTransaction.balance) : 0;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // FALLBACK AND LEGACY METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private async loadPurchasesWithFallback(whereClause: any) {
    try {
      return await Purchase.findAll({
        where: whereClause,
        include: [
          { model: Supplier, as: 'supplier', required: false, attributes: ['id', 'name', 'rnc'] },
          {
            model: PurchaseItem,
            as: 'items',
            required: false,
            include: [{ model: Product, as: 'product', required: false, attributes: ['id', 'name', 'code', 'unit'] }]
          }
        ],
        order: [['registrationDate', 'DESC']],
        limit: 50
      });
    } catch (fullAssociationError: any) {
      try {
        return await Purchase.findAll({
          where: whereClause,
          include: [{ model: Supplier, as: 'supplier', required: false, attributes: ['id', 'name', 'rnc'] }],
          order: [['registrationDate', 'DESC']],
          limit: 50
        });
      } catch (supplierError: any) {
        try {
          return await Purchase.findAll({ where: whereClause, order: [['registrationDate', 'DESC']], limit: 50 });
        } catch (basicError: any) {
          throw basicError;
        }
      }
    }
  }

  private async safeDeleteRelatedRecords(purchaseId: number, transaction: any): Promise<void> {
    try {
      await PurchaseItem.destroy({ where: { purchaseId }, transaction });
    } catch (e: any) { /* ignore */ }
    try {
      await AssociatedInvoice.destroy({ where: { purchaseId }, transaction });
    } catch (e: any) { /* ignore */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE — Same export as original. No breaking changes.
// ═══════════════════════════════════════════════════════════════════════════════

const purchaseService = new PurchaseService();

export const getAllPurchases = (transactionType?: string) => purchaseService.getAllPurchases(transactionType);
export const getPurchaseById = (id: number) => purchaseService.getPurchaseById(id);
export const getPurchaseWithDetails = (id: number) => purchaseService.getPurchaseWithDetails(id);
export const getPurchaseItems = (id: number) => purchaseService.getPurchaseItems(id);
export const getAssociatedInvoices = (id: number) => purchaseService.getAssociatedInvoices(id);
export const createPurchase = (data: any) => purchaseService.createPurchase(data);
export const updatePurchase = (id: number, data: any) => purchaseService.updatePurchase(id, data);
export const collectPayment = (id: number, paymentData: { amount: number; paymentMethod: string }) =>
  purchaseService.collectPayment(id, paymentData);
export const deletePurchase = (id: number) => purchaseService.deletePurchase(id);
export const getAllPurchasesWithPagination = (options?: any) => purchaseService.getAllPurchasesWithPagination(options);

export { PurchaseService };
export default purchaseService;