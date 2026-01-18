import Payment from '../models/Payment';
import Purchase from '../models/Purchase';
import Sale from '../models/Sale';
import Client from '../models/Client';
import Supplier from '../models/Supplier';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export const getAllPayments = async () => {
  return await Payment.findAll({ 
    order: [['registrationDate', 'DESC']],
    raw: true
  });
};

export const getPaymentById = async (id: number) => {
  return await Payment.findByPk(id);
};

export const createPayment = async (data: any) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Generate registration number (PG format for payments)
    const lastPayment = await Payment.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'PG%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastPayment) {
      const lastNumber = parseInt(lastPayment.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `PG${String(nextNumber).padStart(4, '0')}`;
    
    // Create payment
    const payment = await Payment.create({
      ...data,
      registrationNumber,
    }, { transaction });
    
    // Update related entity (Purchase or Sale)
    if (data.relatedEntityType === 'Purchase' && data.relatedEntityId) {
      const purchase = await Purchase.findByPk(data.relatedEntityId, { transaction });
      if (purchase) {
        const newPaidAmount = parseFloat(purchase.paidAmount.toString()) + parseFloat(data.paymentAmount);
        const newBalanceAmount = parseFloat(purchase.total.toString()) - newPaidAmount;
        
        await purchase.update({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newBalanceAmount <= 0 ? 'Paid' : newBalanceAmount < parseFloat(purchase.total.toString()) ? 'Partial' : 'Unpaid'
        }, { transaction });
      }
    } else if (data.relatedEntityType === 'Sale' && data.relatedEntityId) {
      const sale = await Sale.findByPk(data.relatedEntityId, { transaction });
      if (sale) {
        const newPaidAmount = parseFloat(sale.paidAmount.toString()) + parseFloat(data.paymentAmount);
        const newBalanceAmount = parseFloat(sale.total.toString()) - newPaidAmount;
        
        await sale.update({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newBalanceAmount <= 0 ? 'Paid' : newBalanceAmount < parseFloat(sale.total.toString()) ? 'Partial' : 'Unpaid'
        }, { transaction });
      }
    }
    
    await transaction.commit();
    return payment;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const updatePayment = async (id: number, data: any) => {
  const payment = await Payment.findByPk(id);
  if (!payment) throw new Error('Payment not found');
  return await payment.update(data);
};

export const deletePayment = async (id: number) => {
  const transaction = await sequelize.transaction();
  
  try {
    const payment = await Payment.findByPk(id, { transaction });
    if (!payment) throw new Error('Payment not found');
    
    // Reverse the payment effect on related entity
    if (payment.relatedEntityType === 'Purchase' && payment.relatedEntityId) {
      const purchase = await Purchase.findByPk(payment.relatedEntityId, { transaction });
      if (purchase) {
        const newPaidAmount = parseFloat(purchase.paidAmount.toString()) - parseFloat(payment.paymentAmount.toString());
        const newBalanceAmount = parseFloat(purchase.total.toString()) - newPaidAmount;
        
        await purchase.update({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newBalanceAmount <= 0 ? 'Paid' : newBalanceAmount < parseFloat(purchase.total.toString()) ? 'Partial' : 'Unpaid'
        }, { transaction });
      }
    } else if (payment.relatedEntityType === 'Sale' && payment.relatedEntityId) {
      const sale = await Sale.findByPk(payment.relatedEntityId, { transaction });
      if (sale) {
        const newPaidAmount = parseFloat(sale.paidAmount.toString()) - parseFloat(payment.paymentAmount.toString());
        const newBalanceAmount = parseFloat(sale.total.toString()) - newPaidAmount;
        
        await sale.update({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newBalanceAmount <= 0 ? 'Paid' : newBalanceAmount < parseFloat(sale.total.toString()) ? 'Partial' : 'Unpaid'
        }, { transaction });
      }
    }
    
    await payment.destroy({ transaction });
    await transaction.commit();
    return { message: 'Payment deleted successfully' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Get outstanding purchases for a supplier
export const getOutstandingPurchases = async (supplierId: number) => {
  return await Purchase.findAll({
    where: {
      supplierId,
      balanceAmount: {
        [Op.gt]: 0
      },
      status: 'Active'
    },
    order: [['date', 'ASC']]
  });
};

// Get outstanding sales for a client
export const getOutstandingSales = async (clientId: number) => {
  return await Sale.findAll({
    where: {
      clientId,
      balanceAmount: {
        [Op.gt]: 0
      },
      status: 'Active'
    },
    order: [['date', 'ASC']]
  });
};
