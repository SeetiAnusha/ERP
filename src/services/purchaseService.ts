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
  console.log('🚀 CREATE PURCHASE - Received data:', JSON.stringify(data, null, 2));
  console.log('🔍 Associated invoices in request:', data.associatedInvoices);
  console.log('🔍 Associated invoices length:', data.associatedInvoices ? data.associatedInvoices.length : 'undefined');
  
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
    
    // Calculate main purchase amount (without associated invoices)
    const mainPurchaseAmount = data.productTotal || (total - associatedExpenses) || total;
    
    let paidAmount = 0;
    let balanceAmount = total;
    let paymentStatus = 'Unpaid';
    
    const paymentType = data.paymentType ? data.paymentType.toUpperCase() : '';
    
    // Validate required fields based on payment type
    if (paymentType === 'CHEQUE') {
      if (!data.bankAccountId || !data.chequeNumber || !data.chequeDate) {
        throw new Error('Bank account, cheque number, and cheque date are required for cheque payments');
      }
      paidAmount = total;
      balanceAmount = 0;
      paymentStatus = 'Paid';
    }
    else if (paymentType === 'BANK_TRANSFER') {
      if (!data.bankAccountId || !data.transferNumber || !data.transferDate) {
        throw new Error('Bank account, transfer number, and transfer date are required for bank transfer payments');
      }
      paidAmount = total;
      balanceAmount = 0;
      paymentStatus = 'Paid';
    }
    else if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') {
      if (!data.cardId || !data.paymentReference || !data.voucherDate) {
        throw new Error('Card, payment reference, and voucher date are required for card payments');
      }
      // ✅ Payment status depends on card type (DEBIT vs CREDIT)
      // Initially mark as unpaid (will update if DEBIT card)
      paidAmount = 0;
      balanceAmount = total;
      paymentStatus = 'Unpaid';
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
      totalWithAssociated: mainPurchaseAmount + associatedExpenses,
    }, { transaction });
    
    // NOTE: Cash Register is ONLY for SALES (customer payments), not for purchases
    // Purchases are paid through bank accounts or credit
    
    // Create Bank Register entry for CHEQUE and BANK_TRANSFER payments (OUTFLOW)
    if (paymentType === 'CHEQUE' || paymentType === 'BANK_TRANSFER') {
      const BankRegister = (await import('../models/BankRegister')).default;
      const BankAccount = (await import('../models/BankAccount')).default;
      
      // Get the bank account
      const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }
      
      // ✅ VALIDATION: Check if bank account has sufficient balance
      const currentBalance = Number(bankAccount.balance);
      if (currentBalance < mainPurchaseAmount) {
        throw new Error(
          `Insufficient bank balance. Available: $${currentBalance.toFixed(2)}, Required: $${mainPurchaseAmount.toFixed(2)}. ` +
          `You need $${(mainPurchaseAmount - currentBalance).toFixed(2)} more to complete this purchase.`
        );
      }
      
      // Update bank account balance
      const newBankBalance = currentBalance - mainPurchaseAmount;
      await bankAccount.update({ balance: newBankBalance }, { transaction });
      
      // Get last bank register transaction for balance
      const lastBankTransaction = await BankRegister.findOne({
        order: [['id', 'DESC']],
        transaction
      });
      
      const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
      const newBalance = lastBalance - mainPurchaseAmount; // OUTFLOW reduces balance
      
      const supplier = await Supplier.findByPk(data.supplierId, { transaction });
      
      const paymentMethodLabel = paymentType === 'CHEQUE' ? 'Cheque' : 'Bank Transfer';
      const referenceNumber = paymentType === 'CHEQUE' ? data.chequeNumber : data.transferNumber;
      
      // Use the purchase registration number (CP####)
      await BankRegister.create({
        registrationNumber: registrationNumber,
        registrationDate: new Date(),
        transactionType: 'OUTFLOW',
        amount: mainPurchaseAmount,
        paymentMethod: paymentMethodLabel,
        relatedDocumentType: 'Purchase',
        relatedDocumentNumber: registrationNumber,
        clientRnc: data.supplierRnc || '',
        clientName: supplier?.name || '',
        ncf: data.ncf || '',
        description: `Payment for purchase ${registrationNumber} via ${paymentMethodLabel} (${referenceNumber}) - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
        balance: newBalance,
        bankAccountId: data.bankAccountId,  // Phase 3: Added bank account tracking
      }, { transaction });
    }
    
    // Create Accounts Payable for debit/credit card and credit purchases
    if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD' || paymentType === 'CREDIT') {
      const AccountsPayable = (await import('../models/AccountsPayable')).default;
      const Card = (await import('../models/Card')).default;
      const BankAccount = (await import('../models/BankAccount')).default;
      
      // Get supplier info for credit purchases
      const supplier = await Supplier.findByPk(data.supplierId, { transaction });
      
      // Get card info for credit card purchases
      let cardInfo = '';
      let card = null;
      
      if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') {
        // ✅ Handle DEBIT/CREDIT card payments
        card = await Card.findByPk(data.cardId, { transaction });
        if (!card) {
          throw new Error('Card not found');
        }
        
        // ✅ Validate card type matches payment type
        if (paymentType === 'DEBIT_CARD' && card.cardType !== 'DEBIT') {
          throw new Error(
            `Selected card ****${card.cardNumberLast4} is a ${card.cardType} card, not a DEBIT card. ` +
            `Please select a DEBIT card or change payment type to CREDIT_CARD.`
          );
        }
        
        if (paymentType === 'CREDIT_CARD' && card.cardType !== 'CREDIT') {
          throw new Error(
            `Selected card ****${card.cardNumberLast4} is a ${card.cardType} card, not a CREDIT card. ` +
            `Please select a CREDIT card or change payment type to DEBIT_CARD.`
          );
        }
        
        cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
        
        // ✅ VALIDATION: Check card type and validate accordingly
        if (card.cardType === 'DEBIT') {
          // DEBIT Card: Must have bank account and sufficient balance
          if (!card.bankAccountId) {
            throw new Error('DEBIT card must be linked to a bank account');
          }
          
          const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
          if (!bankAccount) {
            throw new Error('Bank account not found for this DEBIT card');
          }
          
          // Validate balance
          const currentBalance = Number(bankAccount.balance);
          if (currentBalance < mainPurchaseAmount) {
            throw new Error(
              `Insufficient balance in bank account linked to DEBIT card ****${card.cardNumberLast4}. ` +
              `Available: $${currentBalance.toFixed(2)}, Required: $${mainPurchaseAmount.toFixed(2)}. ` +
              `You need $${(mainPurchaseAmount - currentBalance).toFixed(2)} more.`
            );
          }
          
          // Deduct from bank account
          const newBankBalance = currentBalance - mainPurchaseAmount;
          await bankAccount.update({ balance: newBankBalance }, { transaction });
          
          // Create Bank Register entry for DEBIT card
          const BankRegister = (await import('../models/BankRegister')).default;
          
          const lastBankTransaction = await BankRegister.findOne({
            order: [['id', 'DESC']],
            transaction
          });
          
          const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
          const newBalance = lastBalance - mainPurchaseAmount;
          
          await BankRegister.create({
            registrationNumber: registrationNumber,
            registrationDate: new Date(),
            transactionType: 'OUTFLOW',
            amount: mainPurchaseAmount,
            paymentMethod: 'Debit Card',
            relatedDocumentType: 'Purchase',
            relatedDocumentNumber: registrationNumber,
            clientRnc: data.supplierRnc || '',
            clientName: supplier?.name || '',
            ncf: data.ncf || '',
            description: `Payment for purchase ${registrationNumber} via DEBIT card ${cardInfo} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
            balance: newBalance,
            bankAccountId: card.bankAccountId,
          }, { transaction });
          
          // ✅ FIX: For DEBIT card, mark purchase as paid
          await purchase.update({
            paidAmount: mainPurchaseAmount,
            balanceAmount: 0,
            paymentStatus: 'Paid',
          }, { transaction });
          
          // For DEBIT card, we don't create AP since it's paid immediately
          // Skip AP creation below
        } 
        else if (card.cardType === 'CREDIT') {
          // CREDIT Card: Validate credit limit and track used credit
          const creditLimit = Number(card.creditLimit || 0);
          const usedCredit = Number(card.usedCredit || 0);
          const availableCredit = creditLimit - usedCredit;
          if (creditLimit <= 0) {
            throw new Error(
              `CREDIT card ****${card.cardNumberLast4} has no credit limit set. ` +
              `Please set a credit limit for this card.`
            );
          }
          
          // Validate available credit
          if (mainPurchaseAmount > availableCredit) {
            throw new Error(
              `Insufficient credit available on card ****${card.cardNumberLast4}. ` +
              `Credit Limit: $${creditLimit.toFixed(2)}, Required: $${mainPurchaseAmount.toFixed(2)}.`
            );
          }
          
          // ✅ Increase usedCredit
          const newUsedCredit = usedCredit + mainPurchaseAmount;
          await card.update({ usedCredit: newUsedCredit }, { transaction });
          
          console.log(`✅ Credit card usage: $${usedCredit.toFixed(2)} -> $${newUsedCredit.toFixed(2)}`);
          console.log(`✅ Available credit: $${availableCredit.toFixed(2)} -> $${(creditLimit - newUsedCredit).toFixed(2)}`);
          
          // CREDIT card: Create AP (handled below)
        }
      }
      
      // Create AP only for CREDIT cards or CREDIT payment type (not for DEBIT cards)
      if (paymentType === 'CREDIT' || ((paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') && card && card.cardType === 'CREDIT')) {
        const AccountsPayable = (await import('../models/AccountsPayable')).default;
        
        await AccountsPayable.create({
        registrationNumber: registrationNumber, // Use purchase registration number
        registrationDate: new Date(),
        type: paymentType === 'CREDIT_CARD' || paymentType === 'DEBIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'SUPPLIER_CREDIT',
        relatedDocumentType: 'Purchase',
        relatedDocumentId: purchase.id,
        relatedDocumentNumber: registrationNumber,
        supplierId: paymentType === 'CREDIT' ? data.supplierId : undefined,
        supplierName: (paymentType === 'CREDIT_CARD' || paymentType === 'DEBIT_CARD') ? (cardInfo || 'Credit Card Company') : (supplier?.name || ''),
        supplierRnc: data.supplierRnc || '',
        ncf: data.ncf || '',
        purchaseDate: data.date ? new Date(data.date) : new Date(),
        purchaseType: data.purchaseType,
        paymentType: paymentType,
        cardId: (paymentType === 'CREDIT_CARD' || paymentType === 'DEBIT_CARD') && card ? card.id : undefined, // ✅ Store cardId
        cardIssuer: (paymentType === 'CREDIT_CARD' || paymentType === 'DEBIT_CARD') ? (cardInfo || 'Credit Card Company') : undefined,
        amount: mainPurchaseAmount, // Only mainPurchaseAmount, not including associated invoices
        paidAmount: 0,
        balanceAmount: mainPurchaseAmount,
        status: 'Pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: (paymentType === 'CREDIT_CARD' || paymentType === 'DEBIT_CARD')
          ? `Credit card payment for purchase ${registrationNumber} - ${cardInfo} - Ref: ${data.paymentReference || 'N/A'}`
          : `Credit purchase from ${supplier?.name || 'supplier'} - ${registrationNumber}`,
        }, { transaction });
      }
      
      // Create separate AP entries for each associated invoice (based on EACH invoice's payment type)
      if (data.associatedInvoices && data.associatedInvoices.length > 0) {
        console.log('🔍 Creating AP for invoices with CREDIT/CREDIT_CARD payment types');
        console.log('🔍 Number of invoices to check:', data.associatedInvoices.length);
        
        for (const invoice of data.associatedInvoices) {
          console.log('🔍 Checking invoice for AP creation:', {
            concept: invoice.concept,
            supplierName: invoice.supplierName,
            paymentType: invoice.paymentType,
            amount: invoice.amount
          });
          
          // Determine if this invoice should create AP based on ITS OWN payment type
          const invoicePaymentType = invoice.paymentType ? invoice.paymentType.toUpperCase() : 'CREDIT';
          
          // Only create AP for CREDIT and CREDIT_CARD invoices (independent of main purchase payment type)
          if (invoicePaymentType === 'CREDIT' || invoicePaymentType === 'CREDIT_CARD') {
            console.log(`📋 Creating AP for ${invoicePaymentType} invoice: ${invoice.concept}`);
            
            // Get card info if CREDIT_CARD
            let invoiceCardInfo = '';
            if (invoicePaymentType === 'CREDIT_CARD' && invoice.cardId) {
              const Card = (await import('../models/Card')).default;
              const invoiceCard = await Card.findByPk(invoice.cardId, { transaction });
              if (invoiceCard) {
                invoiceCardInfo = `${invoiceCard.cardBrand || 'Card'} ****${invoiceCard.cardNumberLast4}`;
              }
            }
            
            const AccountsPayable = (await import('../models/AccountsPayable')).default;
            
            // Use the purchase registration number (CP####) for invoice AP entries too
            const apData = {
              registrationNumber: registrationNumber, // Use purchase registration number
              registrationDate: new Date(),
              type: invoicePaymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'SUPPLIER_CREDIT',
              relatedDocumentType: 'Purchase',
              relatedDocumentId: purchase.id,
              relatedDocumentNumber: registrationNumber,
              supplierName: invoicePaymentType === 'CREDIT_CARD' ? (invoiceCardInfo || 'Credit Card Company') : (invoice.supplierName || 'Unknown Supplier'),
              supplierRnc: invoice.supplierRnc || '',
              ncf: invoice.ncf || '',
              purchaseDate: invoice.date ? new Date(invoice.date) : new Date(),
              purchaseType: invoice.purchaseType || data.purchaseType,
              paymentType: invoicePaymentType,
              cardId: invoicePaymentType === 'CREDIT_CARD' ? invoice.cardId : undefined, // ✅ Store cardId for invoice
              cardIssuer: invoicePaymentType === 'CREDIT_CARD' ? invoiceCardInfo : undefined, // ✅ Store card issuer
              amount: invoice.amount, // Total amount including tax
              paidAmount: 0,
              balanceAmount: invoice.amount,
              status: 'Pending',
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              notes: invoicePaymentType === 'CREDIT_CARD'
                ? `Invoice: ${invoice.concept} for purchase ${registrationNumber} - ${invoiceCardInfo}`
                : `${invoice.concept || 'Associated cost'} for purchase ${registrationNumber} - Supplier: ${invoice.supplierName} - RNC: ${invoice.supplierRnc || 'N/A'}`,
            };
            
            console.log('🔍 Creating AP with data:', apData);
            
            await AccountsPayable.create(apData, { transaction });
            
            console.log('✅ AP created successfully for invoice:', invoice.concept);
          } else {
            console.log('⏭️ Skipping AP creation for invoice with payment type:', invoicePaymentType, '(will create bank register entry instead)');
          }
        }
      }
    }
    
    // Create AP for ALL associated invoices regardless of main purchase payment type
    // This handles cases where main purchase is CASH but invoices need AP
    if (paymentType !== 'CREDIT' && paymentType !== 'CREDIT_CARD' && data.associatedInvoices && data.associatedInvoices.length > 0) {
      const AccountsPayable = (await import('../models/AccountsPayable')).default;
      
      console.log('🔍 Checking invoices for AP creation. Main purchase payment type:', paymentType);
      console.log('🔍 Number of invoices:', data.associatedInvoices.length);
      
      for (const invoice of data.associatedInvoices) {
        const invoicePaymentType = invoice.paymentType ? invoice.paymentType.toUpperCase() : '';
        
        console.log('🔍 Processing invoice:', {
          supplierName: invoice.supplierName,
          paymentType: invoicePaymentType,
          amount: invoice.amount
        });
        
        // Only create AP for CREDIT and CREDIT_CARD invoices
        if (invoicePaymentType === 'CREDIT' || invoicePaymentType === 'CREDIT_CARD') {
          // Get card info if CREDIT_CARD
          let invoiceCardInfo = '';
          if (invoicePaymentType === 'CREDIT_CARD' && invoice.cardId) {
            const Card = (await import('../models/Card')).default;
            const invoiceCard = await Card.findByPk(invoice.cardId, { transaction });
            if (invoiceCard) {
              invoiceCardInfo = `${invoiceCard.cardBrand || 'Card'} ****${invoiceCard.cardNumberLast4}`;
            }
          }
          
          await AccountsPayable.create({
            registrationNumber: registrationNumber, // Use purchase registration number (CP####)
            registrationDate: new Date(),
            type: invoicePaymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'SUPPLIER_CREDIT',
            relatedDocumentType: 'Purchase',
            relatedDocumentId: purchase.id,
            relatedDocumentNumber: registrationNumber,
            supplierName: invoicePaymentType === 'CREDIT_CARD' ? (invoiceCardInfo || 'Credit Card Company') : (invoice.supplierName || 'Unknown Supplier'),
            supplierRnc: invoice.supplierRnc || '',
            ncf: invoice.ncf || '',
            purchaseDate: invoice.date ? new Date(invoice.date) : new Date(),
            purchaseType: invoice.purchaseType || data.purchaseType,
            paymentType: invoicePaymentType,
            cardId: invoicePaymentType === 'CREDIT_CARD' ? invoice.cardId : undefined, // ✅ Store cardId for invoice
            cardIssuer: invoicePaymentType === 'CREDIT_CARD' ? invoiceCardInfo : undefined, // ✅ Store card issuer
            amount: invoice.amount,
            paidAmount: 0,
            balanceAmount: invoice.amount,
            status: 'Pending',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: invoicePaymentType === 'CREDIT_CARD' 
              ? `Invoice: ${invoice.concept} for purchase ${registrationNumber} - ${invoiceCardInfo}`
              : `${invoice.concept || 'Associated cost'} for purchase ${registrationNumber} - Supplier: ${invoice.supplierName} - RNC: ${invoice.supplierRnc || 'N/A'}`,
          }, { transaction });
          
          console.log('✅ AP created for invoice with payment type:', invoicePaymentType, '- Using AP #:', registrationNumber);
        } else {
          console.log('⏭️ Skipping AP creation for invoice with payment type:', invoicePaymentType, '(will create register entry instead)');
        }
      }
    }
    
    // ✅ CRITICAL FIX: Process associated invoices INDEPENDENTLY of main purchase payment type
    // This was previously inside the main purchase condition, causing invoices to be ignored
    // when main purchase was CHEQUE/CASH but invoice was DEBIT_CARD/CREDIT_CARD
    if (data.associatedInvoices && data.associatedInvoices.length > 0) {
      console.log('🔍 Processing associated invoices:', data.associatedInvoices.length);
      console.log('🔍 Main purchase payment type:', paymentType, '(does NOT affect invoice processing)');
      console.log('🔍 Associated invoices data:', JSON.stringify(data.associatedInvoices, null, 2));
      
      for (const invoice of data.associatedInvoices) {
        const invoicePaymentType = invoice.paymentType?.toUpperCase();
        const invoiceAmount = Number(invoice.amount || 0);
        
        console.log(`🔍 Processing invoice: ${invoice.concept}, Payment Type: ${invoicePaymentType}, CardId: ${invoice.cardId}, Amount: ${invoiceAmount}`);
        console.log(`🔍 Invoice processing is INDEPENDENT of main purchase payment type: ${paymentType}`);
        
        // Validate card payment types have cardId
        if ((invoicePaymentType === 'DEBIT_CARD' || invoicePaymentType === 'CREDIT_CARD') && !invoice.cardId) {
          throw new Error(`Invoice "${invoice.concept}" with payment type ${invoicePaymentType} requires a card to be selected`);
        }
        
        // Handle DEBIT_CARD invoices
        if (invoicePaymentType === 'DEBIT_CARD' && invoice.cardId) {
          console.log(`💳 Processing DEBIT_CARD invoice: ${invoice.concept}`);
          
          const Card = (await import('../models/Card')).default;
          const BankAccount = (await import('../models/BankAccount')).default;
          const BankRegister = (await import('../models/BankRegister')).default;
          
          const invoiceCard = await Card.findByPk(invoice.cardId, { transaction });
          if (!invoiceCard) {
            throw new Error(`Card not found for invoice: ${invoice.concept}`);
          }
          
          if (invoiceCard.cardType !== 'DEBIT') {
            throw new Error(`Invoice "${invoice.concept}" requires DEBIT card but ${invoiceCard.cardType} card was selected`);
          }
          
          if (!invoiceCard.bankAccountId) {
            throw new Error(`DEBIT card ****${invoiceCard.cardNumberLast4} must be linked to a bank account`);
          }
          
          const invoiceBankAccount = await BankAccount.findByPk(invoiceCard.bankAccountId, { transaction });
          if (!invoiceBankAccount) {
            throw new Error(`Bank account not found for DEBIT card ****${invoiceCard.cardNumberLast4}`);
          }
          
          const invoiceBalance = Number(invoiceBankAccount.balance);
          if (invoiceBalance < invoiceAmount) {
            throw new Error(
              `Insufficient balance for invoice "${invoice.concept}". ` +
              `Available: ${invoiceBalance.toFixed(2)}, Required: ${invoiceAmount.toFixed(2)}`
            );
          }
          
          // Deduct from bank account
          const newInvoiceBankBalance = invoiceBalance - invoiceAmount;
          await invoiceBankAccount.update({ 
            balance: newInvoiceBankBalance 
          }, { transaction });
          
          // Create bank register entry
          // Get the last bank register entry for the SAME bank account to maintain proper balance tracking
          const lastBankTx = await BankRegister.findOne({
            where: { bankAccountId: invoiceCard.bankAccountId },
            order: [['id', 'DESC']],
            transaction
          });
          
          // Use the specific bank account's previous balance, or the current balance if no previous entries
          const lastBal = lastBankTx ? Number(lastBankTx.balance) : invoiceBalance;
          const newRegisterBalance = lastBal - invoiceAmount;
          
          await BankRegister.create({
            registrationNumber: registrationNumber,
            registrationDate: new Date(),
            transactionType: 'OUTFLOW',
            amount: invoiceAmount,
            paymentMethod: 'Debit Card',
            relatedDocumentType: 'Purchase Invoice',
            relatedDocumentNumber: registrationNumber,
            clientRnc: invoice.supplierRnc || '',
            clientName: invoice.supplierName || '',
            ncf: invoice.ncf || '',
            description: `Invoice: ${invoice.concept} for purchase ${registrationNumber} via DEBIT card ${invoiceCard.cardBrand || ''} ****${invoiceCard.cardNumberLast4} - Bank: ${invoiceBankAccount.bankName}`,
            balance: newRegisterBalance,
            bankAccountId: invoiceCard.bankAccountId,
          }, { transaction });
          
          console.log(`✅ Invoice "${invoice.concept}" paid with DEBIT card - Bank deducted: ${invoiceAmount}`);
          console.log(`✅ Bank account ${invoiceBankAccount.bankName} balance: ${invoiceBalance.toFixed(2)} -> ${newInvoiceBankBalance.toFixed(2)}`);
          console.log(`✅ Bank register entry created with balance: ${newRegisterBalance.toFixed(2)}`);
        }
        
        // Handle CREDIT_CARD invoices
        if (invoicePaymentType === 'CREDIT_CARD' && invoice.cardId) {
          console.log(`💳 Processing CREDIT_CARD invoice: ${invoice.concept}`);
          
          const Card = (await import('../models/Card')).default;
          
          const invoiceCard = await Card.findByPk(invoice.cardId, { transaction });
          if (!invoiceCard) {
            throw new Error(`Card not found for invoice: ${invoice.concept}`);
          }
          
          console.log(`💳 Found card: ${invoiceCard.cardBrand} ****${invoiceCard.cardNumberLast4}, Type: ${invoiceCard.cardType}`);
          
          if (invoiceCard.cardType !== 'CREDIT') {
            throw new Error(`Invoice "${invoice.concept}" requires CREDIT card but ${invoiceCard.cardType} card was selected`);
          }
          
          const invoiceCreditLimit = Number(invoiceCard.creditLimit || 0);
          const invoiceUsedCredit = Number(invoiceCard.usedCredit || 0);
          const invoiceAvailableCredit = invoiceCreditLimit - invoiceUsedCredit;
          
          console.log(`💳 Credit Info - Limit: ${invoiceCreditLimit}, Used: ${invoiceUsedCredit}, Available: ${invoiceAvailableCredit}, Required: ${invoiceAmount}`);
          
          if (invoiceCreditLimit <= 0) {
            throw new Error(`CREDIT card ****${invoiceCard.cardNumberLast4} has no credit limit set`);
          }
          
          if (invoiceAmount > invoiceAvailableCredit) {
            throw new Error(
              `Insufficient credit for invoice "${invoice.concept}". ` +
              `Available: ${invoiceAvailableCredit.toFixed(2)}, Required: ${invoiceAmount.toFixed(2)}. ` +
              `Credit Limit: ${invoiceCreditLimit.toFixed(2)}, Currently Used: ${invoiceUsedCredit.toFixed(2)}`
            );
          }
          
          // Increase usedCredit
          const newInvoiceUsedCredit = invoiceUsedCredit + invoiceAmount;
          await invoiceCard.update({ usedCredit: newInvoiceUsedCredit }, { transaction });
          
          console.log(`✅ Invoice "${invoice.concept}" charged to CREDIT card - usedCredit: ${invoiceUsedCredit.toFixed(2)} -> ${newInvoiceUsedCredit.toFixed(2)}`);
          console.log(`✅ Available credit after transaction: ${(invoiceCreditLimit - newInvoiceUsedCredit).toFixed(2)}`);
        }
        
        // Handle CASH, CHEQUE, BANK_TRANSFER, and DEPOSIT invoices
        if (invoicePaymentType === 'CASH' || invoicePaymentType === 'CHEQUE' || invoicePaymentType === 'BANK_TRANSFER' || invoicePaymentType === 'DEPOSIT') {
          console.log(`💰 Processing ${invoicePaymentType} invoice: ${invoice.concept}`);
          
          const BankRegister = (await import('../models/BankRegister')).default;
          
          // For BANK_TRANSFER, CHEQUE, DEPOSIT - use specific bank account if provided
          let bankAccountId = null;
          let bankAccountInfo = '';
          
          if ((invoicePaymentType === 'BANK_TRANSFER' || invoicePaymentType === 'CHEQUE' || invoicePaymentType === 'DEPOSIT') && invoice.bankAccountId) {
            const BankAccount = (await import('../models/BankAccount')).default;
            
            const bankAccount = await BankAccount.findByPk(invoice.bankAccountId, { transaction });
            if (!bankAccount) {
              throw new Error(`Bank account not found for invoice: ${invoice.concept}`);
            }
            
            const currentBalance = Number(bankAccount.balance);
            if (currentBalance < invoiceAmount) {
              throw new Error(
                `Insufficient balance in ${bankAccount.bankName} for invoice "${invoice.concept}". ` +
                `Available: ${currentBalance.toFixed(2)}, Required: ${invoiceAmount.toFixed(2)}`
              );
            }
            
            // Deduct from bank account
            const newBankBalance = currentBalance - invoiceAmount;
            await bankAccount.update({ balance: newBankBalance }, { transaction });
            
            bankAccountId = invoice.bankAccountId;
            bankAccountInfo = ` - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`;
            
            console.log(`✅ Bank account ${bankAccount.bankName} balance: ${currentBalance.toFixed(2)} -> ${newBankBalance.toFixed(2)}`);
          }
          
          // Get the last bank register entry to maintain proper balance tracking
          const lastBankTx = await BankRegister.findOne({
            where: bankAccountId ? { bankAccountId } : {},
            order: [['id', 'DESC']],
            transaction
          });
          
          const lastBal = lastBankTx ? Number(lastBankTx.balance) : 0;
          const newRegisterBalance = lastBal - invoiceAmount; // OUTFLOW reduces balance
          
          // Determine payment method label
          let paymentMethodLabel = '';
          switch (invoicePaymentType) {
            case 'CASH':
              paymentMethodLabel = 'Cash';
              break;
            case 'CHEQUE':
              paymentMethodLabel = 'Cheque';
              break;
            case 'BANK_TRANSFER':
              paymentMethodLabel = 'Bank Transfer';
              break;
            case 'DEPOSIT':
              paymentMethodLabel = 'Deposit';
              break;
          }
          
          await BankRegister.create({
            registrationNumber: registrationNumber,
            registrationDate: new Date(),
            transactionType: 'OUTFLOW',
            amount: invoiceAmount,
            paymentMethod: paymentMethodLabel,
            relatedDocumentType: 'Purchase Invoice',
            relatedDocumentNumber: registrationNumber,
            clientRnc: invoice.supplierRnc || '',
            clientName: invoice.supplierName || '',
            ncf: invoice.ncf || '',
            description: `Invoice: ${invoice.concept} for purchase ${registrationNumber} via ${paymentMethodLabel}${bankAccountInfo}`,
            balance: newRegisterBalance,
            bankAccountId: bankAccountId, // Use specific bank account if provided
          }, { transaction });
          
          console.log(`✅ Invoice "${invoice.concept}" paid with ${paymentMethodLabel} - Bank register entry created: ${invoiceAmount}`);
          console.log(`✅ Bank register balance: ${lastBal.toFixed(2)} -> ${newRegisterBalance.toFixed(2)}`);
        }
      }
    }
    
    // ✅ REMOVED: Duplicate AP creation logic
    // This section was duplicating the AP creation that already happens earlier in the code
    // (lines 320-490), causing duplicate entries in accounts payable for the same invoices
    
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
        
        // Create register entries for each associated invoice based on its payment type
        const invoicePaymentType = invoice.paymentType ? invoice.paymentType.toUpperCase() : '';
        const invoiceAmount = invoice.amount || 0;
        
        // CASH or CHEQUE → Cash Register
        if (invoicePaymentType === 'CASH' || invoicePaymentType === 'CHEQUE') {
          const CashRegister = (await import('../models/CashRegister')).default;
          
          const lastCashTransaction = await CashRegister.findOne({
            order: [['id', 'DESC']],
            transaction
          });
          
          const lastBalance = lastCashTransaction ? Number(lastCashTransaction.balance) : 0;
          const newBalance = lastBalance - invoiceAmount; // OUTFLOW reduces balance
          
          const paymentMethodLabel = invoicePaymentType === 'CASH' ? 'Cash' : 'Cheque';
          
          await CashRegister.create({
            registrationNumber: registrationNumber, // Use purchase registration number (CP####)
            registrationDate: new Date(),
            transactionType: 'OUTFLOW',
            amount: invoiceAmount,
            paymentMethod: paymentMethodLabel,
            relatedDocumentType: 'Purchase',
            relatedDocumentNumber: registrationNumber,
            clientRnc: invoice.supplierRnc || '',
            clientName: invoice.supplierName || '',
            ncf: invoice.ncf || '',
            description: `${invoice.concept || 'Associated invoice'} for purchase ${registrationNumber} via ${paymentMethodLabel} - Supplier: ${invoice.supplierName}`,
            balance: newBalance,
          }, { transaction });
        }
        
        // BANK_TRANSFER or DEPOSIT → Bank Register
        // ✅ REMOVED: This logic is now handled in the earlier section (lines 620-690)
        // to prevent duplicate bank register entries for the same invoice
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
