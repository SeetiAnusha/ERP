import BankRegister from '../models/BankRegister';
import BankAccount from '../models/BankAccount';
import AccountsPayable from '../models/AccountsPayable';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export const getAllBankRegisters = async () => {
  return await BankRegister.findAll({
    order: [['registrationDate', 'DESC']],
  });
};

export const getBankRegisterById = async (id: number) => {
  return await BankRegister.findByPk(id);
};

// Phase 4: Get pending AP invoices for a supplier
export const getPendingAPInvoices = async (supplierId: number) => {
  const pendingInvoices = await AccountsPayable.findAll({
    where: {
      supplierId,
      status: {
        [Op.in]: ['Pending', 'Partial']
      }
    },
    order: [['registrationDate', 'ASC']]
  });
  
  return pendingInvoices;
};

// Phase 4: Auto-generate cheque number
async function generateChequeNumber(bankAccountId: number): Promise<string> {
  const lastCheque = await BankRegister.findOne({
    where: { 
      bankAccountId,
      chequeNumber: { [Op.ne]: null }
    },
    order: [['id', 'DESC']]
  });
  
  const nextNumber = lastCheque && lastCheque.chequeNumber
    ? parseInt(lastCheque.chequeNumber.replace('CK', '')) + 1
    : 1;
    
  return `CK${nextNumber.toString().padStart(4, '0')}`;
}

// Phase 4: Auto-generate transfer number
async function generateTransferNumber(bankAccountId: number): Promise<string> {
  const lastTransfer = await BankRegister.findOne({
    where: { 
      bankAccountId,
      transferNumber: { [Op.ne]: null }
    },
    order: [['id', 'DESC']]
  });
  
  const nextNumber = lastTransfer && lastTransfer.transferNumber
    ? parseInt(lastTransfer.transferNumber.replace('TF', '')) + 1
    : 1;
    
  return `TF${nextNumber.toString().padStart(4, '0')}`;
}

export const createBankRegister = async (data: any) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Phase 4: Validate bankAccountId is required
    if (!data.bankAccountId) {
      throw new Error('Bank Account selection is required');
    }
    
    // Get bank account
    const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new Error('Bank Account not found');
    }
    
    // Generate registration number
    const lastRegister = await BankRegister.findOne({
      where: { registrationNumber: { [Op.like]: 'BR%' } },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastRegister) {
      const lastNumber = parseInt(lastRegister.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `BR${String(nextNumber).padStart(4, '0')}`;
    
    // Calculate new balance
    const lastBalance = lastRegister ? parseFloat(lastRegister.balance.toString()) : 0;
    const amount = parseFloat(data.amount);
    const newBalance = data.transactionType === 'INFLOW' 
      ? lastBalance + amount
      : lastBalance - amount;
    
    // Phase 4: Handle INFLOW
    if (data.transactionType === 'INFLOW') {
      // Only allow BANK_CREDIT or CORRECTION
      if (data.paymentMethod !== 'BANK_CREDIT' && data.paymentMethod !== 'CORRECTION') {
        throw new Error('INFLOW only allows BANK_CREDIT or CORRECTION payment methods');
      }
      
      // Create bank register entry
      const bankRegister = await BankRegister.create({
        ...data,
        registrationNumber,
        balance: newBalance,
      }, { transaction });
      
      // Update bank account balance (INFLOW increases balance)
      const newBankBalance = parseFloat(bankAccount.balance.toString()) + amount;
      await bankAccount.update({ balance: newBankBalance }, { transaction });
      
      await transaction.commit();
      return bankRegister;
    }
    
    // Phase 4: Handle OUTFLOW
    if (data.transactionType === 'OUTFLOW') {
      let chequeNumber = null;
      let transferNumber = null;
      
      // For CHEQUE payments
      if (data.paymentMethod === 'CHEQUE') {
        // Auto-generate cheque number
        chequeNumber = await generateChequeNumber(data.bankAccountId);
        
        // If supplier and invoices selected, update AP
        if (data.supplierId && data.invoiceIds) {
          const invoiceIdsArray = JSON.parse(data.invoiceIds);
          for (const invoiceId of invoiceIdsArray) {
            const apInvoice = await AccountsPayable.findByPk(invoiceId, { transaction });
            if (apInvoice) {
              const paidAmount = parseFloat(apInvoice.paidAmount.toString()) + amount;
              const balanceAmount = parseFloat(apInvoice.amount.toString()) - paidAmount;
              const status = balanceAmount <= 0 ? 'Paid' : 'Partial';
              
              await apInvoice.update({
                paidAmount,
                balanceAmount,
                status,
              }, { transaction });
            }
          }
        }
      }
      
      // For BANK_TRANSFER payments
      if (data.paymentMethod === 'BANK_TRANSFER') {
        // Auto-generate transfer number
        transferNumber = await generateTransferNumber(data.bankAccountId);
        
        // If supplier and invoices selected, update AP
        if (data.supplierId && data.invoiceIds) {
          const invoiceIdsArray = JSON.parse(data.invoiceIds);
          for (const invoiceId of invoiceIdsArray) {
            const apInvoice = await AccountsPayable.findByPk(invoiceId, { transaction });
            if (apInvoice) {
              const paidAmount = parseFloat(apInvoice.paidAmount.toString()) + amount;
              const balanceAmount = parseFloat(apInvoice.amount.toString()) - paidAmount;
              const status = balanceAmount <= 0 ? 'Paid' : 'Partial';
              
              await apInvoice.update({
                paidAmount,
                balanceAmount,
                status,
              }, { transaction });
            }
          }
        }
      }
      
      // Create bank register entry
      const bankRegister = await BankRegister.create({
        ...data,
        registrationNumber,
        balance: newBalance,
        chequeNumber,
        transferNumber,
      }, { transaction });
      
      // Update bank account balance (OUTFLOW decreases balance)
      const newBankBalance = parseFloat(bankAccount.balance.toString()) - amount;
      await bankAccount.update({ balance: newBankBalance }, { transaction });
      
      await transaction.commit();
      return bankRegister;
    }
    
    throw new Error('Invalid transaction type');
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const deleteBankRegister = async (id: number) => {
  const register = await BankRegister.findByPk(id);
  if (!register) throw new Error('Bank register entry not found');
  await register.destroy();
  return { message: 'Bank register entry deleted successfully' };
};
