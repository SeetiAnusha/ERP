import Sale from '../models/Sale';
import SaleItem from '../models/SaleItem';
import Client from '../models/Client';
import Product from '../models/Product';
import { Op } from 'sequelize';
import sequelize from '../config/database';

// Helper function for currency formatting
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const getAllSales = async () => {
  return await Sale.findAll({
    include: [
      { model: Client, as: 'client' },
      { model: SaleItem, as: 'items' }
    ],
    order: [['registrationDate', 'DESC']],
  });
};

export const getSaleById = async (id: number) => {
  return await Sale.findByPk(id, {
    include: [
      { model: Client, as: 'client' },
      { model: SaleItem, as: 'items' }
    ],
  });
};

export const createSale = async (data: any) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const lastSale = await Sale.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'RV%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastSale) {
      const lastNumber = parseInt(lastSale.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `RV${String(nextNumber).padStart(4, '0')}`;
    
    // Calculate collection status based on payment type
    const total = data.total || 0;
    let collectedAmount = 0;
    let balanceAmount = total;
    let collectionStatus = 'Not Collected';
    
    const paymentType = data.paymentType ? data.paymentType.toUpperCase() : '';
    
    // ✅ VALIDATION: For CASH/CHEQUE, require cash register selection
    if (paymentType === 'CASH' || paymentType === 'CHEQUE') {
      if (!data.cashRegisterId) {
        throw new Error(
          `Cash register selection is required for ${paymentType} payments. ` +
          `Please select a cash register to record this sale.`
        );
      }
    }
    
    // ✅ VALIDATION: For DEBIT_CARD/CREDIT_CARD, require payment network selection
    if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') {
      if (!data.cardPaymentNetworkId) {
        throw new Error(
          `Payment network selection is required for ${paymentType.toLowerCase().replace('_', ' ')} payments. ` +
          `Please select a payment network (Visa, Mastercard, etc.).`
        );
      }
    }
    
    if (paymentType === 'CASH' || paymentType === 'CHEQUE') {
      // CASH/CHEQUE: Collected immediately, cash balance increases (CashRegister entry created below)
      collectedAmount = total;
      balanceAmount = 0;
      collectionStatus = 'Collected';
    }
    else if (paymentType === 'BANK_TRANSFER' || paymentType === 'DEPOSIT') {
      // BANK TRANSFER or DEPOSIT: Collected immediately, bank balance increases
      collectedAmount = total;
      balanceAmount = 0;
      collectionStatus = 'Collected';
      // Will create CashRegister entry (INFLOW) below after sale is created
    }
    else if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') {
      // DEBIT/CREDIT CARD: Creates Accounts Receivable from payment network
      collectedAmount = 0; // Not collected yet - payment network owes you
      balanceAmount = total;
      collectionStatus = 'Not Collected';
    }
    else if (paymentType === 'CREDIT') {
      // CREDIT: Not collected yet, client will pay later
      collectedAmount = 0;
      balanceAmount = total;
      collectionStatus = 'Not Collected';
    }
    else {
      // Default: treat as not collected
      collectedAmount = 0;
      balanceAmount = total;
      collectionStatus = 'Not Collected';
    }
    
    const sale = await Sale.create({
      ...data,
      registrationNumber,
      registrationDate: new Date(),
      collectionStatus,  // Changed from paymentStatus
      collectedAmount,   // Changed from paidAmount
      balanceAmount,
    }, { transaction });
    
    // Create Cash Register entry for CASH and CHEQUE collections (INFLOW)
    if (paymentType === 'CASH' || paymentType === 'CHEQUE') {
      const CashRegister = (await import('../models/CashRegister')).default;
      const CashRegisterMaster = (await import('../models/CashRegisterMaster')).default;
      
      // Validate cash register exists
      const cashRegister = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
      if (!cashRegister) {
        throw new Error('Cash register not found');
      }
      
      // ✅ FIX: Get last transaction for THIS SPECIFIC cash register only
      const lastCashTransaction = await CashRegister.findOne({
        where: {
          cashRegisterId: data.cashRegisterId
        },
        order: [['id', 'DESC']],
        transaction
      });
      
      const lastBalance = lastCashTransaction ? Number(lastCashTransaction.balance) : 0;
      const newBalance = lastBalance + total; // INFLOW increases balance
      
      // ✅ FIX: Also update the CashRegisterMaster balance
      const currentMasterBalance = Number(cashRegister.balance || 0);
      const newMasterBalance = currentMasterBalance + total;
      await cashRegister.update({ balance: newMasterBalance }, { transaction });
      
      const client = await Client.findByPk(data.clientId, { transaction });
      
      const paymentMethodLabel = paymentType === 'CASH' ? 'Cash' : 'Cheque';
      
      // Use the sale registration number (RV####)
      await CashRegister.create({
        registrationNumber: registrationNumber,
        registrationDate: new Date(),
        transactionType: 'INFLOW',
        amount: total,
        paymentMethod: paymentMethodLabel,
        relatedDocumentType: 'Sale',
        relatedDocumentNumber: registrationNumber,
        clientRnc: data.clientRnc || '',
        clientName: client?.name || '',
        ncf: data.ncf || '',
        description: `Sale ${registrationNumber} via ${paymentMethodLabel} - Cash Register: ${cashRegister.name}`,
        balance: newBalance,
        cashRegisterId: data.cashRegisterId,
      }, { transaction });
    }
    
    // Create Bank Register entry for BANK_TRANSFER and DEPOSIT collections (INFLOW)
    if (paymentType === 'BANK_TRANSFER' || paymentType === 'DEPOSIT') {
      const BankRegister = (await import('../models/BankRegister')).default;
      const BankAccount = (await import('../models/BankAccount')).default;
      
      // ✅ VALIDATION: Require bank account selection
      if (!data.bankAccountId) {
        throw new Error(
          `Bank account selection is required for ${paymentType} payments. ` +
          `Please select which bank account will receive this payment.`
        );
      }
      
      // ✅ Get and validate bank account
      const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }
      
      // ✅ Update bank account balance
      const currentBankBalance = Number(bankAccount.balance || 0);
      const newBankBalance = currentBankBalance + total;
      await bankAccount.update({ balance: newBankBalance }, { transaction });
      
      // ✅ Get last bank register transaction for THIS SPECIFIC bank account
      const lastBankTransaction = await BankRegister.findOne({
        where: {
          bankAccountId: data.bankAccountId
        },
        order: [['id', 'DESC']],
        transaction
      });
      
      const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
      const newBalance = lastBalance + total; // INFLOW increases balance
      
      const client = await Client.findByPk(data.clientId, { transaction });
      
      const paymentMethodLabel = paymentType === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Deposit';
      
      // Use the sale registration number (RV####)
      await BankRegister.create({
        registrationNumber: registrationNumber,
        registrationDate: new Date(),
        transactionType: 'INFLOW',
        sourceTransactionType: 'SALE', // ✅ FIX: Add source transaction type
        amount: total,
        paymentMethod: paymentMethodLabel,
        relatedDocumentType: 'Sale',
        relatedDocumentNumber: registrationNumber,
        clientRnc: data.clientRnc || '',
        clientName: client?.name || '',
        ncf: data.ncf || '',
        description: `Sale ${registrationNumber} via ${paymentMethodLabel} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
        balance: newBalance,
        bankAccountId: data.bankAccountId,  // ✅ Link to specific bank account
        bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`, // ✅ FIX: Add bank account name
        originalPaymentType: paymentType, // ✅ FIX: Add original payment type
      }, { transaction });
    }
    
    // Create Accounts Receivable for debit/credit card and credit sales
    if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD' || paymentType === 'CREDIT') {
      const AccountsReceivable = (await import('../models/AccountsReceivable')).default;
      const CardPaymentNetwork = (await import('../models/CardPaymentNetwork')).default;
      
      // Get client info
      const client = await Client.findByPk(data.clientId, { transaction });
      
      if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') {
        // ✅ CARD PAYMENT: Handle payment network (Visa, Mastercard, etc.)
        const network = await CardPaymentNetwork.findByPk(data.cardPaymentNetworkId, { transaction });
        if (!network) {
          throw new Error('Payment network not found');
        }
        
        // ✅ Validate network type matches payment type
        const expectedType = paymentType === 'DEBIT_CARD' ? 'DEBIT' : 'CREDIT';
        if (network.type !== expectedType) {
          throw new Error(
            `Selected payment network "${network.name}" is a ${network.type} network, not a ${expectedType} network. ` +
            `Please select a ${expectedType} payment network.`
          );
        }
        
        // Calculate processing fee (for reference only)
        const processingFee = total * Number(network.processingFee);
        const netAmount = total - processingFee;
        
        // Create Accounts Receivable for payment network
        // ✅ CLIENT REQUIREMENT: AR should be for FULL AMOUNT, processing fee recorded during collection
        const networkName = `${network.name} ${network.type}`;
        await AccountsReceivable.create({
          registrationNumber: registrationNumber,
          registrationDate: new Date(),
          type: paymentType === 'DEBIT_CARD' ? 'DEBIT_CARD_SALE' : 'CREDIT_CARD_SALE',
          relatedDocumentType: 'Sale',
          relatedDocumentId: sale.id,
          relatedDocumentNumber: registrationNumber,
          clientId: data.clientId, // ✅ Store customer ID for credit card sales
          clientName: client?.name || '', // ✅ Store actual customer name
          cardNetwork: networkName, // ✅ Store card network separately
          clientRnc: data.clientRnc || '',
          ncf: data.ncf || '',
          saleOf: data.saleType || 'Merchandise for sale',
          amount: total, // ✅ FULL SALE AMOUNT (not net amount)
          receivedAmount: 0,
          balanceAmount: total, // ✅ FULL AMOUNT as balance
          expectedBankDeposit: netAmount, // ✅ NEW: Expected amount after processing fee
          status: 'Pending',
          dueDate: new Date(Date.now() + network.settlementDays * 24 * 60 * 60 * 1000),
          notes: `${networkName} payment - Customer: ${client?.name || 'N/A'} - Expected processing fee: ${(Number(network.processingFee) * 100).toFixed(2)}% (${formatCurrency(processingFee)}) - Settlement: ${network.settlementDays} days`,
        }, { transaction });
        
      } else if (paymentType === 'CREDIT') {
        // CREDIT Sale: Client owes YOU money
        await AccountsReceivable.create({
          registrationNumber: registrationNumber,
          registrationDate: new Date(),
          type: 'CLIENT_CREDIT',
          relatedDocumentType: 'Sale',
          relatedDocumentId: sale.id,
          relatedDocumentNumber: registrationNumber,
          clientId: data.clientId,
          clientName: client?.name || '',
          clientRnc: data.clientRnc || '',
          ncf: data.ncf || '',
          saleOf: data.saleType || 'Merchandise for sale',
          amount: total,
          receivedAmount: 0,
          balanceAmount: total,
          expectedBankDeposit: total, // For credit sales, expected deposit = full amount
          status: 'Pending',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for client
          notes: `Credit sale to ${client?.name || 'client'} - ${registrationNumber}`,
        }, { transaction });
      }
    }
    
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        if (Number(product.amount) < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.amount}, Required: ${item.quantity}`);
        }
        
        // Calculate Cost of Goods Sold using CURRENT unit cost (before sale)
        // This is the weighted average cost that existed before this sale
        const costOfGoodsSold = Number(product.unitCost) * item.quantity;
        const grossMargin = item.total - costOfGoodsSold;
        
        await SaleItem.create({
          saleId: sale.id,
          productId: item.productId,
          productCode: product.code,
          productName: product.name,
          unitOfMeasurement: product.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          tax: item.tax,
          total: item.total,
          costOfGoodsSold,
          grossMargin,
        }, { transaction });
        
        // Decrease stock and update subtotal
        // Note: unitCost stays the same (weighted average doesn't change on sale)
        const newAmount = Number(product.amount) - item.quantity;
        const newSubtotal = newAmount * Number(product.unitCost);
        
        await product.update({
          amount: newAmount,
          subtotal: newSubtotal
        }, { transaction });
      }
    }
    
    await transaction.commit();
    committed = true;
    
    return await Sale.findByPk(sale.id, {
      include: [
        { model: Client, as: 'client' },
        { model: SaleItem, as: 'items' }
      ],
    });
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const updateSale = async (id: number, data: any) => {
  const sale = await Sale.findByPk(id);
  if (!sale) throw new Error('Sale not found');
  return await sale.update(data);
};

export const collectPayment = async (id: number, paymentData: { amount: number; paymentMethod: string; cashRegisterId?: number; bankAccountId?: number }) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const sale = await Sale.findByPk(id, { transaction });
    if (!sale) throw new Error('Sale not found');
    
    const newCollectedAmount = Number(sale.collectedAmount) + paymentData.amount;
    const newBalanceAmount = Number(sale.total) - newCollectedAmount;
    
    let collectionStatus = 'Not Collected';
    if (newCollectedAmount >= Number(sale.total)) {
      collectionStatus = 'Collected';
    } else if (newCollectedAmount > 0) {
      collectionStatus = 'Partial';
    }
    
    await sale.update({
      collectedAmount: newCollectedAmount,
      balanceAmount: newBalanceAmount,
      collectionStatus,
    }, { transaction });
    
    // ✅ FIX: Only create cash/bank register entries for sales that weren't already paid during creation
    // Check if this sale was already fully paid during creation (CASH/CHEQUE/BANK_TRANSFER/DEPOSIT)
    const wasAlreadyPaid = sale.collectionStatus === 'Collected' && Number(sale.collectedAmount) > 0;
    
    if (!wasAlreadyPaid) {
      // This is a genuine payment collection for credit sales, debit/credit card settlements, etc.
      
      if (paymentData.paymentMethod.toUpperCase() === 'CASH' || paymentData.paymentMethod.toUpperCase() === 'CHEQUE') {
        // ✅ CASH/CHEQUE Payment Collection
        const CashRegister = (await import('../models/CashRegister')).default;
        const CashRegisterMaster = (await import('../models/CashRegisterMaster')).default;
        
        // Validate cash register selection
        if (!paymentData.cashRegisterId) {
          throw new Error('Cash register selection is required for cash/cheque payments');
        }
        
        const cashRegister = await CashRegisterMaster.findByPk(paymentData.cashRegisterId, { transaction });
        if (!cashRegister) {
          throw new Error('Cash register not found');
        }
        
        // Get last transaction for THIS SPECIFIC cash register
        const lastCashTransaction = await CashRegister.findOne({
          where: {
            cashRegisterId: paymentData.cashRegisterId
          },
          order: [['id', 'DESC']],
          transaction
        });
        
        // Generate CJ registration number
        const lastCJTransaction = await CashRegister.findOne({
          where: {
            registrationNumber: {
              [Op.like]: 'CJ%'
            }
          },
          order: [['id', 'DESC']],
          transaction
        });
        
        let nextCashNumber = 1;
        if (lastCJTransaction) {
          const lastNumber = parseInt(lastCJTransaction.registrationNumber.substring(2));
          nextCashNumber = lastNumber + 1;
        }
        
        const cashRegistrationNumber = `CJ${String(nextCashNumber).padStart(4, '0')}`;
        const lastBalance = lastCashTransaction ? Number(lastCashTransaction.balance) : 0;
        const newBalance = lastBalance + paymentData.amount;
        
        // Update cash register master balance
        const currentMasterBalance = Number(cashRegister.balance || 0);
        const newMasterBalance = currentMasterBalance + paymentData.amount;
        await cashRegister.update({ balance: newMasterBalance }, { transaction });
        
        // Get client info for the cash register entry
        const client = await Client.findByPk(sale.clientId, { transaction });
        
        await CashRegister.create({
          registrationNumber: cashRegistrationNumber,
          registrationDate: new Date(),
          transactionType: 'INFLOW',
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod === 'CASH' ? 'Cash' : 'Cheque',
          relatedDocumentType: 'Sale',
          relatedDocumentNumber: sale.registrationNumber,
          clientRnc: sale.clientRnc,
          clientName: client?.name || '',
          description: `Payment collection for sale ${sale.registrationNumber} via ${paymentData.paymentMethod} - Cash Register: ${cashRegister.name}`,
          balance: newBalance,
          cashRegisterId: paymentData.cashRegisterId,
        }, { transaction });
        
      } else if (paymentData.paymentMethod.toUpperCase() === 'BANK_TRANSFER' || paymentData.paymentMethod.toUpperCase() === 'DEPOSIT') {
        // ✅ BANK Payment Collection
        const BankRegister = (await import('../models/BankRegister')).default;
        const BankAccount = (await import('../models/BankAccount')).default;
        
        // Validate bank account selection
        if (!paymentData.bankAccountId) {
          throw new Error('Bank account selection is required for bank transfer/deposit payments');
        }
        
        const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
        if (!bankAccount) {
          throw new Error('Bank account not found');
        }
        
        // Update bank account balance
        const currentBankBalance = Number(bankAccount.balance || 0);
        const newBankBalance = currentBankBalance + paymentData.amount;
        await bankAccount.update({ balance: newBankBalance }, { transaction });
        
        // Get last bank register transaction for THIS SPECIFIC bank account
        const lastBankTransaction = await BankRegister.findOne({
          where: {
            bankAccountId: paymentData.bankAccountId
          },
          order: [['id', 'DESC']],
          transaction
        });
        
        // Generate CJ registration number for bank collection
        const lastCJTransaction = await BankRegister.findOne({
          where: {
            registrationNumber: {
              [Op.like]: 'CJ%'
            }
          },
          order: [['id', 'DESC']],
          transaction
        });
        
        let nextBankNumber = 1;
        if (lastCJTransaction) {
          const lastNumber = parseInt(lastCJTransaction.registrationNumber.substring(2));
          nextBankNumber = lastNumber + 1;
        }
        
        const bankRegistrationNumber = `CJ${String(nextBankNumber).padStart(4, '0')}`;
        const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
        const newBalance = lastBalance + paymentData.amount;
        
        // Get client info for the bank register entry
        const client = await Client.findByPk(sale.clientId, { transaction });
        
        await BankRegister.create({
          registrationNumber: bankRegistrationNumber,
          registrationDate: new Date(),
          transactionType: 'INFLOW',
          sourceTransactionType: 'SALE_COLLECTION',
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Deposit',
          relatedDocumentType: 'Sale',
          relatedDocumentNumber: sale.registrationNumber,
          clientRnc: sale.clientRnc,
          clientName: client?.name || '',
          description: `Payment collection for sale ${sale.registrationNumber} via ${paymentData.paymentMethod} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          balance: newBalance,
          bankAccountId: paymentData.bankAccountId,
          bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
          originalPaymentType: paymentData.paymentMethod,
        }, { transaction });
      }
      
      // Update related Accounts Receivable records
      const AccountsReceivable = (await import('../models/AccountsReceivable')).default;
      await AccountsReceivable.update({
        receivedAmount: sequelize.literal(`receivedAmount + ${paymentData.amount}`),
        balanceAmount: sequelize.literal(`balanceAmount - ${paymentData.amount}`),
        status: newCollectedAmount >= Number(sale.total) ? 'Collected' : 'Partial'
      }, {
        where: {
          relatedDocumentNumber: sale.registrationNumber,
          status: { [Op.ne]: 'Collected' }
        },
        transaction
      });
    } else {
      console.log(`ℹ️ [Payment Collection] Sale ${sale.registrationNumber} was already paid during creation - no additional cash/bank register entry needed`);
    }
    
    await transaction.commit();
    committed = true;
    
    return await Sale.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: SaleItem, as: 'items' }
      ],
    });
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const deleteSale = async (id: number) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const sale = await Sale.findByPk(id, { transaction });
    if (!sale) throw new Error('Sale not found');
    
    const items = await SaleItem.findAll({
      where: { saleId: id },
      transaction
    });
    
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction });
      if (product) {
        // Restore stock and update subtotal
        const newAmount = Number(product.amount) + Number(item.quantity);
        const newSubtotal = newAmount * Number(product.unitCost);
        
        await product.update({
          amount: newAmount,
          subtotal: newSubtotal
        }, { transaction });
      }
    }
    
    await SaleItem.destroy({ where: { saleId: id }, transaction });
    await sale.destroy({ transaction });
    
    await transaction.commit();
    committed = true;
    return { message: 'Sale deleted successfully' };
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};
