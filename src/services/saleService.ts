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
    
    // Calculate payment status based on payment type
    const total = data.total || 0;
    let paidAmount = 0;
    let balanceAmount = total;
    let paymentStatus = 'Unpaid';
    
    // Only CASH payment is marked as paid immediately
    // All other payment types (Bank Transfer, Deposit, Credit Card, Credit) require payment recording
    if (data.paymentType && data.paymentType.toUpperCase() === 'CASH') {
      paidAmount = total;
      balanceAmount = 0;
      paymentStatus = 'Paid';
    } else {
      // All other payment types are unpaid until payment is recorded
      paidAmount = 0;
      balanceAmount = total;
      paymentStatus = 'Unpaid';
    }
    
    const sale = await Sale.create({
      ...data,
      registrationNumber,
      registrationDate: new Date(),
      paymentStatus,
      paidAmount,
      balanceAmount,
    }, { transaction });
    
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        if (Number(product.amount) < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.amount}, Required: ${item.quantity}`);
        }
        
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
    
    const newPaidAmount = Number(sale.paidAmount) + paymentData.amount;
    const newBalanceAmount = Number(sale.total) - newPaidAmount;
    
    let paymentStatus = 'Unpaid';
    if (newPaidAmount >= Number(sale.total)) {
      paymentStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'Partial';
    }
    
    await sale.update({
      paidAmount: newPaidAmount,
      balanceAmount: newBalanceAmount,
      paymentStatus,
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
