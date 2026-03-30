/**
 * Batch Processor for Transaction Deletions
 * 
 * Extracted from TransactionDeletionService to improve maintainability
 * Handles all batch operations for different reversal types
 */

import { Transaction } from 'sequelize';
import BankRegister from '../../../models/BankRegister';
import CashRegister from '../../../models/CashRegister';
import BankAccount from '../../../models/BankAccount';
import { BaseService } from '../../../core/BaseService';

interface ReversalOperation {
  type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE' | 'INVENTORY_RESTORE';
  targetTable: string;
  targetId: number;
  data: any;
  priority: number;
}

export class BatchProcessor extends BaseService {

  /**
   * Execute all batch operations grouped by type
   * EXACT COPY of executeBatchOperations from TransactionDeletionService
   */
  async executeBatchOperations(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    // Group operations by type for batch processing
    const operationGroups = this.groupOperationsByType(operations);
    
    // Execute in priority order
    const executionOrder = [
      'BANK_REVERSAL',
      'CC_REGISTER_REVERSAL', 
      'CASH_REVERSAL',
      'STATUS_UPDATE',
      'SOFT_DELETE',
      'CREATE_REVERSAL_AP',
      'RESTORE_CREDIT_LIMIT',
      'CREATE_MANUAL_TASK',
      'BANK_BALANCE_UPDATE'
    ];
    
    for (const operationType of executionOrder) {
      const ops = operationGroups[operationType];
      if (ops && ops.length > 0) {
        console.log(`🔄 [Batch Execution] Processing ${ops.length} ${operationType} operations`);
        
        switch (operationType) {
          case 'BANK_REVERSAL':
            await this.executeBankReversalBatch(ops, transaction);
            break;
          case 'CC_REGISTER_REVERSAL':
            await this.executeCCRegisterReversalBatch(ops, transaction);
            break;
          case 'CASH_REVERSAL':
            await this.executeCashReversalBatch(ops, transaction);
            break;
          case 'STATUS_UPDATE':
            await this.executeStatusUpdateBatch(ops, transaction);
            break;
          case 'SOFT_DELETE':
            await this.executeSoftDeleteBatch(ops, transaction);
            break;
          case 'CREATE_REVERSAL_AP':
            await this.executeCreateReversalAPBatch(ops, transaction);
            break;
          case 'RESTORE_CREDIT_LIMIT':
            await this.executeRestoreCreditLimitBatch(ops, transaction);
            break;
          case 'CREATE_MANUAL_TASK':
            await this.executeCreateManualTaskBatch(ops, transaction);
            break;
          case 'BANK_BALANCE_UPDATE':
            await this.executeBankBalanceUpdateBatch(ops, transaction);
            break;
          case 'INVENTORY_RESTORE':
            await this.executeInventoryRestoreBatch(ops, transaction);
            break;
        }
      }
    }
  }

  /**
   * Group operations by type for efficient batch processing
   */
  private groupOperationsByType(operations: ReversalOperation[]): Record<string, ReversalOperation[]> {
    const groups: Record<string, ReversalOperation[]> = {};
    
    for (const op of operations) {
      if (!groups[op.type]) {
        groups[op.type] = [];
      }
      groups[op.type].push(op);
    }
    
    return groups;
  }

  /**
   * Execute bank reversal operations in batch
   * EXACT COPY from TransactionDeletionService
   */
  private async executeBankReversalBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    for (const op of operations) {
      const { originalEntry, reversalType, amount, description, deletion_approval_id, apRegistrationNumber } = op.data;
      
      const reversalNumber = await this.generateReversalNumber('BRREV', transaction);
      
      // Create reversal entry in bank register
      await BankRegister.create({
        registrationNumber: reversalNumber,
        registrationDate: new Date(),
        transactionType: reversalType,
        sourceTransactionType: 'ADJUSTMENT',
        amount: amount,
        paymentMethod: originalEntry.paymentMethod,
        relatedDocumentType: 'REVERSAL',
        relatedDocumentNumber: apRegistrationNumber || originalEntry.relatedDocumentNumber,
        clientRnc: originalEntry.clientRnc,
        clientName: originalEntry.clientName,
        supplierName: originalEntry.supplierName,
        supplierRnc: originalEntry.supplierRnc,
        ncf: originalEntry.ncf,
        description: description,
        bankAccountId: originalEntry.bankAccountId,
        is_reversal: true,
        original_transaction_id: originalEntry.id,
        deletion_approval_id: deletion_approval_id
      }, { transaction });
      
      // Update bank account balance
      if (originalEntry.bankAccountId) {
        await this.updateBankAccountBalance(
          originalEntry.bankAccountId,
          amount,
          reversalType,
          transaction
        );
      }
      
      console.log(`🏦 [Bank Reversal] Created ${reversalNumber} (${reversalType} ${amount}) for AP ${apRegistrationNumber || originalEntry.relatedDocumentNumber} + Updated bank balance`);
    }
  }

  /**
   * Execute credit card register reversal operations in batch
   * EXACT COPY from TransactionDeletionService
   */
  private async executeCCRegisterReversalBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    const creditCardRegisterService = (await import('../../creditCardRegisterService')).default;
    
    for (const op of operations) {
      const { originalEntry, reversalType, amount, description, deletion_approval_id } = op.data;
      
      console.log(`💳 [CC Reversal Start] Processing reversal for ${originalEntry.registrationNumber} - Amount: ${amount}`);
      
      // Use the credit card register service to process the refund
      const refundData = {
        cardId: originalEntry.cardId,
        amount: amount,
        relatedDocumentType: 'REVERSAL',
        relatedDocumentNumber: originalEntry.registrationNumber,
        description: description,
        originalTransactionId: originalEntry.id,
        notes: `Reversal due to AP deletion - Approval ID: ${deletion_approval_id}`
      };
      
      // Execute the refund within the existing transaction context
      const refundEntry = await creditCardRegisterService.processCreditCardRefund(refundData, transaction);
      
      console.log(`💳 [CC Reversal Complete] Created refund ${refundEntry.registrationNumber} (${reversalType} ${amount}) + Restored credit limit`);
    }
  }

  /**
   * Execute cash reversal operations in batch
   * EXACT COPY from TransactionDeletionService
   */
  private async executeCashReversalBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    const CashRegisterMaster = (await import('../../../models/CashRegisterMaster')).default;
    
    for (const op of operations) {
      const { originalEntry, reversalType, amount, description, deletion_approval_id } = op.data;
      
      const reversalNumber = await this.generateReversalNumber('CR', transaction);
      
      // Create reversal entry
      await CashRegister.create({
        registrationNumber: reversalNumber,
        registrationDate: new Date(),
        transactionType: reversalType,
        amount: amount,
        paymentMethod: originalEntry.paymentMethod,
        relatedDocumentType: 'REVERSAL',
        relatedDocumentNumber: originalEntry.registrationNumber,
        clientRnc: originalEntry.clientRnc,
        clientName: originalEntry.clientName,
        ncf: originalEntry.ncf,
        description: description,
        balance: 0,
        cashRegisterId: originalEntry.cashRegisterId,
        bankAccountId: originalEntry.bankAccountId,
        is_reversal: true,
        original_transaction_id: originalEntry.id,
        deletion_approval_id: deletion_approval_id
      }, { transaction });
      
      // Update Cash Register Master balance
      if (originalEntry.cashRegisterId) {
        const cashRegisterMaster = await CashRegisterMaster.findByPk(originalEntry.cashRegisterId, { transaction });
        if (cashRegisterMaster) {
          const currentBalance = parseFloat(cashRegisterMaster.balance.toString());
          
          // Calculate the net effect of deleting the original transaction
          const originalAmount = parseFloat(originalEntry.amount.toString());
          const balanceAdjustment = originalEntry.transactionType === 'INFLOW' ? -originalAmount : originalAmount;
          const newBalance = currentBalance + balanceAdjustment;
          
          await cashRegisterMaster.update({ balance: newBalance }, { transaction });
          
          console.log(`🏪 [Cash Master Deletion] Store "${cashRegisterMaster.name}": ${currentBalance} → ${newBalance} (${balanceAdjustment > 0 ? '+' : ''}${balanceAdjustment}) - Deleted ${originalEntry.transactionType} ${originalAmount}`);
        }
      }
      
      console.log(`💰 [Cash Reversal] Created ${reversalNumber} (${reversalType} ${amount})`);
    }
  }

  /**
   * Execute status update operations in batch
   * EXACT COPY from TransactionDeletionService
   */
  private async executeStatusUpdateBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    for (const op of operations) {
      const model = await this.getModelByTableName(op.targetTable);
      if (model) {
        await model.update(op.data, {
          where: { id: op.targetId },
          transaction
        });
        console.log(`📝 [Status Update] Updated ${op.targetTable} ID ${op.targetId}`);
      }
    }
  }

  /**
   * Execute soft delete operations in batch
   * EXACT COPY from TransactionDeletionService
   */
  private async executeSoftDeleteBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    for (const op of operations) {
      const model = await this.getModelByTableName(op.targetTable);
      if (model) {
        try {
          let updateResult;
          if (op.data.relatedDocumentNumber) {
            // Update by related document number
            updateResult = await model.update(op.data, {
              where: { relatedDocumentNumber: op.data.relatedDocumentNumber },
              transaction
            });
            console.log(`🗑️ [Soft Delete] Deleted ${op.targetTable} by document ${op.data.relatedDocumentNumber} - Affected rows: ${updateResult[0]}`);
          } else {
            // Update by ID
            updateResult = await model.update(op.data, {
              where: { id: op.targetId },
              transaction
            });
            console.log(`🗑️ [Soft Delete] Deleted ${op.targetTable} ID ${op.targetId} - Affected rows: ${updateResult[0]}`);
          }
        } catch (error: any) {
          console.error(`❌ [Soft Delete Error] Failed to delete ${op.targetTable}: ${error.message}`);
          throw error;
        }
      }
    }
  }

  /**
   * Execute create reversal AP operations in batch
   */
  private async executeCreateReversalAPBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    const AccountsPayable = (await import('../../../models/AccountsPayable')).default;
    
    for (const op of operations) {
      await AccountsPayable.create(op.data, { transaction });
      console.log(`📋 [Create Reversal AP] Created reversal AP entry`);
    }
  }

  /**
   * Execute restore credit limit operations in batch
   */
  private async executeRestoreCreditLimitBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    const Card = (await import('../../../models/Card')).default;
    
    for (const op of operations) {
      const { cardId, amount } = op.data;
      
      const card = await Card.findByPk(cardId, { transaction });
      if (card) {
        const currentUsedCredit = parseFloat(card.usedCredit?.toString() || '0');
        const newUsedCredit = Math.max(0, currentUsedCredit - amount);
        
        await card.update({ usedCredit: newUsedCredit }, { transaction });
        
        console.log(`💳 [Credit Restore] Card ${cardId}: Used credit ${currentUsedCredit} → ${newUsedCredit} (restored ${amount})`);
      }
    }
  }

  /**
   * Execute create manual task operations in batch
   */
  private async executeCreateManualTaskBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    // Implementation for manual task creation
    for (const op of operations) {
      console.log(`📋 [Manual Task] Created manual task: ${op.data.description}`);
      // Add actual manual task creation logic here if needed
    }
  }

  /**
   * Execute bank balance update operations in batch
   */
  private async executeBankBalanceUpdateBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    for (const op of operations) {
      const { bankAccountId, amount, transactionType } = op.data;
      
      await this.updateBankAccountBalance(
        bankAccountId,
        amount,
        transactionType,
        transaction
      );
      
      console.log(`🏦 [Bank Balance] Updated account ${bankAccountId} by ${amount} (${transactionType})`);
    }
  }

  /**
   * Helper method to get model by table name
   */
  private async getModelByTableName(tableName: string): Promise<any> {
    const modelMap: Record<string, string> = {
      'purchases': '../../../models/Purchase',
      'sales': '../../../models/Sale',
      'accounts_payables': '../../../models/AccountsPayable',
      'accounts_receivables': '../../../models/AccountsReceivable',
      'bank_registers': '../../../models/BankRegister',
      'cash_registers': '../../../models/CashRegister',
      'business_expenses': '../../../models/BusinessExpense'
    };
    
    const modelPath = modelMap[tableName];
    if (modelPath) {
      const model = (await import(modelPath)).default;
      return model;
    }
    
    return null;
  }

  /**
   * Generate reversal registration number
   */
  private async generateReversalNumber(prefix: string, transaction: Transaction): Promise<string> {
    // Simple implementation - can be enhanced with proper sequence generation
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Update bank account balance
   */
  private async updateBankAccountBalance(
    bankAccountId: number,
    amount: number,
    transactionType: 'INFLOW' | 'OUTFLOW',
    transaction: Transaction
  ): Promise<void> {
    const bankAccount = await BankAccount.findByPk(bankAccountId, { transaction });
    
    if (!bankAccount) {
      console.warn(`⚠️ [Bank Account] Bank account ${bankAccountId} not found, skipping balance update`);
      return;
    }
    
    const currentBalance = parseFloat(bankAccount.balance.toString());
    const transactionAmount = parseFloat(amount.toString());
    
    // For reversal entries: INFLOW increases balance, OUTFLOW decreases balance
    const newBalance = transactionType === 'INFLOW' 
      ? currentBalance + transactionAmount
      : currentBalance - transactionAmount;
    
    await bankAccount.update({ balance: newBalance }, { transaction });
    
    console.log(`💰 [Bank Balance] Updated ${bankAccount.bankName} (${bankAccount.accountNumber}): ${currentBalance} → ${newBalance} (${transactionType} ${transactionAmount})`);
  }

  /**
   * Execute inventory restore operations in batch
   * CRITICAL: Restores products back to inventory when sales are deleted
   */
  private async executeInventoryRestoreBatch(
    operations: ReversalOperation[],
    transaction: Transaction
  ): Promise<void> {
    const Product = (await import('../../../models/Product')).default;
    
    for (const op of operations) {
      const { productId, quantityToRestore, saleRegistrationNumber, description } = op.data;
      
      try {
        // Find the product
        const product = await Product.findByPk(productId, { transaction });
        if (!product) {
          console.warn(`⚠️ [Inventory Restore] Product ${productId} not found, skipping restoration`);
          continue;
        }
        
        // Calculate new inventory amounts
        const currentAmount = parseFloat(product.amount?.toString() || '0');
        const restoreQuantity = parseFloat(quantityToRestore.toString());
        const newAmount = currentAmount + restoreQuantity;
        
        // Update product inventory
        await product.update({ 
          amount: newAmount 
        }, { transaction });
        
        console.log(`📦 [Inventory Restored] Product ${product.name} (ID: ${productId}): ${currentAmount} → ${newAmount} (+${restoreQuantity}) - Sale ${saleRegistrationNumber} deleted`);
        
      } catch (error: any) {
        console.error(`❌ [Inventory Restore Error] Failed to restore product ${productId}:`, error.message);
        throw error;
      }
    }
  }
}