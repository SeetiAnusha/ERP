// Simple Payment Processor - Senior Developer Approach
import { TransactionFactory, PurchaseContext, BankEntryOptions, APEntryOptions } from './TransactionFactory';

/**
 * Simple helper class to process payments without duplication
 * Focuses on solving the immediate problem, not creating a framework
 */
export class PaymentProcessor {
  constructor(
    private context: PurchaseContext,
    private transaction: any,
    private createBankEntry: (data: any, transaction: any) => Promise<void>,
    private createAPEntry: (data: any, transaction: any) => Promise<void>
  ) {}

  /**
   * Process bank payment (Bank Transfer, Cheque, Debit Card)
   */
  async processBankPayment(options: BankEntryOptions): Promise<void> {
    const entryData = TransactionFactory.createBankEntry(this.context, options);
    await this.createBankEntry(entryData, this.transaction);
  }

  /**
   * Process accounts payable entry (Credit Card, Supplier Credit)
   */
  async processAPPayment(options: APEntryOptions): Promise<void> {
    const entryData = TransactionFactory.createAPEntry(this.context, options);
    await this.createAPEntry(entryData, this.transaction);
  }

  /**
   * Process both bank and AP entries (for credit card payments)
   */
  async processCombinedPayment(
    bankOptions: BankEntryOptions, 
    apOptions: APEntryOptions
  ): Promise<void> {
    await this.processBankPayment(bankOptions);
    await this.processAPPayment(apOptions);
  }
}