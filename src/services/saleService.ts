import Sale from '../models/Sale';
import SaleItem from '../models/SaleItem';
import Client from '../models/Client';
import Product from '../models/Product';
import { Op } from 'sequelize';
import sequelize from '../config/database';

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
    
    // ✅ VALIDATION: For DEBIT_CARD, require card selection (CREDIT_CARD doesn't need card selection)
    if (paymentType === 'DEBIT_CARD') {
      if (!data.cardId) {
        throw new Error(
          `Card selection is required for debit card payments. ` +
          `Please select a card to process this sale.`
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
      // DEBIT/CREDIT CARD: Marked as collected (you made the sale), but card company owes you
      collectedAmount = total;
      balanceAmount = 0;
      collectionStatus = 'Collected';
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
      }, { transaction });
    }
    
    // Create Accounts Receivable for debit/credit card and credit sales
    if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD' || paymentType === 'CREDIT') {
      const AccountsReceivable = (await import('../models/AccountsReceivable')).default;
      const Card = (await import('../models/Card')).default;
      const BankAccount = (await import('../models/BankAccount')).default;
      const BankRegister = (await import('../models/BankRegister')).default;
      
      // Get client info
      const client = await Client.findByPk(data.clientId, { transaction });
      
      if (paymentType === 'DEBIT_CARD') {
        // ✅ DEBIT CARD SALE: Handle debit card payments (requires card selection)
        const card = await Card.findByPk(data.cardId, { transaction });
        if (!card) {
          throw new Error('Card not found');
        }
        
        // ✅ Validate card type matches payment type
        if (card.cardType !== 'DEBIT') {
          throw new Error(
            `Selected card ****${card.cardNumberLast4} is a ${card.cardType} card, not a DEBIT card. ` +
            `Please select a DEBIT card or change payment type to CREDIT_CARD.`
          );
        }
        
        const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
        
        // DEBIT Card Sale: Money goes to YOUR bank account immediately
        if (!card.bankAccountId) {
          throw new Error(
            `DEBIT card ****${card.cardNumberLast4} is not linked to a bank account. ` +
            `Please link this card to a bank account before processing sales.`
          );
        }
        
        const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
        if (!bankAccount) {
          throw new Error(
            `Bank account not found for DEBIT card ****${card.cardNumberLast4}.`
          );
        }
        
        // Add money to bank account
        const newBankBalance = Number(bankAccount.balance) + total;
        await bankAccount.update({ balance: newBankBalance }, { transaction });
        
        // Create Bank Register INFLOW entry
        const lastBankTransaction = await BankRegister.findOne({
          order: [['id', 'DESC']],
          transaction
        });
        
        const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
        const newBalance = lastBalance + total;
        
        await BankRegister.create({
          registrationNumber: registrationNumber,
          registrationDate: new Date(),
          transactionType: 'INFLOW',
          amount: total,
          paymentMethod: 'Debit Card',
          relatedDocumentType: 'Sale',
          relatedDocumentNumber: registrationNumber,
          clientRnc: data.clientRnc || '',
          clientName: client?.name || '',
          ncf: data.ncf || '',
          description: `Sale ${registrationNumber} via DEBIT card ${cardInfo} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          balance: newBalance,
          bankAccountId: card.bankAccountId,
        }, { transaction });
        
        // No AR needed for DEBIT card (money received immediately)
        
      } else if (paymentType === 'CREDIT_CARD') {
        // ✅ CREDIT CARD SALE: Generic credit card payment (no specific card selection needed)
        // Create Accounts Receivable for credit card company
        await AccountsReceivable.create({
          registrationNumber: registrationNumber,
          registrationDate: new Date(),
          type: 'CREDIT_CARD_SALE',
          relatedDocumentType: 'Sale',
          relatedDocumentId: sale.id,
          relatedDocumentNumber: registrationNumber,
          clientName: `Credit Card Company`,
          clientRnc: data.clientRnc || '',
          ncf: data.ncf || '',
          saleOf: data.saleType || 'Merchandise for sale',
          amount: total,
          receivedAmount: 0,
          balanceAmount: total,
          status: 'Pending',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for card company
          notes: `CREDIT card sale ${registrationNumber} - Card company owes you`,
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

export const collectPayment = async (id: number, paymentData: { amount: number; paymentMethod: string }) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const sale = await Sale.findByPk(id, { transaction });
    if (!sale) throw new Error('Sale not found');
    
    const newCollectedAmount = Number(sale.collectedAmount) + paymentData.amount;  // Changed from paidAmount
    const newBalanceAmount = Number(sale.total) - newCollectedAmount;
    
    let collectionStatus = 'Not Collected';  // Changed from paymentStatus = 'Unpaid'
    if (newCollectedAmount >= Number(sale.total)) {
      collectionStatus = 'Collected';  // Changed from 'Paid'
    } else if (newCollectedAmount > 0) {
      collectionStatus = 'Partial';
    }
    
    await sale.update({
      collectedAmount: newCollectedAmount,  // Changed from paidAmount
      balanceAmount: newBalanceAmount,
      collectionStatus,  // Changed from paymentStatus
    }, { transaction });
    
    // Create cash register entry for payment collection
    const CashRegister = (await import('../models/CashRegister')).default;
      
      // Get last cash register transaction for balance
      const lastCashTransaction = await CashRegister.findOne({
        where: {
          registrationNumber: {
            [Op.like]: 'CJ%'
          }
        },
        order: [['id', 'DESC']],
        transaction
      });
      
      let nextCashNumber = 1;
      if (lastCashTransaction) {
        const lastNumber = parseInt(lastCashTransaction.registrationNumber.substring(2));
        nextCashNumber = lastNumber + 1;
      }
      
      const cashRegistrationNumber = `CJ${String(nextCashNumber).padStart(4, '0')}`;
      const lastBalance = lastCashTransaction ? lastCashTransaction.balance : 0;
      const newBalance = Number(lastBalance) + paymentData.amount;
      
      await CashRegister.create({
        registrationNumber: cashRegistrationNumber,
        registrationDate: new Date(),
        transactionType: 'INFLOW',
        amount: paymentData.amount,
        paymentMethod: 'Cash',
        relatedDocumentType: 'Sale',
        relatedDocumentNumber: sale.registrationNumber,
        clientRnc: sale.clientRnc,
        description: `Payment received for sale ${sale.registrationNumber}`,
        balance: newBalance,
      }, { transaction });
    
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
