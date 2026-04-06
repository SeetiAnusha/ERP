import { Transaction, Op } from 'sequelize';
import AccountsReceivable from '../../../models/AccountsReceivable';
import BankRegister from '../../../models/BankRegister';
import CashRegister from '../../../models/CashRegister';
import BusinessExpense from '../../../models/BusinessExpense';
import BankAccount from '../../../models/BankAccount';
import ApprovalRequest from '../../../models/ApprovalRequest';

/**
 * Reversal Operation for batch processing
 */
interface ReversalOperation {
  type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE' | 'DELETE_PROCESSING_FEE' | 'REVERSE_EXPECTED_DEPOSIT';
  targetTable: string;
  targetId: number;
  data: any;
  priority: number;
}

/**
 * AR Deletion Handler
 * 
 * Handles Accounts Receivable deletion with automatic collection reversal
 * Supports both unpaid and paid AR scenarios with proper cash/bank reversals
 */
export class ARDeletionHandler {
  /**
   * Generate AR reversal operations with scenario-based handling
   * 
   * Handles 2 scenarios:
   * 1. AR Credit (Unpaid) - Simple soft delete
   * 2. AR Credit (Paid) - Complex reversal with cash/bank register updates
   */
  async generateARReversalOperations(
    nodeId: number,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    // ✅ CRITICAL FIX: Force fresh fetch from database, bypassing any cache
    // Use transaction with explicit lock to ensure we get the latest data
    const ar = await AccountsReceivable.findByPk(nodeId, { 
      transaction,
      lock: transaction.LOCK.UPDATE, // Explicit lock to force fresh read
      raw: false // Ensure we get a model instance, not plain object
    });
    
    if (!ar) {
      console.error(`❌ [AR Not Found] AR with ID ${nodeId} not found in database`);
      return operations;
    }
    
    // ✅ CRITICAL DEBUG: Log raw database values
    const receivedAmount = parseFloat(ar.receivedAmount?.toString() || '0');
    const totalAmount = parseFloat(ar.amount?.toString() || '0');
    const balanceAmount = parseFloat(ar.balanceAmount?.toString() || '0');
    
    console.log(`💰 [AR Analysis] ${ar.registrationNumber}: Total=${totalAmount}, Received=${receivedAmount}, Balance=${balanceAmount}, Status=${ar.status}, Type=${ar.type}`);
    console.log(`💰 [AR Details] ID=${ar.id}, ExpectedDeposit=${ar.expectedBankDeposit}, Bank Account=${ar.bankAccountId}`);
    console.log(`💰 [AR Raw Data] receivedAmount field value: "${ar.receivedAmount}" (type: ${typeof ar.receivedAmount})`);
    
    // ✅ OPTIMIZATION: Fetch ALL related records in parallel (single database round-trip)
    // ✅ CRITICAL FIX: Query BOTH Expense and BusinessExpense tables for processing fees
    const Expense = (await import('../../../models/Expense')).default;
    
    const [bankEntries, cashEntries, businessExpenses, legacyExpenses] = await Promise.all([
      BankRegister.findAll({
        where: { 
          relatedDocumentNumber: ar.registrationNumber,
          deletion_status: { [Op.ne]: 'EXECUTED' }
        },
        transaction
      }),
      CashRegister.findAll({
        where: { 
          relatedDocumentNumber: ar.registrationNumber,
          deletion_status: { [Op.ne]: 'EXECUTED' }
        },
        transaction
      }),
      // Fetch from business_expenses table
      BusinessExpense.findAll({
        where: {
          [Op.or]: [
            {
              relatedDocumentType: 'AR_COLLECTION',
              relatedDocumentNumber: ar.registrationNumber
            },
            {
              description: {
                [Op.like]: `%${ar.registrationNumber}%`
              },
              expenseType: {
                [Op.or]: ['CREDIT_CARD_FEE', 'CREDIT_CARD_PROCESSING_FEE', 'DEBIT_CARD_FEE']
              }
            }
          ]
        },
        transaction
      }),
      // ✅ CRITICAL: Also fetch from legacy expenses table
      Expense.findAll({
        where: {
          [Op.or]: [
            {
              relatedDocumentType: 'AR_COLLECTION',
              relatedDocumentNumber: ar.registrationNumber
            },
            {
              description: {
                [Op.like]: `%${ar.registrationNumber}%`
              },
              expenseType: {
                [Op.or]: ['CREDIT_CARD_FEE', 'CREDIT_CARD_PROCESSING_FEE', 'DEBIT_CARD_FEE']
              }
            }
          ]
        },
        transaction
      })
    ]);
    
    // Combine expenses from both tables
    const processingFeeExpenses = [...businessExpenses, ...legacyExpenses];
    
    const hasPaymentRecords = bankEntries.length > 0 || cashEntries.length > 0;
    const isCardPayment = ar.type === 'CREDIT_CARD_SALE' || ar.type === 'DEBIT_CARD_SALE';
    
    console.log(`🔍 [AR Payment Check] Bank entries: ${bankEntries.length}, Cash entries: ${cashEntries.length}`);
    console.log(`🔍 [AR Payment Check] Processing fees: ${processingFeeExpenses.length} (BusinessExpense: ${businessExpenses.length}, Legacy Expense: ${legacyExpenses.length})`);
    console.log(`🔍 [AR Payment Check] hasPaymentRecords: ${hasPaymentRecords}, receivedAmount: ${receivedAmount}, isCardPayment: ${isCardPayment}`);
    
    // ✅ CRITICAL: If payment records exist but receivedAmount is 0, this is a DATA INCONSISTENCY BUG
    if (hasPaymentRecords && receivedAmount === 0) {
      console.error(`🚨 [DATA INCONSISTENCY] AR ${ar.registrationNumber} has payment records but receivedAmount is 0!`);
      console.error(`🚨 [DATA INCONSISTENCY] This indicates the AR record was not updated when payment was collected`);
      console.error(`🚨 [DATA INCONSISTENCY] Bank entries: ${bankEntries.length}, Cash entries: ${cashEntries.length}`);
      console.error(`🚨 [DATA INCONSISTENCY] Proceeding with PAID AR logic to prevent data corruption`);
      
      // Force treating this as a paid AR
      // DO NOT return early - continue to payment reversal logic below
    }
    
    // ✅ Scenario 1: AR Credit (Unpaid) - Simple deletion
    // ONLY if receivedAmount is 0 AND no payment records exist
    if (receivedAmount === 0 && !hasPaymentRecords) {
      console.log(`📝 [AR Unpaid] Simple deletion for ${ar.registrationNumber} - No collections to reverse`);
      
      operations.push({
        type: 'SOFT_DELETE',
        targetTable: 'accounts_receivables',
        targetId: ar.id,
        data: {
          deletion_status: 'EXECUTED',
          deleted_at: new Date(),
          deleted_by: executedBy,
          deletion_reason_code: approvalRequest.deletion_reason_code,
          deletion_memo: approvalRequest.custom_memo,
          deletion_approval_id: approvalRequest.id
        },
        priority: 1
      });
      
      return operations;
    }
    
    // ✅ Scenario 2: AR Credit (Paid) - Check payment method and reverse accordingly
    console.log(`💰 [AR Paid] AR has been collected (receivedAmount: ${receivedAmount} or has payment records). Processing reversals...`);
    
    // ✅ Handle CASH payments - Update Cash Register Master (reduce store balance)
    for (const cashEntry of cashEntries) {
      console.log(`💵 [AR Cash Reversal] Found cash payment: ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
      
      operations.push({
        type: 'CASH_REVERSAL',
        targetTable: 'cash_registers',
        targetId: cashEntry.id,
        data: {
          originalEntry: cashEntry,
          reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
          amount: cashEntry.amount,
          description: `Reversal of AR collection ${ar.registrationNumber} - ${ar.clientName || 'Customer'} (${approvalRequest.deletion_reason_code})`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 1
      });
    }
    
    // ✅ Handle BANK payments - Different logic for card vs non-card
    if (bankEntries.length > 0) {
      if (isCardPayment) {
        // ✅ CARD PAYMENT: Soft delete bank entries + reverse expected deposit + delete processing fees
        console.log(`💳 [AR Card Payment] Detected card payment - Using special handling`);
        console.log(`💳 [AR Card Payment] AR Type: ${ar.type}, Bank Entries: ${bankEntries.length}, Expected Deposit: ${ar.expectedBankDeposit}, Bank Account: ${ar.bankAccountId}`);
        
        // 1. Soft delete bank entries (DON'T create reversal entries for card payments)
        for (const bankEntry of bankEntries) {
          console.log(`🏦 [AR Bank Entry] Soft deleting bank entry: ${bankEntry.registrationNumber} (Amount: ₹${bankEntry.amount}, Bank Account: ${bankEntry.bankAccountId})`);
          
          operations.push({
            type: 'SOFT_DELETE',
            targetTable: 'bank_registers',
            targetId: bankEntry.id,
            data: {
              deletion_status: 'EXECUTED',
              deleted_at: new Date(),
              deleted_by: executedBy,
              deletion_reason_code: approvalRequest.deletion_reason_code,
              deletion_memo: `Bank entry deleted due to AR deletion: ${ar.registrationNumber}`,
              deletion_approval_id: approvalRequest.id
            },
            priority: 1
          });
        }
        
        // 2. Reverse expected deposit from bank account
        if (ar.expectedBankDeposit && ar.bankAccountId) {
          const expectedDeposit = parseFloat(ar.expectedBankDeposit.toString());
          
          console.log(`💳 [AR Expected Deposit] Reversing expected deposit: ₹${expectedDeposit} from bank account ${ar.bankAccountId}`);
          console.log(`💳 [AR Expected Deposit] This will ONLY update bank account balance, NO reversal entry will be created`);
          
          operations.push({
            type: 'REVERSE_EXPECTED_DEPOSIT',
            targetTable: 'bank_accounts',
            targetId: ar.bankAccountId,
            data: {
              amount: expectedDeposit,
              arRegistrationNumber: ar.registrationNumber,
              description: `Reverse expected deposit for deleted AR ${ar.registrationNumber}`,
              deletion_approval_id: approvalRequest.id
            },
            priority: 1
          });
        } else {
          console.warn(`⚠️ [AR Card Payment] Cannot reverse expected deposit - expectedBankDeposit: ${ar.expectedBankDeposit}, bankAccountId: ${ar.bankAccountId}`);
        }
        
        // 3. Delete processing fee expenses (already fetched above)
        console.log(`💳 [AR Card Payment] Processing ${processingFeeExpenses.length} related expenses`);
        
        // ✅ ENHANCED: Log all expenses found for debugging
        if (processingFeeExpenses.length > 0) {
          console.log(`💳 [AR Card Payment] All expenses found:`);
          processingFeeExpenses.forEach((exp, idx) => {
            const tableName = (exp as any).constructor.tableName || (exp as any).constructor.name;
            console.log(`   ${idx + 1}. Table: ${tableName}, ID: ${exp.id}, RegNum: ${exp.registrationNumber}, Type: ${exp.expenseType}, Amount: ₹${exp.amount}`);
            console.log(`      Description: ${exp.description}`);
            console.log(`      RelatedDocType: ${exp.relatedDocumentType}, RelatedDocNum: ${exp.relatedDocumentNumber}`);
            console.log(`      Status: ${exp.status || 'N/A'}, DeletionStatus: ${(exp as any).deletion_status || 'NULL'}`);
          });
        }
        
        // Filter for processing fees - EXPANDED criteria
        const feeExpenses = processingFeeExpenses.filter(expense => {
          const isProcessingFee = 
            expense.expenseType === 'CREDIT_CARD_PROCESSING_FEE' ||
            expense.expenseType === 'CREDIT_CARD_FEE' ||
            expense.expenseType === 'DEBIT_CARD_FEE' ||
            (expense as any).categoryName === 'Processing Fees' ||
            (expense.description && (
              expense.description.includes('Processing Fee') ||
              expense.description.includes('processing fee') ||
              expense.description.includes('Credit card processing fee')
            ));
          
          // ✅ CRITICAL: Only delete if NOT already deleted (for BusinessExpense table)
          const notAlreadyDeleted = !(expense as any).deletion_status || (expense as any).deletion_status !== 'EXECUTED';
          
          return isProcessingFee && notAlreadyDeleted;
        });
        
        console.log(`💳 [AR Card Payment] Filtered to ${feeExpenses.length} processing fee expenses (from ${processingFeeExpenses.length} total expenses)`);
        
        if (feeExpenses.length === 0 && processingFeeExpenses.length > 0) {
          console.warn(`⚠️ [AR Card Payment] Found ${processingFeeExpenses.length} expenses but NONE matched processing fee criteria!`);
          console.warn(`⚠️ [AR Card Payment] This might indicate the processing fee was not created or has different criteria`);
        }
        
        for (const feeExpense of feeExpenses) {
          const tableName = (feeExpense as any).constructor.tableName || 'expenses';
          const isLegacyExpense = tableName === 'expenses';
          
          console.log(`💰 [AR Processing Fee] Soft deleting processing fee from ${tableName}: ${feeExpense.registrationNumber} (₹${feeExpense.amount})`);
          console.log(`💰 [AR Processing Fee] Expense details - ID: ${feeExpense.id}, Type: ${feeExpense.expenseType}, Description: ${feeExpense.description}`);
          
          operations.push({
            type: 'DELETE_PROCESSING_FEE',
            targetTable: isLegacyExpense ? 'expenses' : 'business_expenses',
            targetId: feeExpense.id,
            data: {
              originalExpense: feeExpense,
              isLegacyExpense: isLegacyExpense,
              deletion_status: 'EXECUTED',
              deleted_at: new Date(),
              deleted_by: executedBy,
              deletion_reason_code: approvalRequest.deletion_reason_code,
              deletion_memo: `Processing fee deleted due to AR deletion: ${ar.registrationNumber}`,
              deletion_approval_id: approvalRequest.id
            },
            priority: 1
          });
        }
        
        if (feeExpenses.length === 0) {
          console.warn(`⚠️ [AR Card Payment] No processing fee expenses found for ${ar.registrationNumber}`);
          console.warn(`⚠️ [AR Card Payment] Possible reasons:`);
          console.warn(`   1. Processing fee was never created during collection`);
          console.warn(`   2. Processing fee has different relatedDocumentType/Number`);
          console.warn(`   3. Processing fee was already deleted`);
          console.warn(`   4. AR was never collected (no payment made yet)`);
        }
        
      } else {
        // ✅ NON-CARD BANK PAYMENT: Create reversal entries
        for (const bankEntry of bankEntries) {
          console.log(`🏦 [AR Bank Reversal] Found non-card bank payment: ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount})`);
          
          operations.push({
            type: 'BANK_REVERSAL',
            targetTable: 'bank_registers',
            targetId: bankEntry.id,
            data: {
              originalEntry: bankEntry,
              reversalType: bankEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
              amount: bankEntry.amount,
              description: `Reversal of AR collection ${ar.registrationNumber} - ${ar.clientName || 'Customer'} (${approvalRequest.deletion_reason_code})`,
              deletion_approval_id: approvalRequest.id
            },
            priority: 1
          });
        }
      }
    }
    
    // ✅ OPTIMIZATION: Soft delete AR directly with status reset (no need for separate STATUS_UPDATE)
    // This combines two operations into one, reducing database operations
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_receivables',
      targetId: ar.id,
      data: {
        // Soft delete fields
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id,
        // Reset collection status fields (combined with soft delete)
        receivedAmount: 0,
        balanceAmount: parseFloat(ar.amount.toString()),
        status: 'Not Collected'
      },
      priority: 3
    });
    
    console.log(`✅ [AR Operations] Generated ${operations.length} operations for AR ${ar.registrationNumber}`);
    return operations;
  }
}

export default ARDeletionHandler;