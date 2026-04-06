import CashRegister from '../models/CashRegister';
import BankRegister from '../models/BankRegister';
import BankAccount from '../models/BankAccount';
import AccountsPayable from '../models/AccountsPayable';
import Financer from '../models/Financer';
import CashRegisterMaster from '../models/CashRegisterMaster';
import { Op } from 'sequelize';

// Get recent investment and loan activity
export const getRecentActivity = async (limit: number = 50) => {
  try {
    // Get all CONTRIBUTION and LOAN transactions from Cash Register
    const transactionsCash = await CashRegister.findAll({
      where: {
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    // ✅ NEW: Get all CONTRIBUTION and LOAN transactions from Bank Register
    const transactionsBank = await BankRegister.findAll({
      where: {
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    // Get investment agreements to get financer details
    const InvestmentAgreement = require('../models/InvestmentAgreement').default;
    const agreements = await InvestmentAgreement.findAll();

    // Get all financers
    const financers = await Financer.findAll({
      where: { status: 'ACTIVE' }
    });

    // Get all cash register masters
    const cashRegisterMasters = await CashRegisterMaster.findAll({
      where: { status: 'ACTIVE' }
    });

    // ✅ NEW: Get all bank accounts
    const bankAccounts = await BankAccount.findAll();

    // Process CASH register activity data
    const activitiesCash = transactionsCash.map(transaction => {
      // Find the agreement for this transaction
      const agreement = agreements.find((a: any) => a.id === transaction.investmentAgreementId);
      const financer = agreement ? financers.find((f: any) => f.id === agreement.investorId) : null;
      const store = cashRegisterMasters.find(s => s.id === transaction.cashRegisterId);

      return {
        id: `cash-${transaction.id}`,
        date: transaction.registrationDate,
        type: transaction.relatedDocumentType,
        amount: parseFloat(transaction.amount.toString()),
        registrationNumber: transaction.registrationNumber,
        
        // Financer details
        financerId: financer?.id || null,
        financerName: financer?.name || 'Unknown',
        financerCode: financer?.code || 'N/A',
        financerType: financer?.type || 'Unknown',
        financerContact: financer?.contactPerson || null,
        financerPhone: financer?.phone || null,
        
        // Store details
        storeId: store?.id || null,
        storeName: store?.name || 'Unknown',
        storeLocation: store?.location || '',
        storeCode: store?.code || 'N/A',
        storeBalanceAfter: parseFloat(transaction.balance.toString()),
        
        // Agreement details
        agreementId: agreement?.id || null,
        agreementNumber: agreement?.agreementNumber || null,
        agreementTotalAmount: agreement ? parseFloat(agreement.totalCommittedAmount.toString()) : 0,
        agreementBalanceAmount: agreement ? parseFloat(agreement.balanceAmount.toString()) : 0,
        agreementStatus: agreement?.status || 'Unknown',
        
        // Transaction details
        paymentMethod: transaction.paymentMethod || 'CASH',
        description: transaction.description,
        status: 'Paid', // Cash transactions are always paid
        source: 'Cash Register'
      };
    });

    // ✅ NEW: Process BANK register activity data
    const activitiesBank = transactionsBank.map(transaction => {
      // Find the agreement for this transaction
      const agreement = agreements.find((a: any) => a.id === (transaction as any).investmentAgreementId);
      const financer = agreement ? financers.find((f: any) => f.id === agreement.investorId) : null;
      const bankAccount = bankAccounts.find(b => b.id === transaction.bankAccountId);

      return {
        id: `bank-${transaction.id}`,
        date: transaction.registrationDate,
        type: transaction.relatedDocumentType,
        amount: parseFloat(transaction.amount.toString()),
        registrationNumber: transaction.registrationNumber,
        
        // Financer details
        financerId: financer?.id || null,
        financerName: financer?.name || 'Unknown',
        financerCode: financer?.code || 'N/A',
        financerType: financer?.type || 'Unknown',
        financerContact: financer?.contactPerson || null,
        financerPhone: financer?.phone || null,
        
        // Bank details (instead of store)
        storeId: bankAccount?.id || null,
        storeName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountNumber}` : 'Unknown',
        storeLocation: 'Bank Account',
        storeCode: bankAccount?.accountNumber || 'N/A',
        storeBalanceAfter: parseFloat(transaction.balance.toString()),
        
        // Agreement details
        agreementId: agreement?.id || null,
        agreementNumber: agreement?.agreementNumber || null,
        agreementTotalAmount: agreement ? parseFloat(agreement.totalCommittedAmount.toString()) : 0,
        agreementBalanceAmount: agreement ? parseFloat(agreement.balanceAmount.toString()) : 0,
        agreementStatus: agreement?.status || 'Unknown',
        
        // Transaction details
        paymentMethod: transaction.paymentMethod || 'BANK_TRANSFER',
        description: transaction.description,
        status: 'Paid', // Bank transactions are always paid
        source: 'Bank Register'
      };
    });

    // Combine and sort by date, then limit
    const activities = [...activitiesCash, ...activitiesBank]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return activities;
  } catch (error: any) {
    throw new Error(`Error getting recent activity: ${error.message}`);
  }
};

// Get activity by date range
export const getActivityByDateRange = async (startDate: string, endDate: string) => {
  try {
    const transactionsCash = await CashRegister.findAll({
      where: {
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        },
        registrationDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    // ✅ NEW: Get bank register transactions
    const transactionsBank = await BankRegister.findAll({
      where: {
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        },
        registrationDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    // Get investment agreements and financers
    const InvestmentAgreement = require('../models/InvestmentAgreement').default;
    const agreements = await InvestmentAgreement.findAll();
    const financers = await Financer.findAll({ where: { status: 'ACTIVE' } });
    const cashRegisterMasters = await CashRegisterMaster.findAll({ where: { status: 'ACTIVE' } });
    const bankAccounts = await BankAccount.findAll();

    const activitiesCash = transactionsCash.map(transaction => {
      const agreement = agreements.find((a: any) => a.id === transaction.investmentAgreementId);
      const financer = agreement ? financers.find((f: any) => f.id === agreement.investorId) : null;
      const store = cashRegisterMasters.find(s => s.id === transaction.cashRegisterId);

      return {
        id: `cash-${transaction.id}`,
        date: transaction.registrationDate,
        type: transaction.relatedDocumentType,
        amount: parseFloat(transaction.amount.toString()),
        registrationNumber: transaction.registrationNumber,
        financerName: financer?.name || 'Unknown',
        financerType: financer?.type || 'Unknown',
        storeName: store?.name || 'Unknown',
        storeLocation: store?.location || '',
        storeBalanceAfter: parseFloat(transaction.balance.toString()),
        agreementNumber: agreement?.agreementNumber || 'N/A',
        paymentMethod: transaction.paymentMethod || 'CASH',
        status: 'Paid', // Cash transactions are always paid
        source: 'Cash Register'
      };
    });

    // ✅ NEW: Process bank register transactions
    const activitiesBank = transactionsBank.map(transaction => {
      const agreement = agreements.find((a: any) => a.id === (transaction as any).investmentAgreementId);
      const financer = agreement ? financers.find((f: any) => f.id === agreement.investorId) : null;
      const bankAccount = bankAccounts.find(b => b.id === transaction.bankAccountId);

      return {
        id: `bank-${transaction.id}`,
        date: transaction.registrationDate,
        type: transaction.relatedDocumentType,
        amount: parseFloat(transaction.amount.toString()),
        registrationNumber: transaction.registrationNumber,
        financerName: financer?.name || 'Unknown',
        financerType: financer?.type || 'Unknown',
        storeName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountNumber}` : 'Unknown',
        storeLocation: 'Bank Account',
        storeBalanceAfter: parseFloat(transaction.balance.toString()),
        agreementNumber: agreement?.agreementNumber || 'N/A',
        paymentMethod: transaction.paymentMethod || 'BANK_TRANSFER',
        status: 'Paid', // Bank transactions are always paid
        source: 'Bank Register'
      };
    });

    // Combine and sort by date
    const activities = [...activitiesCash, ...activitiesBank]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return activities;
  } catch (error: any) {
    throw new Error(`Error getting activity by date range: ${error.message}`);
  }
};

// Get activity statistics
export const getActivityStatistics = async () => {
  try {
    const activities = await getRecentActivity(1000); // Get more data for statistics
    
    const totalActivities = activities.length;
    const contributionCount = activities.filter(a => a.type === 'CONTRIBUTION').length;
    const loanCount = activities.filter(a => a.type === 'LOAN').length;
    
    const totalAmount = activities.reduce((sum, a) => sum + a.amount, 0);
    const contributionAmount = activities
      .filter(a => a.type === 'CONTRIBUTION')
      .reduce((sum, a) => sum + a.amount, 0);
    const loanAmount = activities
      .filter(a => a.type === 'LOAN')
      .reduce((sum, a) => sum + a.amount, 0);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivities = activities.filter(a => 
      new Date(a.date) >= sevenDaysAgo
    );

    // Monthly activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const monthlyActivities = activities.filter(a => 
      new Date(a.date) >= thirtyDaysAgo
    );

    return {
      totalActivities,
      contributionCount,
      loanCount,
      totalAmount,
      contributionAmount,
      loanAmount,
      recentActivities: {
        count: recentActivities.length,
        amount: recentActivities.reduce((sum, a) => sum + a.amount, 0)
      },
      monthlyActivities: {
        count: monthlyActivities.length,
        amount: monthlyActivities.reduce((sum, a) => sum + a.amount, 0)
      }
    };
  } catch (error: any) {
    throw new Error(`Error getting activity statistics: ${error.message}`);
  }
};