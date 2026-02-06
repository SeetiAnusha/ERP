import Purchase from '../models/Purchase';
import PurchaseItem from '../models/PurchaseItem';
import AssociatedInvoice from '../models/AssociatedInvoice';
import Supplier from '../models/Supplier';
import Product from '../models/Product';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export const getAllPurchases = async () => {
  return await Purchase.findAll({
    include: [
      { model: Supplier, as: 'supplier' },
      { model: PurchaseItem, as: 'items' },
      { model: AssociatedInvoice, as: 'associatedInvoices' }
    ],
    order: [['registrationDate', 'DESC']],
  });
};

export const getPurchaseById = async (id: number) => {
  return await Purchase.findByPk(id, {
    include: [
      { model: Supplier, as: 'supplier' },
      { model: PurchaseItem, as: 'items' },
      { model: AssociatedInvoice, as: 'associatedInvoices' }
    ],
  });
};

export const createPurchase = async (data: any) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    // Generate registration number (CP format for purchases - Compra/Purchase)
    const lastPurchase = await Purchase.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CP%'
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
    
    const registrationNumber = `CP${String(nextNumber).padStart(4, '0')}`;
    
    // Calculate associated expenses total
    const associatedExpenses = data.associatedInvoices && data.associatedInvoices.length > 0
      ? data.associatedInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0)
      : 0;
    
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
    
    const purchase = await Purchase.create({
      ...data,
      registrationNumber,
      registrationDate: new Date(),
      paymentStatus,
      paidAmount,
      balanceAmount,
      additionalExpenses: associatedExpenses,
      totalWithAssociated: data.productTotal + associatedExpenses,
    }, { transaction });
    
    // Create associated invoices first
    if (data.associatedInvoices && data.associatedInvoices.length > 0) {
      for (const invoice of data.associatedInvoices) {
        await AssociatedInvoice.create({
          purchaseId: purchase.id,
          supplierRnc: invoice.supplierRnc,
          supplierName: invoice.supplierName,
          concept: invoice.concept,
          ncf: invoice.ncf,
          date: invoice.date,
          taxAmount: invoice.taxAmount,
          tax: invoice.tax,
          amount: invoice.amount,
          purchaseType: invoice.purchaseType || data.purchaseType,
          paymentType: invoice.paymentType,
        }, { transaction });
      }
    }
    
    // Distribute associated costs proportionally to items
    const productTotal = data.items.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
    
    // Create purchase items and update inventory
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        // Calculate proportional associated cost for this item
        const itemPercentage = productTotal > 0 ? Number(item.subtotal) / productTotal : 0;
        const itemAssociatedCost = associatedExpenses * itemPercentage;
        const adjustedTotal = Number(item.subtotal) + itemAssociatedCost;
        const adjustedUnitCost = item.quantity > 0 ? adjustedTotal / item.quantity : item.unitCost;
        
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
          adjustedUnitCost: adjustedUnitCost,
          adjustedTotal: adjustedTotal,
        }, { transaction });
        
        // Increase product stock and update subtotal
        const newAmount = Number(product.amount) + item.quantity;
        const newSubtotal = newAmount * adjustedUnitCost;
        
        await product.update({
          amount: newAmount,
          unitCost: adjustedUnitCost,
          subtotal: newSubtotal
        }, { transaction });
      }
    }
    
    await transaction.commit();
    committed = true;
    
    return await Purchase.findByPk(purchase.id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: PurchaseItem, as: 'items' },
        { model: AssociatedInvoice, as: 'associatedInvoices' }
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
    }, { transaction });
    
    await transaction.commit();
    committed = true;
    
    return await Purchase.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: PurchaseItem, as: 'items' },
        { model: AssociatedInvoice, as: 'associatedInvoices' }
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
    
    // Restore inventory - decrease stock by purchased quantity
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction });
      if (product) {
        const newAmount = Number(product.amount) - Number(item.quantity);
        const newSubtotal = newAmount * Number(product.unitCost);
        
        await product.update({
          amount: newAmount,
          subtotal: newSubtotal
        }, { transaction });
      }
    }
    
    // Delete associated invoices, items and purchase
    await AssociatedInvoice.destroy({ where: { purchaseId: id }, transaction });
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
