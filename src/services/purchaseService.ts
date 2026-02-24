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
    // Calculate associated expenses total (use tax field which contains base amount without tax)
    const associatedExpenses = data.associatedInvoices && data.associatedInvoices.length > 0
      ? data.associatedInvoices.reduce((sum: number, inv: any) => sum + Number(inv.tax), 0)
      : 0;
    
    // Calculate payment status based on payment type
    const total = data.total || 0;
    let paidAmount = 0;
    let balanceAmount = total;
    let paymentStatus = 'Unpaid';
    
    const paymentType = data.paymentType ? data.paymentType.toUpperCase() : '';
    
    if (paymentType === 'CASH') {
      // CASH: Paid immediately, cash balance decreases (CashRegister entry created below)
      paidAmount = total;
      balanceAmount = 0;
      paymentStatus = 'Paid';
    } 
    else if (paymentType === 'BANK_TRANSFER' || paymentType === 'DEPOSIT') {
      // BANK TRANSFER or DEPOSIT: Paid immediately, bank balance reduces
      paidAmount = total;
      balanceAmount = 0;
      paymentStatus = 'Paid';
      // Will create CashRegister entry (OUTFLOW) below after purchase is created
    }
    else if (paymentType === 'CREDIT_CARD') {
      // CREDIT CARD: Marked as paid (supplier got money), but you owe card company
      paidAmount = total;
      balanceAmount = 0;
      paymentStatus = 'Paid';
    }
    else if (paymentType === 'CREDIT') {
      // CREDIT: Not paid yet, will pay later
      paidAmount = 0;
      balanceAmount = total;
      paymentStatus = 'Unpaid';
    }
    else {
      // Default: treat as unpaid
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
    
    // Create CashRegister entry for immediate payments: CASH, Bank Transfer, or Deposit (OUTFLOW)
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
      const newBalance = lastBalance - total; // OUTFLOW reduces balance
      
      const supplier = await Supplier.findByPk(data.supplierId, { transaction });
      
      await CashRegister.create({
        registrationNumber: cashRegistrationNumber,
        registrationDate: new Date(),
        transactionType: 'OUTFLOW',
        amount: total,
        paymentMethod: paymentType === 'CASH' ? 'Cash' : (paymentType === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Deposit'),
        relatedDocumentType: 'Purchase',
        relatedDocumentNumber: registrationNumber,
        clientRnc: data.supplierRnc || '',
        clientName: supplier?.name || '',
        description: `Payment for purchase ${registrationNumber} via ${paymentType === 'CASH' ? 'Cash' : (paymentType === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Deposit')}`,
        balance: newBalance,
      }, { transaction });
    }
    
    // Create Accounts Payable for credit card and credit purchases
    if (paymentType === 'CREDIT_CARD' || paymentType === 'CREDIT') {
      const AccountsPayable = (await import('../models/AccountsPayable')).default;
      
      // Generate AP registration number for main purchase
      const lastAP = await AccountsPayable.findOne({
        where: { registrationNumber: { [Op.like]: 'AP%' } },
        order: [['id', 'DESC']],
        transaction
      });
      let nextAPNumber = lastAP ? parseInt(lastAP.registrationNumber.substring(2)) + 1 : 1;
      const apRegistrationNumber = `AP${String(nextAPNumber).padStart(4, '0')}`;
      
      // Get supplier info for credit purchases
      const supplier = await Supplier.findByPk(data.supplierId, { transaction });
      
      // Create AP for main purchase (product total only, not including associated invoices)
      await AccountsPayable.create({
        registrationNumber: apRegistrationNumber,
        registrationDate: new Date(),
        type: paymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'SUPPLIER_CREDIT',
        relatedDocumentType: 'Purchase',
        relatedDocumentId: purchase.id,
        relatedDocumentNumber: registrationNumber,
        supplierId: paymentType === 'CREDIT' ? data.supplierId : undefined,
        supplierName: paymentType === 'CREDIT_CARD' ? 'Credit Card Company' : (supplier?.name || ''),
        supplierRnc: data.supplierRnc || '',
        ncf: data.ncf || '',
        purchaseDate: data.date ? new Date(data.date) : new Date(),
        purchaseType: data.purchaseType,
        paymentType: paymentType,
        cardIssuer: paymentType === 'CREDIT_CARD' ? 'Credit Card Company' : undefined,
        amount: data.productTotal, // Only product total, not including associated invoices
        paidAmount: 0,
        balanceAmount: data.productTotal,
        status: 'Pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: paymentType === 'CREDIT_CARD' 
          ? `Credit card payment for purchase ${registrationNumber}`
          : `Credit purchase from ${supplier?.name || 'supplier'} - ${registrationNumber}`,
      }, { transaction });
      
      // Create separate AP entries for each associated invoice (if CREDIT payment type)
      if (paymentType === 'CREDIT' && data.associatedInvoices && data.associatedInvoices.length > 0) {
        console.log('🔍 Creating AP for invoices. Main purchase payment type:', paymentType);
        console.log('🔍 Number of invoices:', data.associatedInvoices.length);
        
        for (const invoice of data.associatedInvoices) {
          console.log('🔍 Processing invoice:', {
            supplierName: invoice.supplierName,
            supplierRnc: invoice.supplierRnc,
            ncf: invoice.ncf,
            paymentType: invoice.paymentType,
            purchaseType: invoice.purchaseType,
            amount: invoice.amount
          });
          
          nextAPNumber++;
          const invoiceAPNumber = `AP${String(nextAPNumber).padStart(4, '0')}`;
          
          // Determine if this invoice should create AP based on its payment type
          const invoicePaymentType = invoice.paymentType ? invoice.paymentType.toUpperCase() : 'CREDIT';
          
          const apData = {
            registrationNumber: invoiceAPNumber,
            registrationDate: new Date(),
            type: invoicePaymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'SUPPLIER_CREDIT',
            relatedDocumentType: 'Purchase',
            relatedDocumentId: purchase.id,
            relatedDocumentNumber: registrationNumber,
            supplierName: invoice.supplierName || 'Unknown Supplier',
            supplierRnc: invoice.supplierRnc || '',
            ncf: invoice.ncf || '',
            purchaseDate: invoice.date ? new Date(invoice.date) : new Date(),
            purchaseType: invoice.purchaseType || data.purchaseType,
            paymentType: invoicePaymentType,
            amount: invoice.amount, // Total amount including tax
            paidAmount: 0,
            balanceAmount: invoice.amount,
            status: 'Pending',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `${invoice.concept || 'Associated cost'} for purchase ${registrationNumber} - Supplier: ${invoice.supplierName} - RNC: ${invoice.supplierRnc || 'N/A'}`,
          };
          
          console.log('🔍 Creating AP with data:', apData);
          
          // Create AP for ALL invoices (removed payment type check)
          await AccountsPayable.create(apData, { transaction });
          
          console.log('✅ AP created successfully:', invoiceAPNumber);
        }
      }
      
      // Create AP for ALL associated invoices regardless of main purchase payment type
      // This handles cases where main purchase is CASH but invoices need AP
      if (paymentType !== 'CREDIT' && data.associatedInvoices && data.associatedInvoices.length > 0) {
        for (const invoice of data.associatedInvoices) {
          const invoicePaymentType = invoice.paymentType ? invoice.paymentType.toUpperCase() : '';
          
          const lastAP = await AccountsPayable.findOne({
            where: { registrationNumber: { [Op.like]: 'AP%' } },
            order: [['id', 'DESC']],
            transaction
          });
          const nextAPNum = lastAP ? parseInt(lastAP.registrationNumber.substring(2)) + 1 : 1;
          const invoiceAPNumber = `AP${String(nextAPNum).padStart(4, '0')}`;
          
          // Create AP for ALL invoices (removed payment type check)
          await AccountsPayable.create({
            registrationNumber: invoiceAPNumber,
            registrationDate: new Date(),
            type: invoicePaymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'SUPPLIER_CREDIT',
            relatedDocumentType: 'Purchase',
            relatedDocumentId: purchase.id,
            relatedDocumentNumber: registrationNumber,
            supplierName: invoice.supplierName || 'Unknown Supplier',
            supplierRnc: invoice.supplierRnc || '',
            ncf: invoice.ncf || '',
            purchaseDate: invoice.date ? new Date(invoice.date) : new Date(),
            purchaseType: invoice.purchaseType || data.purchaseType,
            paymentType: invoicePaymentType,
            amount: invoice.amount,
            paidAmount: 0,
            balanceAmount: invoice.amount,
            status: 'Pending',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `${invoice.concept || 'Associated cost'} for purchase ${registrationNumber} - Supplier: ${invoice.supplierName} - RNC: ${invoice.supplierRnc || 'N/A'}`,
          }, { transaction });
        }
      }
    }
    
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
          unitOfMeasurement: item.unitOfMeasurement || product.unit,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          tax: item.tax,
          total: item.total,
          adjustedUnitCost: adjustedUnitCost,
          adjustedTotal: adjustedTotal,
        }, { transaction });
        
        // Calculate WEIGHTED AVERAGE cost (not just overwrite)
        // Formula: (old inventory value + new purchase value) / total quantity
        const oldInventoryValue = Number(product.amount) * Number(product.unitCost);
        const newPurchaseValue = adjustedTotal;
        const totalInventoryValue = oldInventoryValue + newPurchaseValue;
        const newAmount = Number(product.amount) + item.quantity;
        const weightedAverageCost = newAmount > 0 ? totalInventoryValue / newAmount : adjustedUnitCost;
        const newSubtotal = newAmount * weightedAverageCost;
        
        // Update product unit and tax if provided in purchase item
        const updateData: any = {
          amount: newAmount,
          unitCost: weightedAverageCost,  // Use weighted average, not just new cost
          subtotal: newSubtotal
        };
        
        // If unit of measurement is provided in purchase, update the product's unit
        if (item.unitOfMeasurement && item.unitOfMeasurement !== product.unit) {
          updateData.unit = item.unitOfMeasurement;
        }
        
        // If tax is provided in purchase, update the product's tax (absolute amount)
        if (item.tax > 0) {
          updateData.taxRate = item.tax;  // Store absolute tax amount
        }
        
        await product.update(updateData, { transaction });
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
