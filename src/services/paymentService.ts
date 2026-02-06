import Payment from '../models/Payment';
import Purchase from '../models/Purchase';
import Sale from '../models/Sale';
import Client from '../models/Client';
import Supplier from '../models/Supplier';
import PaymentInvoiceApplication from '../models/PaymentInvoiceApplication';
import SupplierCredit from '../models/SupplierCredit';
import ClientCredit from '../models/ClientCredit';
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

interface InvoiceApplication {
  invoiceId: number;
  invoiceNumber: string;
  appliedAmount: number;
}

export const createPayment = async (data: any) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('=== CREATE PAYMENT START ===');
    console.log('Payment data received:', JSON.stringify(data, null, 2));
    
    // Generate registration number (PG format for payments - Pago/Payment)
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
    console.log('Generated registration number:', registrationNumber);
    
    // Parse invoice applications from frontend
    const invoiceApplications: InvoiceApplication[] = data.invoiceApplications ? 
      (typeof data.invoiceApplications === 'string' ? JSON.parse(data.invoiceApplications) : data.invoiceApplications) : [];
    
    console.log('Invoice applications parsed:', invoiceApplications);
    
    let totalApplied = 0;
    const appliedInvoices: any[] = [];
    
    // Apply payment to each selected invoice
    if (invoiceApplications && invoiceApplications.length > 0) {
      for (const application of invoiceApplications) {
        if (application.appliedAmount > 0) {
          if (data.type === 'Payment Out' && data.relatedEntityType === 'Purchase') {
            // Apply to purchase
            const purchase = await Purchase.findByPk(application.invoiceId, { transaction });
            if (purchase) {
              const currentBalance = parseFloat(purchase.balanceAmount.toString());
              const amountToApply = Math.min(application.appliedAmount, currentBalance);
              
              const newPaidAmount = parseFloat(purchase.paidAmount.toString()) + amountToApply;
              const totalAmount = parseFloat(purchase.total.toString());
              const newBalanceAmount = totalAmount - newPaidAmount;
              
              // Determine payment status with proper precision
              let paymentStatus = 'Unpaid';
              if (Math.abs(newBalanceAmount) < 0.01) {
                // Balance is essentially zero (accounting for floating point)
                paymentStatus = 'Paid';
              } else if (newPaidAmount > 0 && newBalanceAmount > 0) {
                // Some paid, some remaining
                paymentStatus = 'Partial';
              }
              
              console.log('Payment application:', {
                purchaseId: purchase.id,
                total: totalAmount,
                previousPaid: purchase.paidAmount,
                amountApplied: amountToApply,
                newPaidAmount,
                newBalanceAmount,
                paymentStatus
              });
              
              await purchase.update({
                paidAmount: newPaidAmount,
                balanceAmount: Math.max(0, newBalanceAmount),
                paymentStatus
              }, { transaction });
              
              totalApplied += amountToApply;
              appliedInvoices.push({
                invoiceType: 'Purchase',
                invoiceId: purchase.id,
                invoiceNumber: purchase.registrationNumber,
                appliedAmount: amountToApply
              });
            }
          } else if (data.type === 'Payment In' && data.relatedEntityType === 'Sale') {
            // Apply to sale
            const sale = await Sale.findByPk(application.invoiceId, { transaction });
            if (sale) {
              const currentBalance = parseFloat(sale.balanceAmount.toString());
              const amountToApply = Math.min(application.appliedAmount, currentBalance);
              
              const newPaidAmount = parseFloat(sale.paidAmount.toString()) + amountToApply;
              const totalAmount = parseFloat(sale.total.toString());
              const newBalanceAmount = totalAmount - newPaidAmount;
              
              // Determine payment status with proper precision
              let paymentStatus = 'Unpaid';
              if (Math.abs(newBalanceAmount) < 0.01) {
                // Balance is essentially zero (accounting for floating point)
                paymentStatus = 'Paid';
              } else if (newPaidAmount > 0 && newBalanceAmount > 0) {
                // Some paid, some remaining
                paymentStatus = 'Partial';
              }
              
              console.log('Payment application:', {
                saleId: sale.id,
                total: totalAmount,
                previousPaid: sale.paidAmount,
                amountApplied: amountToApply,
                newPaidAmount,
                newBalanceAmount,
                paymentStatus
              });
              
              await sale.update({
                paidAmount: newPaidAmount,
                balanceAmount: Math.max(0, newBalanceAmount),
                paymentStatus
              }, { transaction });
              
              totalApplied += amountToApply;
              appliedInvoices.push({
                invoiceType: 'Sale',
                invoiceId: sale.id,
                invoiceNumber: sale.registrationNumber,
                appliedAmount: amountToApply
              });
            }
          }
        }
      }
    }
    
    // Calculate excess amount (overpayment)
    const paymentAmount = parseFloat(data.paymentAmount);
    const excessAmount = paymentAmount - totalApplied;
    
    // Create payment record
    const payment = await Payment.create({
      ...data,
      registrationNumber,
      invoiceApplications: JSON.stringify(appliedInvoices),
      excessAmount: excessAmount > 0 ? excessAmount : 0,
    }, { transaction });
    
    // Create payment invoice application records
    for (const applied of appliedInvoices) {
      await PaymentInvoiceApplication.create({
        paymentId: payment.id,
        invoiceType: applied.invoiceType,
        invoiceId: applied.invoiceId,
        invoiceNumber: applied.invoiceNumber,
        appliedAmount: applied.appliedAmount,
      }, { transaction });
    }
    
    // Handle overpayment - create credit balance
    if (excessAmount > 0.01) {
      if (data.type === 'Payment Out') {
        // Create supplier credit
        await SupplierCredit.create({
          supplierId: data.relatedEntityId,
          supplierRnc: data.supplierRnc,
          supplierName: data.supplierName,
          paymentId: payment.id,
          creditAmount: excessAmount,
          usedAmount: 0,
          remainingAmount: excessAmount,
          registrationDate: data.registrationDate,
          status: 'Active',
          notes: `Overpayment from payment ${registrationNumber}`,
        }, { transaction });
      } else if (data.type === 'Payment In') {
        // Create client credit
        await ClientCredit.create({
          clientId: data.relatedEntityId,
          clientRnc: data.clientRnc,
          clientName: data.clientName,
          paymentId: payment.id,
          creditAmount: excessAmount,
          usedAmount: 0,
          remainingAmount: excessAmount,
          registrationDate: data.registrationDate,
          status: 'Active',
          notes: `Overpayment from payment ${registrationNumber}`,
        }, { transaction });
      }
    }
    
    await transaction.commit();
    console.log('=== CREATE PAYMENT SUCCESS ===');
    console.log('Payment created:', payment.id);
    console.log('Total applied:', totalApplied);
    console.log('Applied invoices:', appliedInvoices);
    return payment;
  } catch (error) {
    await transaction.rollback();
    console.error('=== CREATE PAYMENT ERROR ===');
    console.error(error);
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
    
    // Get all invoice applications for this payment
    const applications = await PaymentInvoiceApplication.findAll({
      where: { paymentId: id },
      transaction
    });
    
    // Reverse the payment effect on each invoice
    for (const app of applications) {
      if (app.invoiceType === 'Purchase') {
        const purchase = await Purchase.findByPk(app.invoiceId, { transaction });
        if (purchase) {
          const newPaidAmount = parseFloat(purchase.paidAmount.toString()) - parseFloat(app.appliedAmount.toString());
          const newBalanceAmount = parseFloat(purchase.total.toString()) - newPaidAmount;
          
          await purchase.update({
            paidAmount: Math.max(0, newPaidAmount),
            balanceAmount: newBalanceAmount,
            paymentStatus: newBalanceAmount <= 0.01 ? 'Paid' : 
                          newBalanceAmount < parseFloat(purchase.total.toString()) ? 'Partial' : 'Unpaid'
          }, { transaction });
        }
      } else if (app.invoiceType === 'Sale') {
        const sale = await Sale.findByPk(app.invoiceId, { transaction });
        if (sale) {
          const newPaidAmount = parseFloat(sale.paidAmount.toString()) - parseFloat(app.appliedAmount.toString());
          const newBalanceAmount = parseFloat(sale.total.toString()) - newPaidAmount;
          
          await sale.update({
            paidAmount: Math.max(0, newPaidAmount),
            balanceAmount: newBalanceAmount,
            paymentStatus: newBalanceAmount <= 0.01 ? 'Paid' : 
                          newBalanceAmount < parseFloat(sale.total.toString()) ? 'Partial' : 'Unpaid'
          }, { transaction });
        }
      }
    }
    
    // Delete invoice applications
    await PaymentInvoiceApplication.destroy({
      where: { paymentId: id },
      transaction
    });
    
    // Delete any credit balances created by this payment
    await SupplierCredit.destroy({
      where: { paymentId: id },
      transaction
    });
    
    await ClientCredit.destroy({
      where: { paymentId: id },
      transaction
    });
    
    // Delete the payment
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
      status: {
        [Op.in]: ['Active', 'COMPLETED', 'Completed']
      }
    },
    include: [{
      model: Supplier,
      as: 'supplier'
    }],
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
      status: {
        [Op.in]: ['Active', 'COMPLETED', 'Completed']
      }
    },
    include: [{
      model: Client,
      as: 'client'
    }],
    order: [['date', 'ASC']]
  });
};

// Get supplier credits
export const getSupplierCredits = async (supplierId: number) => {
  return await SupplierCredit.findAll({
    where: {
      supplierId,
      status: 'Active',
      remainingAmount: {
        [Op.gt]: 0
      }
    },
    order: [['registrationDate', 'ASC']]
  });
};

// Get client credits
export const getClientCredits = async (clientId: number) => {
  return await ClientCredit.findAll({
    where: {
      clientId,
      status: 'Active',
      remainingAmount: {
        [Op.gt]: 0
      }
    },
    order: [['registrationDate', 'ASC']]
  });
};
