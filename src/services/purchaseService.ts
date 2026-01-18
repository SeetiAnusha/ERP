import Purchase from '../models/Purchase';
import PurchaseItem from '../models/PurchaseItem';
import Supplier from '../models/Supplier';
import Product from '../models/Product';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export const getAllPurchases = async () => {
  return await Purchase.findAll({
    include: [
      { model: Supplier, as: 'supplier' },
      { model: PurchaseItem, as: 'items' }
    ],
    order: [['registrationDate', 'DESC']],
  });
};

export const getPurchaseById = async (id: number) => {
  return await Purchase.findByPk(id, {
    include: [
      { model: Supplier, as: 'supplier' },
      { model: PurchaseItem, as: 'items' }
    ],
  });
};

export const createPurchase = async (data: any) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    // Generate registration number (RC format)
    const lastPurchase = await Purchase.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'RC%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastPurchase) {
      const lastNumber = parseInt(lastPurchase.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `RC${String(nextNumber).padStart(4, '0')}`;
    
    // Calculate payment status
    const total = data.total || 0;
    const paidAmount = data.paidAmount || 0;
    const balanceAmount = total - paidAmount;
    
    let paymentStatus = 'Unpaid';
    if (paidAmount >= total) {
      paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'Partial';
    }
    
    const purchase = await Purchase.create({
      ...data,
      registrationNumber,
      registrationDate: new Date(),
      paymentStatus,
      paidAmount,
      balanceAmount,
    }, { transaction });
    
    // Create purchase items and update inventory
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        await PurchaseItem.create({
          purchaseId: purchase.id,
          productId: item.productId,
          productCode: product.code,
          productName: product.name,
          unitOfMeasurement: product.unit,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          tax: item.tax,
          total: item.total,
        }, { transaction });
        
        // Increase inventory
        await product.update({
          quantity: Number(product.quantity) + item.quantity,
          costPrice: item.unitCost // Update cost price with latest purchase price
        }, { transaction });
      }
    }
    
    await transaction.commit();
    committed = true;
    
    return await Purchase.findByPk(purchase.id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: PurchaseItem, as: 'items' }
      ],
    });
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const updatePurchase = async (id: number, data: any) => {
  const purchase = await Purchase.findByPk(id);
  if (!purchase) throw new Error('Purchase not found');
  return await purchase.update(data);
};

export const collectPayment = async (id: number, paymentData: { amount: number; paymentMethod: string }) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const purchase = await Purchase.findByPk(id, { transaction });
    if (!purchase) throw new Error('Purchase not found');
    
    const newPaidAmount = Number(purchase.paidAmount) + paymentData.amount;
    const newBalanceAmount = Number(purchase.total) - newPaidAmount;
    
    let paymentStatus = 'Unpaid';
    if (newPaidAmount >= Number(purchase.total)) {
      paymentStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'Partial';
    }
    
    await purchase.update({
      paidAmount: newPaidAmount,
      balanceAmount: newBalanceAmount,
      paymentStatus,
      paymentMethod: paymentData.paymentMethod,
    }, { transaction });
    
    await transaction.commit();
    committed = true;
    
    return await Purchase.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: PurchaseItem, as: 'items' }
      ],
    });
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const deletePurchase = async (id: number) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const purchase = await Purchase.findByPk(id, { transaction });
    if (!purchase) throw new Error('Purchase not found');
    
    // Get purchase items to restore inventory
    const items = await PurchaseItem.findAll({
      where: { purchaseId: id },
      transaction
    });
    
    // Restore inventory
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction });
      if (product) {
        await product.update({
          quantity: Number(product.quantity) - Number(item.quantity)
        }, { transaction });
      }
    }
    
    // Delete items and purchase
    await PurchaseItem.destroy({ where: { purchaseId: id }, transaction });
    await purchase.destroy({ transaction });
    
    await transaction.commit();
    committed = true;
    return { message: 'Purchase deleted successfully' };
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};
