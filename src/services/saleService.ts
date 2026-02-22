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
    
    if (paymentType === 'CASH') {
      // CASH: Collected immediately, cash balance increases (CashRegister entry created below)
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
    else if (paymentType === 'CREDIT_CARD') {
      // CREDIT CARD: Marked as collected (you made the sale), but card company owes you
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
    
    // Create CashRegister entry for immediate collections: CASH, Bank Transfer, or Deposit (INFLOW)
    if (paymentType === 'CASH' || paymentType === 'BANK_TRANSFER' || paymentType === 'DEPOSIT') {
      const CashRegister = (await import('../models/CashRegister')).default;
      
      // Get last cash register transaction for balance
      const lastCashTransaction = await CashRegister.findOne({
        where: { registrationNumber: { [Op.like]: 'CJ%' } },
        order: [['id', 'DESC']],
        transaction
      });
      
      let nextCashNumber = 1;
      if (lastCashTransaction) {
        const lastNumber = parseInt(lastCashTransaction.registrationNumber.substring(2));
        nextCashNumber = lastNumber + 1;
      }
      
      const cashRegistrationNumber = `CJ${String(nextCashNumber).padStart(4, '0')}`;
      const lastBalance = lastCashTransaction ? Number(lastCashTransaction.balance) : 0;
      const newBalance = lastBalance + total; // INFLOW increases balance
      
      const client = await Client.findByPk(data.clientId, { transaction });
      
      await CashRegister.create({
        registrationNumber: cashRegistrationNumber,
        registrationDate: new Date(),
        transactionType: 'INFLOW',
        amount: total,
        paymentMethod: paymentType === 'CASH' ? 'Cash' : (paymentType === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Deposit'),
        relatedDocumentType: 'Sale',
        relatedDocumentNumber: registrationNumber,
        clientRnc: data.clientRnc || '',
        clientName: client?.name || '',
        description: `Payment received for sale ${registrationNumber} via ${paymentType === 'CASH' ? 'Cash' : (paymentType === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Deposit')}`,
        balance: newBalance,
      }, { transaction });
    }
    
    // Create Accounts Receivable for credit card and credit sales
    if (paymentType === 'CREDIT_CARD' || paymentType === 'CREDIT') {
      const AccountsReceivable = (await import('../models/AccountsReceivable')).default;
      
      // Generate AR registration number
      const lastAR = await AccountsReceivable.findOne({
        where: { registrationNumber: { [Op.like]: 'AR%' } },
        order: [['id', 'DESC']],
        transaction
      });
      const nextARNumber = lastAR ? parseInt(lastAR.registrationNumber.substring(2)) + 1 : 1;
      const arRegistrationNumber = `AR${String(nextARNumber).padStart(4, '0')}`;
      
      // Get client info for credit sales
      const client = await Client.findByPk(data.clientId, { transaction });
      
      await AccountsReceivable.create({
        registrationNumber: arRegistrationNumber,
        registrationDate: new Date(),
        type: paymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_SALE' : 'CLIENT_CREDIT',
        relatedDocumentType: 'Sale',
        relatedDocumentId: sale.id,
        relatedDocumentNumber: registrationNumber,
        clientId: paymentType === 'CREDIT' ? data.clientId : undefined,
        clientName: paymentType === 'CREDIT_CARD' ? 'Credit Card Company' : (client?.name || ''),
        cardNetwork: paymentType === 'CREDIT_CARD' ? 'Credit Card Company' : undefined,
        amount: total,
        receivedAmount: 0,
        balanceAmount: total,
        status: 'Pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: paymentType === 'CREDIT_CARD'
          ? `Credit card payment for sale ${registrationNumber}`
          : `Credit sale to ${client?.name || 'client'} - ${registrationNumber}`,
      }, { transaction });
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
