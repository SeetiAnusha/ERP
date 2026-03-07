import Card from '../models/Card';
import BankAccount from '../models/BankAccount';
import CashRegister from '../models/CashRegister';
import CashRegisterMaster from '../models/CashRegisterMaster';
import Sale from '../models/Sale';
import sequelize from '../config/database';
import { Op } from 'sequelize';

// Process card payment for sales (money coming in)
export const processCardSalePayment = async (data: {
  saleId: number;
  cardId: number;
  amount: number;
  cashRegisterId: number;
  registrationDate: string;
  description?: string;
}) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Get card details
    const card = await Card.findByPk(data.cardId);
    if (!card) {
      throw new Error('Card not found');
    }
    
    if (card.status !== 'ACTIVE') {
      throw new Error('Card is not active');
    }

    // Get sale details
    const sale = await Sale.findByPk(data.saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    const amount = parseFloat(data.amount.toString());

    if (card.cardType === 'CREDIT') {
      // CREDIT CARD: Reduce used credit (money received increases available limit)
      const currentUsedCredit = parseFloat(card.usedCredit.toString());
      const newUsedCredit = Math.max(0, currentUsedCredit - amount); // Can't go below 0
      
      await card.update({
        usedCredit: newUsedCredit
      }, { transaction });
      
    } else if (card.cardType === 'DEBIT') {
      // DEBIT CARD: Add money to linked bank account
      if (!card.bankAccountId) {
        throw new Error('Debit card must be linked to a bank account');
      }
      
      const bankAccount = await BankAccount.findByPk(card.bankAccountId);
      if (!bankAccount) {
        throw new Error('Linked bank account not found');
      }
      
      const currentBalance = parseFloat(bankAccount.balance.toString());
      const newBalance = currentBalance + amount;
      
      await bankAccount.update({
        balance: newBalance
      }, { transaction });
    }

    // Create cash register transaction (INFLOW - money coming in from sale)
    const cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId);
    if (!cashRegisterMaster) {
      throw new Error('Cash register not found');
    }

    // Generate registration number for cash register
    const lastTransaction = await CashRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CJ%'
        }
      },
      order: [['id', 'DESC']]
    });
    
    let nextNumber = 1;
    if (lastTransaction) {
      const lastNumber = parseInt(lastTransaction.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `CJ${String(nextNumber).padStart(4, '0')}`;

    // Get current cash register balance
    const lastCashTransaction = await CashRegister.findOne({
      where: { cashRegisterId: data.cashRegisterId },
      order: [['id', 'DESC']]
    });
    
    const lastBalance = lastCashTransaction 
      ? parseFloat(lastCashTransaction.balance.toString()) 
      : parseFloat(cashRegisterMaster.balance.toString());
    
    const newCashBalance = lastBalance + amount;

    // Create cash register transaction
    const cashTransaction = await CashRegister.create({
      registrationNumber,
      registrationDate: new Date(data.registrationDate),
      transactionType: 'INFLOW',
      amount,
      paymentMethod: card.cardType === 'CREDIT' ? 'CREDIT_CARD' : 'DEBIT_CARD',
      relatedDocumentType: 'SALE',
      relatedDocumentNumber: sale.registrationNumber,
      clientName: `Card Payment - ${card.cardName}`,
      description: data.description || `${card.cardType} card payment for sale ${sale.registrationNumber}`,
      balance: newCashBalance,
      cashRegisterId: data.cashRegisterId,
    }, { transaction });

    // Update cash register master balance
    await cashRegisterMaster.update({
      balance: newCashBalance
    }, { transaction });

    // Update sale collection status
    const newCollectedAmount = parseFloat(sale.collectedAmount.toString()) + amount;
    const newBalanceAmount = parseFloat(sale.total.toString()) - newCollectedAmount;
    
    let newCollectionStatus = 'Not Collected';
    if (newCollectedAmount >= parseFloat(sale.total.toString())) {
      newCollectionStatus = 'Fully Collected';
    } else if (newCollectedAmount > 0) {
      newCollectionStatus = 'Partially Collected';
    }

    await sale.update({
      collectedAmount: newCollectedAmount,
      balanceAmount: newBalanceAmount,
      collectionStatus: newCollectionStatus
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      cashTransaction: cashTransaction.toJSON(),
      card: {
        id: card.id,
        name: card.cardName,
        type: card.cardType,
        availableLimit: card.cardType === 'CREDIT' 
          ? parseFloat(card.creditLimit.toString()) - parseFloat(card.usedCredit.toString())
          : null
      },
      sale: {
        id: sale.id,
        registrationNumber: sale.registrationNumber,
        collectedAmount: newCollectedAmount,
        balanceAmount: newBalanceAmount,
        collectionStatus: newCollectionStatus
      }
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Get available cards for sales payments
export const getAvailableCardsForSales = async () => {
  try {
    const cards = await Card.findAll({
      where: {
        status: 'ACTIVE'
      },
      include: [
        {
          model: BankAccount,
          as: 'BankAccount',
          required: false
        }
      ],
      order: [['cardName', 'ASC']]
    });

    return cards.map(card => {
      const availableLimit = card.cardType === 'CREDIT' 
        ? parseFloat(card.creditLimit.toString()) - parseFloat(card.usedCredit.toString())
        : null;

      return {
        id: card.id,
        code: card.code,
        name: card.cardName,
        type: card.cardType,
        brand: card.cardBrand,
        bankName: card.bankName,
        last4: card.cardNumberLast4,
        creditLimit: card.cardType === 'CREDIT' ? parseFloat(card.creditLimit.toString()) : null,
        usedCredit: card.cardType === 'CREDIT' ? parseFloat(card.usedCredit.toString()) : null,
        availableLimit,
        bankAccountId: card.bankAccountId,
        canAcceptPayment: card.cardType === 'DEBIT' || (card.cardType === 'CREDIT' && availableLimit !== null && availableLimit > 0)
      };
    });
  } catch (error: any) {
    throw new Error(`Error getting available cards: ${error.message}`);
  }
};

// Get card transaction history for sales
export const getCardSalesTransactions = async (cardId?: number, limit: number = 50) => {
  try {
    const whereClause: any = {
      relatedDocumentType: 'SALE',
      paymentMethod: {
        [Op.in]: ['CREDIT_CARD', 'DEBIT_CARD']
      }
    };

    // If specific card requested, we need to join with card info
    // For now, we'll get all card sales transactions
    const transactions = await CashRegister.findAll({
      where: whereClause,
      order: [['registrationDate', 'DESC']],
      limit
    });

    return transactions.map(txn => ({
      id: txn.id,
      registrationNumber: txn.registrationNumber,
      date: txn.registrationDate,
      amount: parseFloat(txn.amount.toString()),
      paymentMethod: txn.paymentMethod,
      saleNumber: txn.relatedDocumentNumber,
      description: txn.description,
      storeName: 'Store', // TODO: Get from cash register master
      storeLocation: '', // TODO: Get from cash register master
      balance: parseFloat(txn.balance.toString())
    }));
  } catch (error: any) {
    throw new Error(`Error getting card sales transactions: ${error.message}`);
  }
};