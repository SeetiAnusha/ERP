import AccountsReceivable from '../models/AccountsReceivable';
import BankRegister from '../models/BankRegister';
import BankAccount from '../models/BankAccount';
import Expense from '../models/Expense';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { TransactionType } from '../types/TransactionType';

// ✅ PHASE 2: Import GL Posting Services
import GLPostingService from './accounting/GLPostingService';
import AccountingRulesEngine from './accounting/AccountingRulesEngine';
import { SourceModule } from '../models/accounting/GeneralLedger';

interface CollectionData {
  amountReceived: number;
  transferReference?: string;
  description?: string;
  expenseCategory?: string;
  bankAccountId: number;
}

// Generate expense registration number
const generateExpenseNumber = async (): Promise<string> => {
  const lastExpense = await Expense.findOne({
    where: {
      registrationNumber: {
        [Op.like]: 'EX%'
      }
    },
    order: [['id', 'DESC']]
  });
  
  let nextNumber = 1;
  if (lastExpense) {
    const lastNumber = parseInt(lastExpense.registrationNumber.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  return `EX${String(nextNumber).padStart(4, '0')}`;
};

// Generate bank register number
const generateBankRegNumber = async (): Promise<string> => {
  const lastRegister = await BankRegister.findOne({
    where: {
      registrationNumber: {
        [Op.like]: 'BR%'
      }
    },
    order: [['id', 'DESC']]
  });
  
  let nextNumber = 1;
  if (lastRegister) {
    const lastNumber = parseInt(lastRegister.registrationNumber.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  return `BR${String(nextNumber).padStart(4, '0')}`;
};

// Calculate new bank balance
const calculateNewBankBalance = async (bankAccountId: number, amount: number): Promise<number> => {
  const lastBankTransaction = await BankRegister.findOne({
    where: { bankAccountId },
    order: [['id', 'DESC']]
  });
  
  const lastBalance = lastBankTransaction ? parseFloat(lastBankTransaction.balance.toString()) : 0;
  return lastBalance + amount;
};

export const collectPaymentWithFees = async (arId: number, collectionData: CollectionData) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      amountReceived,
      transferReference,
      description,
      expenseCategory,
      bankAccountId
    } = collectionData;

    // 1. Get the AR record
    const arRecord = await AccountsReceivable.findByPk(arId, { transaction });
    if (!arRecord) {
      throw new Error('Accounts Receivable record not found');
    }

    // 2. Calculate processing fee based on CLIENT REQUIREMENT
    // Processing fee = Full AR amount - Amount actually received
    const fullAmount = parseFloat(arRecord.amount.toString());
    const receivedAmount = parseFloat(amountReceived.toString());
    const processingFee = fullAmount - receivedAmount;

    // Validation
    if (receivedAmount <= 0) {
      throw new Error('Amount received must be greater than 0');
    }

    if (receivedAmount > fullAmount) {
      throw new Error('Amount received cannot be greater than invoice amount');
    }

    // 3. Update AR record (mark as fully collected since we're handling the difference as expense)
    await arRecord.update({
      receivedAmount: fullAmount, // ✅ Mark as fully received
      balanceAmount: 0, // ✅ Zero balance (processing fee handled as expense)
      status: 'Received', // ✅ Always mark as received
      collectionDate: new Date(),
      transferReference: transferReference || undefined,
      collectionNotes: description || undefined,
      actualBankDeposit: receivedAmount, // ✅ NEW: Store actual amount deposited to bank
      bankAccountId: bankAccountId // ✅ NEW: Store which bank account received the deposit
    }, { transaction });

    // 4. Get bank account
    const bankAccount = await BankAccount.findByPk(bankAccountId, { transaction });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    // 5. Create Bank Register entry (actual money received)
    const bankRegNumber = await generateBankRegNumber();
    const newBankBalance = await calculateNewBankBalance(bankAccountId, receivedAmount);

    const bankRegister = await BankRegister.create({
      registrationNumber: bankRegNumber,
      registrationDate: new Date(),
      transactionType: 'INFLOW',
      amount: receivedAmount, // ✅ Actual amount received (e.g., ₹9.72)
      paymentMethod: 'CREDIT_CARD_COLLECTION',
      relatedDocumentType: 'AR_COLLECTION',
      relatedDocumentNumber: arRecord.registrationNumber,
      clientName: arRecord.clientName || '',
      clientRnc: arRecord.clientRnc || '',
      description: `Credit Card Collection: ${arRecord.registrationNumber} - Received: ${receivedAmount.toFixed(2)} of ${fullAmount.toFixed(2)}${description ? ` - ${description}` : ''}`,
      transferNumber: transferReference || null,
      bankAccountId,
      balance: newBankBalance,
      sourceTransactionType: TransactionType.AR_COLLECTION, // ✅ FIXED: Added missing sourceTransactionType
    }, { transaction });

    // 6. Create Expense entry (processing fee) - ALWAYS if there's a difference
    let expenseRecord = null;
    if (processingFee > 0.01) { // Use 0.01 to handle floating point precision
      const expenseNumber = await generateExpenseNumber();
      
      expenseRecord = await Expense.create({
        registrationNumber: expenseNumber,
        registrationDate: new Date(),
        expenseType: expenseCategory || 'CREDIT_CARD_FEE',
        amount: processingFee,
        description: `Credit card processing fee for ${arRecord.registrationNumber} - Sale: ${fullAmount.toFixed(2)}, Received: ${receivedAmount.toFixed(2)}${description ? ` - ${description}` : ''}`,
        relatedDocumentType: 'AR_COLLECTION',
        relatedDocumentNumber: arRecord.registrationNumber,
        paymentMethod: 'AUTO_DEDUCTION',
        status: 'PAID'
      }, { transaction });
    }

    // 7. Update bank account balance (actual amount received)
    const newBankAccountBalance = parseFloat(bankAccount.balance.toString()) + receivedAmount;
    await bankAccount.update({ balance: newBankAccountBalance }, { transaction });

    // ✅ PHASE 2: Post GL Entries for AR Collection
    try {
      const collectionMethod = bankAccountId ? 'BANK' : 'CASH';
      
      // Get GL entries for AR collection (actual amount received)
      const glEntries = AccountingRulesEngine.getARCollectionGLEntries(
        receivedAmount,
        collectionMethod
      );
      
      // Post to General Ledger
      await GLPostingService.postGLEntries({
        entryDate: new Date(),
        sourceModule: SourceModule.ACCOUNTS_RECEIVABLE,
        sourceTransactionId: arRecord.id,
        sourceTransactionNumber: arRecord.registrationNumber,
        entries: glEntries,
      }, transaction);
      
      console.log('✅ GL entries posted successfully for AR collection', arRecord.registrationNumber);
      
      // If there's a processing fee, post it as an expense
      if (processingFee > 0.01) {
        const feeEntries = AccountingRulesEngine.getBusinessExpenseGLEntries(
          processingFee,
          'CREDIT_CARD_FEE',
          'BANK'
        );
        
        await GLPostingService.postGLEntries({
          entryDate: new Date(),
          sourceModule: SourceModule.ACCOUNTS_RECEIVABLE,
          sourceTransactionId: arRecord.id,
          sourceTransactionNumber: `${arRecord.registrationNumber}-FEE`,
          entries: feeEntries,
        }, transaction);
        
        console.log('✅ GL entries posted for processing fee', processingFee);
      }
    } catch (glError: any) {
      console.error('❌ Failed to post GL entries for AR collection:', glError.message);
      throw glError; // Will trigger transaction rollback
    }

    await transaction.commit();
    
    return {
      success: true,
      arRecord,
      bankRegister,
      expenseRecord,
      processingFee: processingFee > 0.01 ? processingFee : null,
      fullAmount,
      receivedAmount,
      message: `Payment collected successfully. ${processingFee > 0.01 ? `Processing fee of ${processingFee.toFixed(2)} recorded as expense.` : 'No processing fee.'}`
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const getAccountsReceivableWithBalance = async () => {
  return await AccountsReceivable.findAll({
    where: {
      balanceAmount: {
        [Op.gt]: 0
      }
    },
    order: [['registrationDate', 'DESC']]
  });
};